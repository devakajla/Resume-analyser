from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from auth import require_role
from src.llm import call_llm
import models

router = APIRouter(prefix="/jobs", tags=["Jobs"])


class JobCreate(BaseModel):
    title: str
    description: str
    department_id: int
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    experience_required: Optional[str] = None
    rounds: int
    custom_stages: Optional[list[str]] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    experience_required: Optional[str] = None
    rounds: Optional[int] = None
    custom_stages: Optional[list[str]] = None
    skills: Optional[list[str]] = None


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
    seen = set()
    unique = []
    for s in skills:
        if s.lower() not in seen:
            seen.add(s.lower())
            unique.append(s)
    return unique


def _job_summary(j: models.Job):
    return {
        "id": j.id,
        "title": j.title,
        "department": j.department.name if j.department else None,
        "department_id": j.department_id,
        "company": j.department.company.name if j.department and j.department.company else None,
        "company_id": j.department.company_id if j.department else None,
        "status": j.status,
        "rounds": j.rounds,
        "custom_stages": j.custom_stages,
        "salary_min": j.salary_min,
        "salary_max": j.salary_max,
    }


@router.post("")
def create_job(
    data: JobCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr"))
):
    """HR creates a new job under a department. Skills are auto-extracted from the JD."""
    department = db.query(models.Department).filter(models.Department.id == data.department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    if department.company.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not your department")

    if data.salary_min is not None and data.salary_max is not None:
        if data.salary_max < data.salary_min:
            raise HTTPException(status_code=400, detail="Maximum salary cannot be less than minimum salary")

    skills = extract_jd_skills(data.description)

    job = models.Job(
        title=data.title,
        description=data.description,
        department_id=data.department_id,
        salary_min=data.salary_min,
        salary_max=data.salary_max,
        experience_required=data.experience_required,
        rounds=data.rounds,
        custom_stages=data.custom_stages,
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
        "department": department.name,
        "company": department.company.name,
        "skills": job.skills,
        "status": job.status,
        "message": "Job created as draft. Set status to 'live' to publish."
    }


@router.get("")
def list_live_jobs(db: Session = Depends(get_db)):
    """Public — list all live jobs (candidates browse these)."""
    jobs = db.query(models.Job).filter(models.Job.status == "live").all()
    return [{
        **_job_summary(j),
        "salary_min": j.salary_min,
        "salary_max": j.salary_max,
        "experience_required": j.experience_required,
        "skills": j.skills,
    } for j in jobs]


@router.get("/mine")
def my_jobs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr"))
):
    """HR sees their own posted jobs."""
    jobs = db.query(models.Job).filter(models.Job.hr_id == current_user.id).all()
    return [{
        **_job_summary(j),
        "applicant_count": len(j.applications),
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
        "department": {
            "id": job.department.id,
            "name": job.department.name,
            "poc_name": job.department.poc_name,
            "poc_email": job.department.poc_email,
            "poc_phone": job.department.poc_phone,
        } if job.department else None,
        "company": {"id": job.department.company.id, "name": job.department.company.name} if job.department else None,
        "salary_min": job.salary_min,
        "salary_max": job.salary_max,
        "experience_required": job.experience_required,
        "skills": job.skills,
        "rounds": job.rounds,
        "custom_stages": job.custom_stages,
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


@router.patch("/{job_id}")
def update_job(
    job_id: int,
    data: JobUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr"))
):
    """HR updates details of a posted job."""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.hr_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your job")

    new_min = data.salary_min if data.salary_min is not None else job.salary_min
    new_max = data.salary_max if data.salary_max is not None else job.salary_max
    if new_min is not None and new_max is not None:
        if new_max < new_min:
            raise HTTPException(status_code=400, detail="Maximum salary cannot be less than minimum salary")

    for key, value in data.dict(exclude_unset=True).items():
        setattr(job, key, value)

    # Re-extract skills if description was updated, unless custom skills were provided
    if "description" in data.dict(exclude_unset=True) and "skills" not in data.dict(exclude_unset=True):
        job.skills = extract_jd_skills(job.description)

    db.commit()
    db.refresh(job)
    return {
        "id": job.id,
        "title": job.title,
        "description": job.description,
        "salary_min": job.salary_min,
        "salary_max": job.salary_max,
        "experience_required": job.experience_required,
        "rounds": job.rounds,
        "custom_stages": job.custom_stages,
        "skills": job.skills,
        "status": job.status
    }