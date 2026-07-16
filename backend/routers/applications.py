from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Header, Query, Response, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
import os

from database import get_db, SessionLocal
from auth import require_role, get_current_user
from src.parser import parse_resume
from src.extractor import extract_entities, is_valid_resume
from src.scorer import score_resume
from src.ats_scorer import calculate_ats_score
from src.vector_db import add_resume_vector, query_semantic_candidates
from src.insights import extract_insights, generate_summary
import models
from pydantic import BaseModel
from models import User, Job, Application

router = APIRouter(tags=["Applications"])


# ============ ASYNC BACKGROUND WORKER ============

def process_application_analysis(application_id: int, job_id: int):
    """Heavy NLP, LLM Generation, and Pinecone vector inserts executed in background thread."""
    # Create fresh database session for thread-safety
    db = SessionLocal()
    try:
        app = db.query(models.Application).filter(models.Application.id == application_id).first()
        job = db.query(models.Job).filter(models.Job.id == job_id).first()
        if not app or not job:
            return

        text = app.resume_text
        content_bytes = app.resume_bytes
        ext = os.path.splitext(app.resume_path)[1].lower()

        # 1. Extract entities (spacy models)
        entities = extract_entities(text)

        # 2. JD compatibility score (hybrid weights)
        score_result = score_resume(text, job.description, job.skills or [])
        compatibility = score_result["final_score"]

        # 3. ATS score (lemmatized and layout audits)
        ats_result = calculate_ats_score(text, app.resume_path, jd_skills=job.skills or [], entities=entities)
        ats_score = ats_result["total_score"]

        # 4. Career insights & AI screening questions (LLM calls)
        insights = extract_insights(text)
        
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

        # 5. Candidate profile summary (LLM call)
        summary = generate_summary(
            resume_text=text,
            job_title=job.title,
            job_skills=job.skills or [],
            ats_score=ats_score,
            compatibility=compatibility,
            matched_skills=score_result.get("matched_skills", []),
            missing_skills=score_result.get("missing_skills", []),
        )

        # Update application data structures inside Postgres
        app.entities = entities
        app.compatibility_score = compatibility
        app.ats_score = ats_score
        app.insights = insights
        app.summary = summary
        db.commit()

        # 6. Push embedding vector to Pinecone Cloud database
        try:
            candidate_name = entities.get("name") if entities else None
            candidate_email = entities.get("email") if entities else None
            add_resume_vector(app.id, text, candidate_name, candidate_email)
        except Exception as e:
            print(f"Background vector upload failed: {str(e)}")

    except Exception as e:
        print(f"Background processing failed for application {application_id}: {str(e)}")
    finally:
        db.close()


# ============ ROUTERS / ENDPOINTS ============

