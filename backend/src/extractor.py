import re
import spacy

try:
    nlp = spacy.load("en_core_web_lg")
except OSError:
    nlp = None


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
    """Extract name using reliable rules first, then fallback to spaCy NER."""
    # 1. Rule-Based Check (Header lines filter - Highly reliable for resume tops)
    section_headers = {
        'experience', 'education', 'skills', 'projects', 'summary',
        'objective', 'certifications', 'achievements', 'contact',
        'technical skills', 'work history', 'professional experience'
    }
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    for line in lines:
        lower = line.lower()
        if lower in section_headers:
            continue
        if '@' in line or 'phone' in lower:
            continue
        # Name should not contain layout pipes '|' or slashes '/' (skips location strings)
        if '|' in line or '/' in line:
            continue
        # Name should not contain any numbers/digits
        if any(char.isdigit() for char in line):
            continue
        if len(line) > 40:
            continue
        action_words = ['enter', 'show', 'use', 'list', 'manage', 'develop', 'create', 'led', 'built']
        if any(lower.startswith(w) for w in action_words):
            continue
        
        # If we find a clean line at the top, it is 99% the candidate's name!
        return line

    # 2. Fallback to spaCy NER if rules found nothing
    if nlp:
        doc = nlp(text[:500])
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                name = ent.text.strip().replace("\n", " ")
                # Extra checks to avoid location/layout junk leaks
                if 1 < len(name.split()) <= 4 and '/' not in name and '|' not in name:
                    return name
    return None


def _clean_skill_list(items):
    """Filter out LLM preamble/junk and keep only real skill names."""
    junk_phrases = [
        'here is', 'here are', 'the list', 'list of', 'technical skills',
        'programming languages', 'frameworks', 'libraries', 'platforms',
        'methodologies', 'technologies', 'mentioned in', 'the resume',
        'tools', 'and technologies', 'following', 'skills:',
    ]
    cleaned = []
    seen = set()
    for raw in items:
        s = raw.strip().strip("-").strip("•").strip("*").strip(".").strip()
        if ":" in s:
            s = s.split(":")[-1].strip()
        if not s:
            continue
        low = s.lower()
        if len(s) > 40:
            continue
        if low in junk_phrases:
            continue
        if any(low == p or low.startswith(p + " ") for p in junk_phrases):
            continue
        if len(s.split()) >= 5:
            continue
        if low in seen:
            continue
        seen.add(low)
        cleaned.append(s)
    return cleaned


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
        category_words = ['testing expertise', 'automation &', 'tools &', 'automation and', 'tools and']
        skills = []
        for line in lines:
            if line.lower() in category_words or any(line.lower().startswith(c) for c in category_words):
                continue
            if len(line) < 50:
                skills.append(line)
        return _clean_skill_list(skills)
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


from src.llm import call_llm


def extract_skills_llm(text):
    raw = call_llm(
        prompt=f"""Extract the technical skills from the resume below.

STRICT RULES:
- Output ONLY the skill names, separated by commas.
- Do NOT write any introduction, heading, sentence, or explanation.
- Do NOT include words like "here is", "the list", "technical skills", "tools", "frameworks".
- Each item must be a single skill name (e.g. Python, React, Docker, AWS).
- No duplicates.

Resume:
{text[:4000]}

Skills (comma-separated only):""",
        max_tokens=300,
        temperature=0.1
    )

    if raw:
        raw = re.sub(r'(?is)^.*?:\s*', '', raw, count=1) if ':' in raw.split(',')[0] else raw
        items = raw.split(",")
        return _clean_skill_list(items)
    return []


def is_valid_resume(text):
    """Validate if the extracted text belongs to a real resume with min 200 words."""
    # 1. Minimum Word count check (Strictly 200 words minimum)
    words = text.split()
    if len(words) < 200:
        return False, f"Invalid length (Document has only {len(words)} words. A valid resume must contain at least 200 words)"

    # 2. Contact details check (Must have email or phone)
    email = extract_email(text)
    phone = extract_phone(text)
    if not email and not phone:
        return False, "Missing contact details (No Email or Phone number found)"

    # 3. Resume Sections check (Must contain at least 2 standard section terms)
    resume_keywords = [
        'experience', 'education', 'skills', 'projects', 'summary',
        'objective', 'certifications', 'achievements', 'employment',
        'work history', 'technical skills', 'professional experience'
    ]
    text_lower = text.lower()
    matched_sections = sum(1 for kw in resume_keywords if kw in text_lower)
    
    if matched_sections < 2:
        return False, "Not a resume format (Standard sections like Experience, Education, or Skills are missing)"

    return True, "Valid resume"


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