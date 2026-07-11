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


def _clean_skill_list(items):
    """Filter out LLM preamble/junk and keep only real skill names."""
    # phrases that signal the LLM wrote a sentence instead of a skill
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
        # if item contains a colon, keep only the part after it (e.g. "resume: Python" -> "Python")
        if ":" in s:
            s = s.split(":")[-1].strip()
        if not s:
            continue
        low = s.lower()
        # drop empty, too-long, or sentence-like items
        if len(s) > 40:
            continue
        # drop if it exactly matches or is a junk phrase
        if low in junk_phrases:
            continue
        if any(low == p or low.startswith(p + " ") for p in junk_phrases):
            continue
        # drop multi-word items that look like sentences (4+ words)
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
        # Filter out category headers and keep actual skills
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
        # strip a leading "Skills:" style prefix if the model added one
        raw = re.sub(r'(?is)^.*?:\s*', '', raw, count=1) if ':' in raw.split(',')[0] else raw
        items = raw.split(",")
        return _clean_skill_list(items)
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

