from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Header, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from auth import require_role, get_current_user
from src.parser import parse_resume
from src.extractor import extract_entities, is_valid_resume
from src.scorer import score_resume
from src.ats_scorer import calculate_ats_score
from src.vector_db import add_resume_vector
import models
import os
from src.insights import extract_insights, generate_summary
from pydantic import BaseModel
from models import User, Job, Application

router = APIRouter(tags=["Applications"])

UPLOAD_DIR = "data/uploaded_resumes"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/jobs/{job_id}/apply")
async def apply_to_job(
    job_id: int,
    resume: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("candidate"))
):
    """Candidate applies to a job. Resume is auto-analyzed."""
    # Check job exists and is live
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "live":
        raise HTTPException(status_code=400, detail="This job is not accepting applications")

    # Prevent duplicate application
    existing = db.query(models.Application).filter(
        models.Application.job_id == job_id,
        models.Application.candidate_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You already applied to this job")

    # Read binary content and write temp file for parsing
    content_bytes = await resume.read()
    filename = f"{current_user.id}_{job_id}_{resume.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(content_bytes)

    # Analyze resume (reuse existing engine)
    try:
        text = parse_resume(filepath)
        
        # Resume validation check (minimum 200 words + standard checks)
        is_resume, reason = is_valid_resume(text)
        if not is_resume:
            if os.path.exists(filepath):
                os.remove(filepath)
            raise HTTPException(status_code=400, detail=f"File validation failed: {reason}")

        entities = extract_entities(text)

        # JD compatibility score
        score_result = score_resume(text, job.description, job.skills or [])
        compatibility = score_result["final_score"]

        # ATS score
        ats_result = calculate_ats_score(text, filepath, jd_skills=job.skills or [], entities=entities)
        ats_score = ats_result["total_score"]

        # Career insights
        insights = extract_insights(text)

        # Recruiter summary
        summary = generate_summary(
            resume_text=text,
            job_title=job.title,
            job_skills=job.skills or [],
            ats_score=ats_score,
            compatibility=compatibility,
            matched_skills=score_result.get("matched_skills", []),
            missing_skills=score_result.get("missing_skills", []),
        )

        # AI screening questions generation upfront
        from src.question_gen import generate_questions
        questions = generate_questions(
            resume_entities=entities or {},
            jd_text=job.description,
            jd_skills=job.skills or [],
            matched_skills=score_result.get("matched_skills", []),
            missing_skills=score_result.get("missing_skills", []),
        )
        if isinstance(insights, dict):
            insights["questions"] = questions
    except HTTPException:
        # Re-raise standard HTTPExceptions (like the 400 validation error)
        raise
    except Exception as e:
        # Handle unexpected exceptions
        raise HTTPException(status_code=500, detail=f"Resume analysis failed: {str(e)}")

    # Save application
    application = models.Application(
        job_id=job_id,
        candidate_id=current_user.id,
        resume_path=filepath,
        resume_bytes=content_bytes,
        resume_text=text,
        entities=entities,
        ats_score=ats_score,
        compatibility_score=compatibility,
        insights=insights,
        summary=summary,
        current_stage="Applied"
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    # Trigger local vector storage in ChromaDB
    try:
        candidate_name = entities.get("name") if entities else None
        candidate_email = entities.get("email") if entities else None
        add_resume_vector(application.id, text, candidate_name, candidate_email)
    except Exception as e:
        print(f"ChromaDB insert failed: {str(e)}")

    return {
        "message": "Application submitted successfully",
        "application_id": application.id,
        "job_title": job.title
    }


@router.get("/jobs/{job_id}/applications")
def job_applications(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr"))
):
    """HR views all applicants for a job, sorted by compatibility."""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.hr_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your job")

    apps = db.query(models.Application).filter(
        models.Application.job_id == job_id
    ).order_by(models.Application.compatibility_score.desc()).all()

    return {
        "applicants": [{
            "application_id": a.id,
            "name": a.entities.get("name") if a.entities else None,
            "email": a.entities.get("email") if a.entities else None,
            "ats_score": a.ats_score,
            "compatibility_score": a.compatibility_score,
            "current_stage": a.current_stage,
            "skills": a.entities.get("skills", []) if a.entities else [],
            "insights": a.insights,
            "summary": a.summary
        } for a in apps]
    }


@router.get("/my-applications")
def my_applications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("candidate"))
):
    """Candidate views their own applications."""
    apps = db.query(models.Application).filter(
        models.Application.candidate_id == current_user.id
    ).all()

    return [{
        "application_id": a.id,
        "job_id": a.job_id,
        "job_title": a.job.title,
        "current_stage": a.current_stage,
        "applied_at": a.applied_at.isoformat() if a.applied_at else None
    } for a in apps]


def get_stages(job: models.Job):
    """Build stage list: Applied → Screening → Custom Stages/L1..Ln → Offer → Rejected"""
    stages = ["Applied", "Screening"]
    if job.custom_stages and isinstance(job.custom_stages, list):
        for stage in job.custom_stages:
            stages.append(stage)
    else:
        rounds = job.rounds or 1
        for i in range(1, rounds + 1):
            stages.append(f"L{i}")
    stages.append("Offer")
    stages.append("Rejected")
    return stages


class StageUpdate(BaseModel):
    stage: str


