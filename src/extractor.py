import re

def normalize_spaced_headers(text):
    """Fix spaced-out headers like 'S K I L L S' → 'SKILLS'"""
    def fix_spaced(match):
        return match.group(0).replace(' ', '')
    # Match lines where most characters are single letters separated by spaces
    text = re.sub(r'^([A-Z] ){2,}[A-Z]$', fix_spaced, text, flags=re.MULTILINE)
    return text


def extract_email(text):
    match = re.findall(r'[\w.+-]+@[\w-]+\.[\w.]+', text)
    return match[0] if match else None


def extract_phone(text):
    match = re.findall(r'[\+]?[\d\s\-\(\)]{10,15}', text)
    return match[0].strip() if match else None


def extract_name(text):
    """Extract name — skip headers, contact info, and company lines."""
    section_headers = {
        'experience', 'education', 'skills', 'projects', 'summary',
        'objective', 'certifications', 'achievements', 'contact',
        'technical skills', 'work history', 'professional experience'
    }
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    for line in lines:
        lower = line.lower()
        # Skip section headers
        if lower in section_headers:
            continue
        # Skip contact info lines
        if '@' in line or 'phone' in lower:
            continue
        # Skip company/location lines (contain |)
        if '|' in line:
            continue
        # Skip job descriptions (too long to be a name)
        if len(line) > 40:
            continue
        # Skip lines that start with action verbs (job descriptions)
        action_words = ['enter', 'show', 'use', 'list', 'manage', 'develop', 'create', 'led', 'built']
        if any(lower.startswith(w) for w in action_words):
            continue
        return line
    return None

def extract_skills(text):
    """Extract skills from a Skills section."""
    normalized = normalize_spaced_headers(text)
    
    skills_section = re.search(
        r'(?i)(?:core\s*technical\s*skills|technical\s*skills|skills|technologies|tech stack|key skills|competencies)[:\s]*\n([\s\S]*?)(?=\n(?:internship|experience|education|project|certification|professional|$))',
        normalized
    )
    if skills_section:
        raw = skills_section.group(1)
        lines = [line.strip() for line in raw.split('\n') if line.strip()]
        # Filter out category headers and keep actual skills
        category_words = ['testing expertise', 'automation &', 'tools &', 'automation and', 'tools and']
        skills = []
        for line in lines:
            if line.lower() in category_words or any(line.lower().startswith(c) for c in category_words):
                continue
            if len(line) < 50:
                skills.append(line)
        return skills
    return []

def extract_education(text):
    normalized = normalize_spaced_headers(text)
    edu_section = re.search(
        r'(?i)(?:education|academic|qualification)[:\s]*\n([\s\S]*?)(?=\n(?:key\s*strength|interest|certification|project|skill|$))',
        normalized
    )
    if edu_section:
        return edu_section.group(1).strip()
    return None


def extract_experience(text):
    normalized = normalize_spaced_headers(text)
    exp_section = re.search(
        r'(?i)(?:internship\s*experience|experience|work experience|employment|work history|professional experience)[:\s]*\n([\s\S]*?)(?=\n(?:education|key\s*automation|project|skill|certification|$))',
        normalized
    )
    if exp_section:
        return exp_section.group(1).strip()
    return None


def extract_entities(text):
    normalized = normalize_spaced_headers(text)
    skills = extract_skills(text)
    
    # LLM fallback if regex found no skills
    if not skills:
        skills = extract_skills_llm(text)
    
    return {
        'name': extract_name(normalized),
        'email': extract_email(text),
        'phone': extract_phone(text),
        'skills': skills,
        'education': extract_education(text),
        'experience': extract_experience(text),
    }


import requests


def extract_skills_llm(text):
    """Fallback: use LLM to extract skills when regex fails."""
    try:
        response = requests.post("http://localhost:11434/api/generate", json={
            "model": "qwen2.5-coder:7b",
            "prompt": f"""Extract the technical skills from this resume. Return ONLY a comma-separated list of skills, nothing else.

Resume:
{text[:2000]}

Skills (comma-separated):""",
            "stream": False,
            "options": {"temperature": 0.1, "num_predict": 200}
        })
        if response.status_code == 200:
            raw = response.json().get("response", "")
            skills = [s.strip().strip("-").strip("•") for s in raw.split(",")]
            return [s for s in skills if s and len(s) < 50]
    except:
        pass
    return []

# Quick test
if __name__ == "__main__":
    import sys
    sys.path.insert(0, '.')
    from src.parser import parse_resume

    if len(sys.argv) > 1:
        text = parse_resume(sys.argv[1])
        entities = extract_entities(text)

        print(f"Name: {entities['name']}")
        print(f"Email: {entities['email']}")
        print(f"Phone: {entities['phone']}")
        print(f"Skills: {entities['skills']}")
        print(f"\nEducation:\n{entities['education']}")
        print(f"\nExperience:\n{entities['experience']}")
