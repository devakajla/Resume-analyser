import re


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
    skills_section = re.search(
        r'(?i)(?:skills|technical skills|technologies|tech stack)[:\s]*\n([\s\S]*?)(?:\n\n|\n[A-Z])',
        text
    )
    if skills_section:
        raw = skills_section.group(1)
        # Split by common delimiters
        skills = re.split(r'[,|•·\n]', raw)
        skills = [s.strip().strip('-').strip('*').strip() for s in skills]
        return [s for s in skills if s and len(s) < 50]
    return []


def extract_education(text):
    """Extract education section."""
    edu_section = re.search(
        r'(?i)(?:education|academic|qualification)[:\s]*\n([\s\S]*?)(?:\n\n|\n[A-Z])',
        text
    )
    if edu_section:
        return edu_section.group(1).strip()
    return None


def extract_experience(text):
    """Extract experience section."""
    exp_section = re.search(
        r'(?i)(?:experience|work experience|employment|work history)[:\s]*\n([\s\S]*?)(?:\n\n(?:education|skills|projects|certifications)|$)',
        text
    )
    if exp_section:
        return exp_section.group(1).strip()
    return None


def extract_entities(text):
    """Main function — extract all structured info from resume text."""
    return {
        'name': extract_name(text),
        'email': extract_email(text),
        'phone': extract_phone(text),
        'skills': extract_skills(text),
        'education': extract_education(text),
        'experience': extract_experience(text),
    }


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
