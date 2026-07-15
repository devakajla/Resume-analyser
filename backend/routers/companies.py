from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from auth import require_role
import models

router = APIRouter(prefix="/companies", tags=["Companies"])


class CompanyCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    jd_template: Optional[str] = None


def to_dict(c: models.Company):
    return {
        "id": c.id,
        "name": c.name,
        "industry": c.industry,
        "website": c.website,
        "jd_template": c.jd_template,
        "department_count": len(c.departments),
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.post("")
def create_company(data: CompanyCreate, db: Session = Depends(get_db),
                    current_user: models.User = Depends(require_role("hr"))):
    company = models.Company(**data.dict(), created_by=current_user.id)
    db.add(company)
    db.commit()
    db.refresh(company)
    return to_dict(company)


@router.get("")
def list_companies(db: Session = Depends(get_db),
                    current_user: models.User = Depends(require_role("hr"))):
    companies = db.query(models.Company).filter(models.Company.created_by == current_user.id).all()
    return [to_dict(c) for c in companies]


@router.get("/{company_id}")
def get_company(company_id: int, db: Session = Depends(get_db),
                 current_user: models.User = Depends(require_role("hr"))):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return to_dict(company)


@router.patch("/{company_id}")
def update_company(company_id: int, data: CompanyCreate, db: Session = Depends(get_db),
                    current_user: models.User = Depends(require_role("hr"))):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not your company")
    for key, value in data.dict(exclude_unset=True).items():
        setattr(company, key, value)
    db.commit()
    db.refresh(company)
    return to_dict(company)


@router.delete("/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db),
                    current_user: models.User = Depends(require_role("hr"))):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not your company")
    db.delete(company)
    db.commit()
    return {"message": "Company and its departments deleted"}