@router.patch("/applications/{application_id}/stage")
def move_stage(
    application_id: int,
    data: StageUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr"))
):
    """HR moves a candidate to a different stage."""
    app = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    job = db.query(models.Job).filter(models.Job.id == app.job_id).first()
    if job.hr_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your job")

    valid_stages = get_stages(job)
    if data.stage not in valid_stages:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Valid: {valid_stages}")

    app.current_stage = data.stage
    db.commit()

    return {
        "application_id": app.id,
        "candidate": app.entities.get("name") if app.entities else None,
        "new_stage": app.current_stage
    }


@router.get("/jobs/{job_id}/pipeline")
def job_pipeline(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr"))
):
    """HR views applicants grouped by pipeline stage (for tabs/board view)."""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.hr_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your job")

    stages = get_stages(job)
    apps = db.query(models.Application).filter(
        models.Application.job_id == job_id
    ).order_by(models.Application.compatibility_score.desc()).all()

    pipeline = {stage: [] for stage in stages}
    for a in apps:
        stage = a.current_stage if a.current_stage in pipeline else "Applied"
        pipeline[stage].append({
            "application_id": a.id,
            "name": a.entities.get("name") if a.entities else None,
            "email": a.entities.get("email") if a.entities else None,
            "ats_score": a.ats_score,
            "compatibility_score": a.compatibility_score,
            "insights": a.insights,
            "summary": a.summary,
            "skills": a.entities.get("skills", []) if a.entities else []
        })
    return {
        "job_title": job.title,
        "stages": stages,
        "counts": {stage: len(pipeline[stage]) for stage in stages},
        "pipeline": pipeline
    }


@router.get("/my-applications/{application_id}/progress")
def my_progress(
    application_id: int,
    current_user: User = Depends(require_role("candidate")),
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(
        Application.id == application_id,
        Application.candidate_id == current_user.id,
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    job = db.query(Job).filter(Job.id == app.job_id).first()
    all_stages = get_stages(job)

    timeline_stages = [s for s in all_stages if s != "Rejected"]

    if app.current_stage == "Rejected":
        current_index = -1
    else:
        current_index = timeline_stages.index(app.current_stage)

    steps = []
    for i, stage in enumerate(timeline_stages):
        if app.current_stage == "Rejected":
            status = "rejected"
        elif i < current_index:
            status = "completed"
        elif i == current_index:
            status = "current"
        else:
            status = "upcoming"
        steps.append({"stage": stage, "status": status})

    return {
        "application_id": app.id,
        "job_title": job.title,
        "current_stage": app.current_stage,
        "is_rejected": app.current_stage == "Rejected",
        "steps": steps,
    }


@router.get("/applications/{application_id}/questions")
def get_application_questions(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr"))
):
    """HR views AI-generated interview screening questions for a candidate."""
    app = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.hr_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your job application")

    insights = app.insights or {}
    if isinstance(insights, dict) and "questions" in insights and insights["questions"]:
        return {"questions": insights["questions"]}

    try:
        from src.question_gen import generate_questions
        from src.scorer import score_resume

        score_result = score_resume(app.resume_text, job.description, job.skills or [])
        matched_skills = score_result.get("matched_skills", [])
        missing_skills = score_result.get("missing_skills", [])

        questions = generate_questions(
            resume_entities=app.entities or {},
            jd_text=job.description,
            jd_skills=job.skills or [],
            matched_skills=matched_skills,
            missing_skills=missing_skills
        )

        app.insights = {**insights, "questions": questions}
        db.commit()
        db.refresh(app)

        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")


@router.get("/applications/{application_id}/resume")
def get_application_resume(
    application_id: int,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Serve the original candidate resume file with token auth support."""
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ")[1]
    elif token:
        auth_token = token

    if not auth_token:
        raise HTTPException(status_code=401, detail="Authentication token is missing")

    try:
        from auth import SECRET_KEY, ALGORITHM
        from jose import jwt, JWTError
        payload = jwt.decode(auth_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        user_role = payload.get("role")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token details")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    app = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if user_role == "hr":
        job = db.query(models.Job).filter(models.Job.id == app.job_id).first()
        if not job or job.hr_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this application's resume")
    elif user_role == "candidate":
        if app.candidate_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this resume")
    else:
        raise HTTPException(status_code=403, detail="Unauthorized role")

    # 1. Stream directly from memory if stored in PostgreSQL BYTEA
    if app.resume_bytes:
        filename = os.path.basename(app.resume_path) if app.resume_path else "resume.pdf"
        ext = os.path.splitext(filename)[1].lower()
        media_types = {
            ".pdf": "application/pdf",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".txt": "text/plain"
        }
        media_type = media_types.get(ext, "application/octet-stream")
        return Response(
            content=app.resume_bytes,
            media_type=media_type,
            headers={
                "Content-Disposition": f"inline; filename={filename}"
            }
        )

    # 2. Fallback to physical disk file if db binary is not available (retroactive compatibility)
    if not app.resume_path or not os.path.exists(app.resume_path):
        raise HTTPException(status_code=404, detail="Resume file not found on server disk")

    filename = os.path.basename(app.resume_path)
    ext = os.path.splitext(app.resume_path)[1].lower()
    media_types = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".txt": "text/plain"
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=app.resume_path,
        media_type=media_type,
        filename=filename
    )