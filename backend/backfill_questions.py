import os
import sys

# Ensure backend folder is in path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from database import SessionLocal
import models
from src.scorer import score_resume
from src.question_gen import generate_questions

def backfill():
    db = SessionLocal()
    try:
        apps = db.query(models.Application).all()
        print(f"Total applications: {len(apps)}")
        
        to_backfill = []
        for app in apps:
            insights = app.insights or {}
            has_questions = isinstance(insights, dict) and "questions" in insights and bool(insights["questions"])
            if not has_questions:
                to_backfill.append(app)
        
        print(f"Applications needing backfill: {len(to_backfill)}")
        
        for app in to_backfill:
            print(f"\nProcessing Application ID {app.id} (Candidate: {app.entities.get('name') if app.entities else 'Unknown'})...")
            
            # Fetch job details
            job = db.query(models.Job).filter(models.Job.id == app.job_id).first()
            if not job:
                print(f"Skipping App ID {app.id}: Job not found")
                continue
                
            try:
                # Re-run scorecard matching
                score_result = score_resume(app.resume_text, job.description, job.skills or [])
                matched_skills = score_result.get("matched_skills", [])
                missing_skills = score_result.get("missing_skills", [])

                # Generate questions
                questions = generate_questions(
                    resume_entities=app.entities or {},
                    jd_text=job.description,
                    jd_skills=job.skills or [],
                    matched_skills=matched_skills,
                    missing_skills=missing_skills
                )
                
                # Update insights
                insights = app.insights or {}
                app.insights = {**insights, "questions": questions}
                db.commit()
                print(f"Successfully generated and saved questions for App ID {app.id}")
            except Exception as e:
                db.rollback()
                print(f"Failed to generate questions for App ID {app.id}: {str(e)}")
                
    finally:
        db.close()

if __name__ == "__main__":
    backfill()
