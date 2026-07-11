from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON
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


class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(Text)
    salary_min = Column(Integer)
    salary_max = Column(Integer)
    experience_required = Column(String)
    rounds = Column(Integer)
    skills = Column(JSON)
    status = Column(String, default="draft")
    hr_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    hr = relationship("User", back_populates="jobs")
    applications = relationship("Application", back_populates="job")


class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"))
    candidate_id = Column(Integer, ForeignKey("users.id"))
    resume_path = Column(String)
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
