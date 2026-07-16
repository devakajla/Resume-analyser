from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON, LargeBinary
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String)  # "hr" or "candidate"
    created_at = Column(DateTime, default=datetime.utcnow)

    jobs = relationship("Job", back_populates="hr")
    applications = relationship("Application", back_populates="candidate")
    companies = relationship("Company", back_populates="creator")


class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    industry = Column(String, nullable=True)
    website = Column(String, nullable=True)
    jd_template = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User", back_populates="companies")
    departments = relationship("Department", back_populates="company", cascade="all, delete-orphan")


class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String, nullable=False)
    poc_name = Column(String, nullable=True)
    poc_email = Column(String, nullable=True)
    poc_phone = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="departments")
    jobs = relationship("Job", back_populates="department")


class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(Text)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    salary_min = Column(Integer)
    salary_max = Column(Integer)
    experience_required = Column(String)
    rounds = Column(Integer)
    custom_stages = Column(JSON, nullable=True)
    skills = Column(JSON)
    status = Column(String, default="draft")
    hr_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    hr = relationship("User", back_populates="jobs")
    department = relationship("Department", back_populates="jobs")
    applications = relationship("Application", back_populates="job")


class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"))
    candidate_id = Column(Integer, ForeignKey("users.id"))
    resume_path = Column(String)
    resume_bytes = Column(LargeBinary, nullable=True) # Binary representation in Postgres
    resume_text = Column(Text)
    entities = Column(JSON)
    ats_score = Column(Integer)
    compatibility_score = Column(Float)
    insights = Column(JSON)
    summary = Column(Text, nullable=True)
    current_stage = Column(String, default="Applied")
    applied_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="applications")
    candidate = relationship("User", back_populates="applications")