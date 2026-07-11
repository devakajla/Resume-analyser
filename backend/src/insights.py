import json
import re
from src.llm import call_llm

def extract_insights(resume_text):
    """Extract career insights: graduation, gaps, job durations, total experience."""

    prompt = f"""Analyze this resume and extract career timeline insights. Return ONLY valid JSON, nothing else.

RESUME:
{resume_text[:3500]}

Extract these fields:
- education: array of degrees, each with: {{"college": name, "degree": degree name, "duration": "YYYY - YYYY"}}
- total_experience_years: total years of professional work experience (number, estimate if needed)
- current_status: "employed", "student", "fresher", or "between jobs"
- jobs: array of past jobs, each with: {{"company": name, "role": title, "duration_months": number, "start": "MM/YYYY", "end": "MM/YYYY or present"}}
- employment_gaps: array of gaps, each with: {{"gap_months": number, "between": "job A and job B"}}
- job_switches: number of times they changed jobs
- avg_tenure_months: average months per job
- red_flags: array of concerns like "frequent job switching", "long employment gap", "no work experience"

Return JSON:"""

    raw = call_llm(prompt, max_tokens=800, temperature=0.1)

    # Parse JSON from response
    try:
        # Find JSON block
        json_match = re.search(r'\{[\s\S]*\}', raw)
        if json_match:
            data = json.loads(json_match.group(0))
            return data
    except Exception:
        pass

    return {
        "graduation_year": None,
        "education":[],
        "total_experience_years": None,
        "current_status": "unknown",
        "jobs": [],
        "employment_gaps": [],
        "job_switches": 0,
        "avg_tenure_months": None,
        "red_flags": []
    }
def generate_summary(resume_text, job_title, job_skills, ats_score, compatibility, matched_skills, missing_skills):
    """Generate a short recruiter-facing summary to help HR shortlist and screen."""

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
