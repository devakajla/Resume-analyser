from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db
from auth import require_role, get_current_user
from src.parser import parse_resume
from src.extractor import extract_entities
from src.scorer import score_resume
from src.ats_scorer import calculate_ats_score
import models
import os
from src.insights import extract_insights

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
    job = db.query(models.Job).filter(models. Job.id == job_id).first()
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

    # Save resume file
    filename = f"{current_user.id}_{job_id}_{resume.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        content = await resume.read()
        f.write(content)

    # Analyze resume (reuse existing engine)
    try:
        text = parse_resume(filepath)
        entities = extract_entities(text)

        # JD compatibility score
        score_result = score_resume(text, job.description, job.skills or [])
        compatibility = score_result["final_score"]

        # ATS score
        ats_result = calculate_ats_score(text, filepath, jd_skills=job.skills or [], entities=entities)
        ats_score = ats_result["total_score"]

        # Career insights
        insights = extract_insights(text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resume analysis failed: {str(e)}")

    # Save application
    application = models.Application(
        job_id=job_id,
        candidate_id=current_user.id,
        resume_path=filepath,
        resume_text=text,
        entities=entities,
        ats_score=ats_score,
        compatibility_score=compatibility,
        insights=insights,  # will fill in next phase
        current_stage="Applied"
    )
    db.add(application)
    db.commit()
    db.refresh(application)

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
            "insights": a.insights   # ← add this
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
        "job_title": a.job.title,
        "current_stage": a.current_stage,
        "applied_at": a.applied_at.isoformat() if a.applied_at else None
    } for a in apps]
