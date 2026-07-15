from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from auth import require_role
import models

router = APIRouter(tags=["Departments"])


class DepartmentCreate(BaseModel):
    name: str
    poc_name: Optional[str] = None
    poc_email: Optional[str] = None
    poc_phone: Optional[str] = None


def to_dict(d: models.Department):
    return {
        "id": d.id,
        "company_id": d.company_id,
        "name": d.name,
        "poc_name": d.poc_name,
        "poc_email": d.poc_email,
        "poc_phone": d.poc_phone,
        "job_count": len(d.jobs),
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


def _get_owned_company(company_id: int, db: Session, current_user: models.User) -> models.Company:
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not your company")
    return company


@router.post("/companies/{company_id}/departments")
def create_department(
    company_id: int,
    data: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr")),
):
    """HR adds a department under a company they own, with its own POC."""
    _get_owned_company(company_id, db, current_user)

    department = models.Department(company_id=company_id, **data.dict())
    db.add(department)
    db.commit()
    db.refresh(department)
    return to_dict(department)


@router.get("/companies/{company_id}/departments")
def list_departments(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr")),
):
    """List all departments under a company."""
    _get_owned_company(company_id, db, current_user)
    departments = db.query(models.Department).filter(models.Department.company_id == company_id).all()
    return [to_dict(d) for d in departments]


@router.get("/departments/{department_id}")
def get_department(
    department_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr")),
):
    department = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    if department.company.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not your department")
    return to_dict(department)


@router.patch("/departments/{department_id}")
def update_department(
    department_id: int,
    data: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr")),
):
    department = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    if department.company.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not your department")

    for key, value in data.dict(exclude_unset=True).items():
        setattr(department, key, value)
    db.commit()
    db.refresh(department)
    return to_dict(department)


@router.delete("/departments/{department_id}")
def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("hr")),
):
    department = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    if department.company.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not your department")

    db.delete(department)
    db.commit()
    return {"message": "Department deleted"}