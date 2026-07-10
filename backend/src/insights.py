import json
import re
from src.llm import call_llm

def extract_insights(resume_text):
    """Extract career insights: graduation, gaps, job durations, total experience."""

    prompt = f"""Analyze this resume and extract career timeline insights. Return ONLY valid JSON, nothing else.

RESUME:
{resume_text[:3500]}

Extract these fields:
- graduation_year: the year they completed their most recent/relevant degree (number or null)
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
        "total_experience_years": None,
        "current_status": "unknown",
        "jobs": [],
        "employment_gaps": [],
        "job_switches": 0,
        "avg_tenure_months": None,
        "red_flags": []
    }
