import json
import re
from typing import List, Optional
from pydantic import BaseModel
from src.llm import call_llm


# ============ STEP 3: PYDANTIC SCHEMAS ============

class EducationItem(BaseModel):
    college: Optional[str] = None
    degree: Optional[str] = None
    duration: Optional[str] = None


class JobHistoryItem(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    duration_months: Optional[int] = None
    start: Optional[str] = None
    end: Optional[str] = None


class EmploymentGapItem(BaseModel):
    gap_months: Optional[int] = None
    between: Optional[str] = None


class CandidateInsights(BaseModel):
    """Strict schema definition for candidate timeline insights."""
    graduation_year: Optional[int] = None
    education: List[EducationItem] = []
    total_experience_years: Optional[float] = None
    current_status: Optional[str] = "unknown"
    jobs: List[JobHistoryItem] = []
    employment_gaps: List[EmploymentGapItem] = []
    job_switches: Optional[int] = 0
    avg_tenure_months: Optional[float] = None
    red_flags: List[str] = []


# ============ CORE FUNCTIONS ============

def extract_insights(resume_text):
    """Extract career insights and strictly validate schema using Pydantic."""

    prompt = f"""Analyze this resume and extract career timeline insights. Return ONLY valid JSON, nothing else.

RESUME:
{resume_text[:3500]}

Extract these fields following this exact JSON structure:
{{
    "graduation_year": integer or null,
    "education": [
        {{"college": "string", "degree": "string", "duration": "YYYY - YYYY"}}
    ],
    "total_experience_years": float or null,
    "current_status": "employed" / "student" / "fresher" / "between jobs" / "unknown",
    "jobs": [
        {{"company": "string", "role": "string", "duration_months": integer, "start": "MM/YYYY", "end": "MM/YYYY or present"}}
    ],
    "employment_gaps": [
        {{"gap_months": integer, "between": "job A and job B"}}
    ],
    "job_switches": integer,
    "avg_tenure_months": float or null,
    "red_flags": ["string", "string"]
}}

Return JSON:"""

    raw = call_llm(prompt, max_tokens=800, temperature=0.1)

    try:
        # Find and isolate the JSON block from LLM output
        json_match = re.search(r'\{[\s\S]*\}', raw)
        if json_match:
            data = json.loads(json_match.group(0))
            
            # Concept Applied: Pydantic Validation
            # This parses, checks datatypes, and populates missing fields with default values
            validated = CandidateInsights(**data)
            return validated.dict()
    except Exception as e:
        # Falls back cleanly to default empty structure if parsing or validation fails
        print(f"Validation warning: {str(e)}")

    # Return default empty dict schema using Pydantic defaults
    return CandidateInsights().dict()


def generate_summary(resume_text, job_title, job_skills, ats_score, compatibility, matched_skills, missing_skills):
    """Generate a short recruiter-facing summary to help HR quickly shortlist."""

    prompt = f"""You are a recruiter assistant. Write a SHORT summary (3-4 sentences) of this candidate for the role of "{job_title}".

The summary must help HR quickly decide whether to shortlist and what to ask in the screening round. Cover:
- The candidate's relevant experience and background
- Their key strengths for this specific role
- Any gaps or concerns worth probing in screening

Be factual and concise. Write in third person. No headings, no bullet points, just plain sentences.

CANDIDATE DATA:
- ATS score: {ats_score}/100
- Role match: {round(compatibility * 100)}%
- Matched skills: {', '.join(matched_skills) if matched_skills else 'none'}
- Missing skills: {', '.join(missing_skills) if missing_skills else 'none'}

RESUME:
{resume_text[:3000]}

Summary:"""

    raw = call_llm(prompt, max_tokens=250, temperature=0.3)
    return raw.strip() if raw else ""