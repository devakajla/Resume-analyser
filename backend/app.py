from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from src.parser import parse_resume
from src.extractor import extract_entities
from src.scorer import score_resume
from src.ats_scorer import calculate_ats_score
from src.question_gen import generate_questions
from src.config import MIN_SCORE_THRESHOLD
from dotenv import load_dotenv
from src.llm import call_llm
from routers import jobs
import requests
import os
import shutil
import tempfile
from fastapi import Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database import get_db, engine, Base
import models
from auth import hash_password, verify_password, create_access_token, get_current_user
from routers import jobs, applications

Base.metadata.create_all(bind=engine)
load_dotenv()
app = FastAPI(
    title="Resume Analyser API",
    description="Upload resumes, match against JD, get ranked candidates with HR questions"
)
app.include_router(jobs.router)
app.include_router(jobs.router)
app.include_router(applications.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage
parsed_resumes = {}
current_jd = {"text": "", "skills": []}
ranked_results = []

UPLOAD_DIR = "data/uploaded_resumes"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============ ENDPOINTS ============

@app.get("/")
def home():
    return {"message": "Resume Analyser API is running", "docs": "/docs"}

@app.post("/upload-resumes")
async def upload_resumes(files: list[UploadFile] = File(description="Upload resume files")):
    """Upload one or more resume files (PDF, DOCX, TXT, PNG, JPG)."""
    global parsed_resumes
    results = []
    errors = []

    for file in files:
        filepath = os.path.join(UPLOAD_DIR, file.filename)
        try:
            with open(filepath, "wb") as f:
                content = await file.read()
                f.write(content)

            text = parse_resume(filepath)
            entities = extract_entities(text)
            parsed_resumes[file.filename] = {
                "text": text,
                "entities": entities
            }
            results.append({
                "file": file.filename,
                "name": entities.get("name"),
                "email": entities.get("email"),
                "skills_count": len(entities.get("skills", []))
            })
        except Exception as e:
            errors.append({"file": file.filename, "error": str(e)})

    return {
        "parsed": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors
    }

@app.post("/set-jd")
def set_jd(jd_text: str = Form(...)):
    global current_jd

    raw = call_llm(
        prompt=f"""Extract the key required skills from this job description. Return ONLY a comma-separated list of skills, nothing else. No duplicates.

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
    unique_skills = []
    for s in skills:
        if s.lower() not in seen:
            seen.add(s.lower())
            unique_skills.append(s)

    current_jd = {"text": jd_text, "skills": unique_skills}
    return {
        "message": "JD set successfully",
        "extracted_skills": unique_skills,
        "skill_count": len(unique_skills)
    }

@app.post("/rank")
def rank_resumes():
    """Rank all uploaded resumes against the current JD."""
    global ranked_results

    if not parsed_resumes:
        return JSONResponse(status_code=400, content={"error": "No resumes uploaded. Use /upload-resumes first."})
    if not current_jd["text"]:
        return JSONResponse(status_code=400, content={"error": "No JD set. Use /set-jd first."})

    ranked_results = []
    for filename, data in parsed_resumes.items():
        result = score_resume(data["text"], current_jd["text"], current_jd["skills"])
        result["file"] = filename
        result["name"] = data["entities"].get("name")
        result["email"] = data["entities"].get("email")
        result["entities"] = data["entities"]
        ranked_results.append(result)

    ranked_results.sort(key=lambda x: x["final_score"], reverse=True)

    shortlisted = [r for r in ranked_results if r["final_score"] >= MIN_SCORE_THRESHOLD]
    not_shortlisted = [r for r in ranked_results if r["final_score"] < MIN_SCORE_THRESHOLD]

    return {
        "total": len(ranked_results),
        "shortlisted_count": len(shortlisted),
        "shortlisted": [{
            "rank": i + 1,
            "name": r["name"],
            "file": r["file"],
            "final_score": r["final_score"],
            "embedding_score": r["embedding_score"],
            "skill_score": r["skill_score"],
            "llm_score": r.get("llm_score", "N/A"),
            "matched_skills": r["matched_skills"],
            "missing_skills": r["missing_skills"]
        } for i, r in enumerate(shortlisted)],
        "not_shortlisted": [{
            "name": r["name"],
            "file": r["file"],
            "final_score": r["final_score"]
        } for r in not_shortlisted]
    }


@app.post("/generate-questions/{filename}")
def generate_questions_for_resume(filename: str):
    """Generate HR interview questions for a specific resume."""
    if filename not in parsed_resumes:
        return JSONResponse(status_code=404, content={"error": f"Resume '{filename}' not found. Upload it first."})
    if not current_jd["text"]:
        return JSONResponse(status_code=400, content={"error": "No JD set. Use /set-jd first."})

    # Find the scored result for this resume
    resume_result = None
    for r in ranked_results:
        if r["file"] == filename:
            resume_result = r
            break

    matched = resume_result["matched_skills"] if resume_result else []
    missing = resume_result["missing_skills"] if resume_result else current_jd["skills"]

    questions = generate_questions(
        resume_entities=parsed_resumes[filename]["entities"],
        jd_text=current_jd["text"],
        jd_skills=current_jd["skills"],
        matched_skills=matched,
        missing_skills=missing
    )

    return {
        "candidate": parsed_resumes[filename]["entities"].get("name"),
        "file": filename,
        "questions": questions
    }


@app.get("/status")
def status():
    """Check current state — how many resumes uploaded, JD set or not."""
    return {
        "resumes_uploaded": len(parsed_resumes),
        "resume_files": list(parsed_resumes.keys()),
        "jd_set": bool(current_jd["text"]),
        "jd_skills": current_jd["skills"],
        "results_available": len(ranked_results) > 0
    }

@app.post("/ats-score/{filename}")
def get_ats_score(filename: str):
    """Get ATS compatibility score for a resume."""
    if filename not in parsed_resumes:
        return JSONResponse(status_code=404, content={"error": f"Resume '{filename}' not found."})

    data = parsed_resumes[filename]
    file_path = os.path.join(UPLOAD_DIR, filename)

    result = calculate_ats_score(
        text=data["text"],
        file_path=file_path,
        jd_skills=current_jd.get("skills", []),
        entities=data["entities"]
    )

    result["candidate"] = data["entities"].get("name")
    result["file"] = filename
    return result


from pydantic import BaseModel


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str  # "hr" or "candidate"


@app.post("/signup")
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    # Check if email exists
    existing = db.query(models.User).filter(models.User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if data.role not in ("hr", "candidate"):
        raise HTTPException(status_code=400, detail="Role must be 'hr' or 'candidate'")

    user = models.User(
        name=data.name,
        email=data.email,
        password=hash_password(data.password),
        role=data.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"user_id": user.id, "role": user.role})
    return {
        "token": token,
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}
    }


@app.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # form.username = email, form.password = password
    user = db.query(models.User).filter(models.User.email == form.username).first()
    if not user or not verify_password(form.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"user_id": user.id, "role": user.role})
    return {
        "token": token,
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}
    }


@app.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role
    }