@router.post("/jobs/{job_id}/apply")
async def apply_to_job(
    job_id: int,
    background_tasks: BackgroundTasks,  # FastAPI Background Worker Injection
    resume: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("candidate"))
):
    """Candidate applies to a job. Initial validation is sync; heavy analysis is async."""
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

    # Read bytes and file name metadata
    content_bytes = await resume.read()
    ext = os.path.splitext(resume.filename)[1].lower()

    # Create temporary directory inside workspace for parser path dependency
    UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "uploaded_resumes")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{current_user.id}_{job_id}_{resume.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    # Save file on local disk for parser reference
    with open(filepath, "wb") as f:
        f.write(content_bytes)

    # Analyze resume (Fast parsing and text extraction)
    try:
        text = parse_resume(filepath)
        
        # Fast Validation check (Sync)
        is_resume, reason = is_valid_resume(text)
        if not is_resume:
            # Clean up the file immediately if validation fails
            if os.path.exists(filepath):
                os.remove(filepath)
            raise HTTPException(status_code=400, detail=f"File validation failed: {reason}")
            
    except HTTPException:
        # Re-raise validation exceptions
        raise
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=500, detail=f"Resume extraction failed: {str(e)}")

    # Create initial Application row in DB (Instant write)
    application = models.Application(
        job_id=job_id,
        candidate_id=current_user.id,
        resume_path=filepath,
        resume_bytes=content_bytes,
        resume_text=text,
        current_stage="Applied"
        # Analysis metrics (scores, entities, insights, summary) are left null/empty initially
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    # Trigger async calculations in background
    background_tasks.add_task(process_application_analysis, application.id, job.id)

    return {
        "message": "Application submitted successfully. Analysis is running in background.",
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
        models.Application.job_id == job_id,
        models.Application.compatibility_score.isnot(None)
    ).order_by(models.Application.compatibility_score.desc()).all()

    return {
        "applicants": [{
            "application_id": a.id,
            "name": a.entities.get("name") if a.entities else "Processing...",
            "email": a.entities.get("email") if a.entities else None,
            "ats_score": a.ats_score if a.ats_score is not None else 0,
            "compatibility_score": a.compatibility_score if a.compatibility_score is not None else 0.0,
            "current_stage": a.current_stage,
            "skills": a.entities.get("skills", []) if a.entities else [],
            "insights": a.insights,
            "summary": a.summary or "Generating summary..."
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
        models.Application.job_id == job_id,
        models.Application.compatibility_score.isnot(None)
    ).order_by(models.Application.compatibility_score.desc()).all()

    pipeline = {stage: [] for stage in stages}
    for a in apps:
        stage = a.current_stage if a.current_stage in pipeline else "Applied"
        pipeline[stage].append({
            "application_id": a.id,
            "name": a.entities.get("name") if a.entities else "Processing...",
            "email": a.entities.get("email") if a.entities else None,
            "ats_score": a.ats_score if a.ats_score is not None else 0,
            "compatibility_score": a.compatibility_score if a.compatibility_score is not None else 0.0,
            "insights": a.insights,
            "summary": a.summary or "Generating summary...",
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

    job = db.query(models.Job).filter(models.Job.id == app.job_id).first()
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
    """Serve the original candidate resume file directly from PostgreSQL BYTEA."""
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

    # Stream directly from memory if stored in PostgreSQL BYTEA (Primary)
    if app.resume_bytes:
        filename = app.resume_path if app.resume_path else "resume.pdf"
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

    # Fallback to physical disk file (only for legacy records prior to database stream migration)
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


@router.get("/jobs/{job_id}/db-suggestions")
def get_job_db_suggestions(
    job_id: int,
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr"))
):
    """Query Pinecone for top candidates in the entire database matching this job description or a custom query."""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.hr_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your job")

    # Query Pinecone using job description (RAM embedding) or custom query
    query_text = q if q else job.description
    try:
        matched_ids = query_semantic_candidates(query_text, limit=5)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pinecone query failed: {str(e)}")

    if not matched_ids:
        return {"suggestions": []}

    # Fetch corresponding applications from PostgreSQL
    # Convert string IDs back to integer
    app_ids = [int(i) for i in matched_ids if i.isdigit()]
    apps = db.query(models.Application).filter(models.Application.id.in_(app_ids)).all()

    # Sort apps to maintain Pinecone semantic relevance ranking
    id_to_index = {val: idx for idx, val in enumerate(app_ids)}
    apps = sorted(apps, key=lambda a: id_to_index.get(a.id, 999))

    # Map database records
    # Note: We filter out candidates who ALREADY applied to this specific job!
    # (since they are already in the pipeline, we only suggest candidates who applied to other roles)
    suggestions = []
    for a in apps:
        if a.job_id == job_id:
            continue  # Already applied here, skip suggestion

        # Recalculate JD Match Score (compatibility_score) dynamically against the current job!
        target_score = score_resume(a.resume_text, job.description, job.skills or [])
        comp_score = target_score.get("compatibility_score", 0.0)

        suggestions.append({
            "application_id": str(a.id),
            "original_job_title": a.job.title if a.job else "Unknown",
            "name": a.entities.get("name") if a.entities else "Unknown",
            "email": a.entities.get("email") if a.entities else None,
            "ats_score": a.ats_score,
            "compatibility_score": comp_score, # Recalculated dynamically!
            "current_stage": a.current_stage or "Applied",
            "skills": a.entities.get("skills", []) if a.entities else [],
        })

    return {"suggestions": suggestions}


@router.get("/applications/{app_id}/job/{job_id}/tailored-insights")
def get_application_tailored_insights(
    app_id: int,
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr"))
):
    """Dynamically generate summary and screening questions compared specifically against a target job JD."""
    app = db.query(models.Application).filter(models.Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Candidate application not found")
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job description not found")

    try:
        from src.llm import call_llm
        from src.question_gen import generate_questions

        # 1. Run dynamic scoring to get matched/missing skills
        target_score = score_resume(app.resume_text, job.description, job.skills or [])
        matched_skills = target_score.get("matched_skills", [])
        missing_skills = target_score.get("missing_skills", [])

        # 2. Call LLM to generate recruiting summary compared specifically to the target Job Description
        summary_prompt = f"""Compare this candidate's resume to the target job description and write a concise 3-4 sentence recruiting summary explaining why they are a match or what gaps they have for THIS SPECIFIC ROLE. Do not mention other roles they applied to, focus entirely on this target role.

Candidate Resume:
{app.resume_text}

Target Job Description:
{job.description}

Summary:"""
        tailored_summary = call_llm(summary_prompt, max_tokens=300, temperature=0.3)

        # 3. Call LLM/question generator to construct tailored screening questions
        entities = app.entities or {}
        tailored_questions = generate_questions(
            resume_entities=entities,
            jd_text=job.description,
            jd_skills=job.skills or [],
            matched_skills=matched_skills,
            missing_skills=missing_skills
        )

        return {
            "summary": tailored_summary,
            "questions": tailored_questions,
            "skills": entities.get("skills", [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate tailored insights: {str(e)}")