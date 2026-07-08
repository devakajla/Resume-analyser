from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from auth import get_current_user, require_role
from src.llm import call_llm
import models

router = APIRouter(prefix="/jobs", tags=["Jobs"])


class JobCreate(BaseModel):
    title: str
    description: str
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    experience_required: Optional[str] = None
    rounds: int = 1


def extract_jd_skills(jd_text: str):
    """Reuse LLM to auto-extract skills from JD."""
    raw = call_llm(
        prompt=f"""Extract the key required skills from this job description. Return ONLY a comma-separated list, no duplicates.

Job Description:
{jd_text}

Skills (comma-separated):""",
        max_tokens=200,
        temperature=0.1
    )
    skills = [s.strip().strip("-").strip("•") for s in raw.split(",")]
    skills = [s for s in skills if s and len(s) < 50]
    # Remove duplicates
    seen = set()
    unique = []
    for s in skills:
        if s.lower() not in seen:
            seen.add(s.lower())
            unique.append(s)
    return unique


@router.post("")
def create_job(
    data: JobCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr"))
):
    """HR creates a new job. Skills are auto-extracted from the JD."""
    skills = extract_jd_skills(data.description)

    job = models.Job(
        title=data.title,
        description=data.description,
        salary_min=data.salary_min,
        salary_max=data.salary_max,
        experience_required=data.experience_required,
        rounds=data.rounds,
        skills=skills,
        status="draft",
        hr_id=current_user.id
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return {
        "id": job.id,
        "title": job.title,
        "skills": job.skills,
        "status": job.status,
        "message": "Job created as draft. Set status to 'live' to publish."
    }


@router.get("")
def list_live_jobs(db: Session = Depends(get_db)):
    """Public — list all live jobs (candidates browse these)."""
    jobs = db.query(models. Job).filter(models.Job.status == "live").all()
    return [{
        "id": j.id,
        "title": j.title,
        "salary_min": j.salary_min,
        "salary_max": j.salary_max,
        "experience_required": j.experience_required,
        "skills": j.skills,
        "rounds": j.rounds
    } for j in jobs]


@router.get("/mine")
def my_jobs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr"))
):
    """HR sees their own posted jobs."""
    jobs = db.query(models.Job).filter(models.Job.hr_id == current_user.id).all()
    return [{
        "id": j.id,
        "title": j.title,
        "status": j.status,
        "rounds": j.rounds,
        "applicant_count": len(j.applications)
    } for j in jobs]


@router.get("/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    """Get full details of a single job."""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": job.id,
        "title": job.title,
        "description": job.description,
        "salary_min": job.salary_min,
        "salary_max": job.salary_max,
        "experience_required": job.experience_required,
        "skills": job.skills,
        "rounds": job.rounds,
        "status": job.status
    }


class StatusUpdate(BaseModel):
    status: str  # draft / live / closed


@router.patch("/{job_id}/status")
def update_status(
    job_id: int,
    data: StatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr"))
):
    """HR changes job status (draft -> live -> closed)."""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.hr_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your job")
    if data.status not in ("draft", "live", "closed"):
        raise HTTPException(status_code=400, detail="Invalid status")

    job.status = data.status
    db.commit()
    return {"id": job.id, "status": job.status}
