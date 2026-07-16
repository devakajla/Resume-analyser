import re
from src.extractor import extract_entities
import fitz
import spacy

try:
    nlp = spacy.load("en_core_web_lg")
except OSError:
    nlp = None


def check_ats_readability(file_path):
    """Analyze the actual PDF layout for ATS compatibility."""
    issues = []
    score = 15

    ext = file_path.lower().split('.')[-1]

    # Non-PDF formats
    if ext in ('png', 'jpg', 'jpeg'):
        return 3, ["Image file — ATS cannot parse images at all. Convert to PDF/DOCX"]
    if ext == 'docx':
        return 13, ["DOCX format — generally ATS-friendly"]
    if ext != 'pdf':
        return 8, ["Non-standard format"]

    try:
        doc = fitz.open(file_path)

        # 1. Check if scanned (no text layer)
        total_text = ""
        for page in doc:
            total_text += page.get_text()
        if len(total_text.strip()) < 50:
            doc.close()
            return 2, ["Scanned/image PDF — no text layer. ATS cannot read this. Use a text-based PDF"]

        # 2. Check for images (graphics that ATS ignores)
        image_count = 0
        for page in doc:
            image_count += len(page.get_images())
        if image_count > 3:
            score -= 3
            issues.append(f"{image_count} images detected — ATS ignores images, keep content as text")

        # 3. Check for multi-column layout
        page = doc[0]
        blocks = page.get_text("blocks")
        if blocks:
            # Get x-positions of text blocks
            x_positions = [round(b[0]) for b in blocks if b[4].strip()]
            unique_left_margins = len(set(x_positions))
            # Many different left margins = likely multi-column
            if unique_left_margins > 4:
                score -= 4
                issues.append("Multi-column layout detected — ATS may read columns in wrong order. Use single-column")

        # 4. Check for tables (detected via block alignment)
        page_width = page.rect.width
        wide_blocks = sum(1 for b in blocks if (b[2] - b[0]) > page_width * 0.7)
        if wide_blocks < 2 and len(blocks) > 10:
            score -= 2
            issues.append("Possible table/box layout — ATS struggles with tables, use plain text")

        # 5. Page count
        if len(doc) > 2:
            score -= 2
            issues.append(f"{len(doc)} pages — keep resume to 1-2 pages")

        doc.close()

        if not issues:
            issues.append("Clean single-column text layout — ATS-friendly")

    except Exception as e:
        return 8, [f"Could not analyze layout: {str(e)}"]

    return max(score, 0), issues

def check_contact_info(entities):
    score = 0
    details = []
    if entities.get('name'):
        score += 4
        details.append("Name found")
    else:
        details.append("Name missing — add your full name at the top")
    if entities.get('email'):
        score += 3
        details.append("Email found")
    else:
        details.append("Email missing — recruiters can't contact you")
    if entities.get('phone'):
        score += 3
        details.append("Phone found")
    else:
        details.append("Phone missing — add a phone number")
    return score, details


def check_sections(text):
    score = 0
    details = []
    normalized = re.sub(r'(?<=\S) (?=\S)', '', text.upper())
    sections = {
        'Experience': r'(EXPERIENCE|WORK HISTORY|EMPLOYMENT|INTERNSHIP)',
        'Education': r'(EDUCATION|ACADEMIC|QUALIFICATION|DEGREE)',
        'Skills': r'(SKILLS|TECHNICAL SKILLS|CORE SKILLS|COMPETENCIES|TECHNOLOGIES)',
        'Summary': r'(SUMMARY|OBJECTIVE|PROFILE|ABOUT)',
        'Projects': r'(PROJECT|KEY PROJECT|PERSONAL PROJECT)',
    }
    for name, pattern in sections.items():
        if re.search(pattern, normalized):
            score += 2
            details.append(f"{name} section found")
        else:
            details.append(f"{name} section missing — add a {name} section")
    return score, details


def check_keyword_match(text, jd_skills):
    if not jd_skills:
        return 0, ["No JD skills to compare — set JD first"]
    text_lower = text.lower()
    matched = [s for s in jd_skills if s.lower() in text_lower]
    pct = len(matched) / len(jd_skills)
    if pct >= 0.7:
        score = 15
    elif pct >= 0.5:
        score = 11
    elif pct >= 0.3:
        score = 8
    elif pct >= 0.1:
        score = 4
    else:
        score = 1
    details = [f"{len(matched)}/{len(jd_skills)} JD keywords found ({pct*100:.0f}%)"]
    if pct < 0.5:
        missing = [s for s in jd_skills if s.lower() not in text_lower][:5]
        details.append(f"Consider adding: {', '.join(missing)}")
    return score, details


def check_file_format(file_path):
    ext = file_path.lower().split('.')[-1]
    if ext in ('pdf', 'docx'):
        return 5, ["ATS-friendly format"]
    elif ext == 'txt':
        return 3, ["Plain text — parseable but no formatting"]
    else:
        return 1, ["Image format — not ATS-friendly, convert to PDF"]


def check_length(text):
    words = len(text.split())
    if 300 <= words <= 700:
        return 8, [f"Good length ({words} words)"]
    elif 200 <= words < 300:
        return 5, [f"Short ({words} words) — aim for 300-700 words"]
    elif 700 < words <= 1000:
        return 5, [f"Long ({words} words) — trim to 1-2 pages"]
    elif words > 1000:
        return 2, [f"Too long ({words} words) — keep under 2 pages"]
    else:
        return 1, [f"Very short ({words} words) — add more content"]


def check_bullet_points(text):
    bullets = len(re.findall(r'[•\-\*▸►➤]', text))
    if bullets >= 12:
        return 8, [f"{bullets} bullet points — well structured"]
    elif bullets >= 8:
        return 6, [f"{bullets} bullet points — good, add more"]
    elif bullets >= 4:
        return 4, [f"{bullets} bullet points — needs more"]
    else:
        return 1, [f"Only {bullets} bullet points — use bullets for all achievements"]


def check_action_verbs(text):
    # Roots (Base forms) of action verbs
    action_roots = {
        'lead', 'build', 'develop', 'design', 'implement', 'manage',
        'create', 'improve', 'increase', 'reduce', 'achieve', 'deliver',
        'launch', 'optimize', 'automate', 'analyze', 'coordinate',
        'establish', 'execute', 'generate', 'resolve', 'streamline',
        'collaborate', 'spearhead', 'architect', 'mentor', 'deploy'
    }
    
    if nlp:
        doc = nlp(text.lower())
        found = set()
        for token in doc:
            # Word should be classified as a Verb and its base form (lemma) in action_roots
            if token.pos_ in ("VERB", "AUX") and token.lemma_ in action_roots:
                found.add(token.lemma_)
        unique_verbs = len(found)
    else:
        # Safe fallback if spaCy is not available
        action_verbs = [
            'led', 'built', 'developed', 'designed', 'implemented', 'managed',
            'created', 'improved', 'increased', 'reduced', 'achieved', 'delivered',
            'launched', 'optimized', 'automated', 'analyzed', 'coordinated',
            'established', 'executed', 'generated', 'resolved', 'streamlined',
            'collaborated', 'spearheaded', 'architected', 'mentored', 'deployed'
        ]
        text_lower = text.lower()
        found = [v for v in action_verbs if v in text_lower]
        unique_verbs = len(set(found))

    if unique_verbs >= 8:
        return 8, [f"{unique_verbs} unique action verbs — strong"]
    elif unique_verbs >= 5:
        return 5, [f"{unique_verbs} unique action verbs — add variety"]
    elif unique_verbs >= 3:
        return 3, [f"{unique_verbs} unique action verbs — needs more impact language"]
    else:
        return 1, [f"Only {unique_verbs} action verbs — start bullets with Led, Built, Improved"]


def check_quantifiable_impact(text):
    numbers = re.findall(r'\d+[%+]|\d+\s*(?:users|clients|projects|team|members|months|years|applications|modules|test cases)', text.lower())
    percentages = re.findall(r'\d+\s*%', text)
    total_metrics = len(numbers) + len(percentages)
    if total_metrics >= 6:
        return 8, [f"{total_metrics} quantified achievements — great impact"]
    elif total_metrics >= 3:
        return 5, [f"{total_metrics} metrics — add more numbers"]
    elif total_metrics >= 1:
        return 3, [f"{total_metrics} metrics — add numbers like 'Reduced by 40%'"]
    else:
        return 1, ["No quantified impact — add numbers like %, $, team size"]


def check_buzzwords(text):
    buzzwords = [
        'hardworking', 'team player', 'go-getter', 'self-motivated',
        'detail-oriented', 'results-driven', 'passionate', 'dynamic',
        'synergy', 'think outside the box', 'fast learner', 'proactive'
    ]
    text_lower = text.lower()
    found = [b for b in buzzwords if b in text_lower]
    if len(found) == 0:
        return 7, ["No generic buzzwords — good"]
    elif len(found) <= 2:
        return 4, [f"Buzzwords found: {', '.join(found)} — replace with specifics"]
    else:
        return 1, [f"{len(found)} buzzwords: {', '.join(found[:3])}... — remove all"]


def check_personal_pronouns(text):
    pronouns = len(re.findall(r'\b(I|me|my|myself)\b', text))
    if pronouns == 0:
        return 5, ["No personal pronouns — professional"]
    elif pronouns <= 3:
        return 3, [f"{pronouns} pronouns (I/me/my) — remove them"]
    else:
        return 1, [f"{pronouns} pronouns — resumes should avoid I/me/my"]


def check_text_quality(text):
    total = len(text)
    if total == 0:
        return 0, ["Empty text"]
    clean_chars = len(re.findall(r'[a-zA-Z0-9\s,.\-@+()/:;]', text))
    ratio = clean_chars / total
    if ratio >= 0.92:
        return 6, [f"Clean text ({ratio*100:.0f}% readable)"]
    elif ratio >= 0.8:
        return 4, [f"Some noise ({ratio*100:.0f}% readable)"]
    else:
        return 2, [f"Noisy text ({ratio*100:.0f}% readable)"]


def check_email_professional(email):
    if not email:
        return 0, ["No email found"]
    unprofessional = ['cool', 'sexy', 'king', 'queen', 'baby', 'hotboy', 'gamer', 'ninja', '69', '420']
    email_lower = email.lower()
    if any(word in email_lower for word in unprofessional):
        return 1, [f"Unprofessional email: {email}"]
    elif email_lower.endswith(('.edu', '.ac.in')):
        return 4, [f"Academic email — professional"]
    else:
        return 3, [f"Email: {email}"]


def check_links(text):
    score = 0
    details = []
    text_lower = text.lower()
    if 'linkedin' in text_lower:
        score += 2
        details.append("LinkedIn found")
    else:
        details.append("No LinkedIn — add profile link")
    if 'github' in text_lower:
        score += 2
        details.append("GitHub found")
    else:
        details.append("No GitHub — add if you have projects")
    if any(w in text_lower for w in ['portfolio', '.com', '.io', '.dev']):
        score += 1
        details.append("Portfolio link found")
    if not details or score == 0:
        details = ["No online profiles — add LinkedIn and GitHub"]
    return score, details


def check_date_consistency(text):
    date_patterns = re.findall(r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*\d{0,4}|\d{4}\s*[-]\s*(?:\d{4}|present|current)|\d{2}/\d{4}', text, re.IGNORECASE)
    if len(date_patterns) >= 4:
        return 4, [f"{len(date_patterns)} dates found — clear timeline"]
    elif len(date_patterns) >= 2:
        return 2, [f"Only {len(date_patterns)} dates — add dates to all roles"]
    else:
        return 0, ["No dates found — add start/end dates"]


def check_certifications(text):
    cert_keywords = ['certified', 'certification', 'certificate', 'aws certified',
                     'istqb', 'pmp', 'scrum master', 'coursera', 'udemy', 'credential']
    text_lower = text.lower()
    found = [c for c in cert_keywords if c in text_lower]
    if found:
        return 3, [f"Certifications: {', '.join(found[:3])}"]
    else:
        return 1, ["No certifications — add if you have any"]


def check_description_depth(text):
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    medium_lines = sum(1 for l in lines if 40 <= len(l) < 100)
    long_lines = sum(1 for l in lines if len(l) >= 100)
    if long_lines >= 5 and medium_lines >= 3:
        return 5, [f"Good depth — {long_lines} detailed descriptions"]
    elif long_lines >= 3:
        return 3, [f"Moderate depth — expand more descriptions"]
    elif medium_lines >= 3:
        return 2, [f"Brief descriptions — add specific details"]
    else:
        return 1, ["Descriptions too brief — expand with achievements"]


def check_verb_tenses(text):
    present = len(re.findall(r'\b(manage|lead|develop|create|design|build|coordinate|analyze|execute|maintain)\b', text.lower()))
    past = len(re.findall(r'\b(managed|led|developed|created|designed|built|coordinated|analyzed|executed|maintained)\b', text.lower()))
    total = present + past
    if total == 0:
        return 2, ["No strong verbs detected"]
    dominant = max(present, past)
    consistency = dominant / total
    if consistency >= 0.8:
        return 5, [f"Consistent verb tenses ({consistency*100:.0f}% uniform)"]
    elif consistency >= 0.6:
        return 3, [f"Mixed tenses — keep current job present, past jobs past"]
    else:
        return 1, ["Inconsistent tenses — standardize throughout"]


def calculate_ats_score(text, file_path, jd_skills=None, entities=None):
    if entities is None:
        entities = extract_entities(text)
    
    

    checks = []

    s1, d1 = check_contact_info(entities)
    checks.append({"category": "Contact Info", "score": s1, "max": 10, "details": d1})

    s2, d2 = check_sections(text)
    checks.append({"category": "Standard Sections", "score": s2, "max": 10, "details": d2})

    s3, d3 = check_keyword_match(text, jd_skills or [])
    checks.append({"category": "JD Keyword Match", "score": s3, "max": 15, "details": d3})

    s4, d4 = check_file_format(file_path)
    checks.append({"category": "File Format", "score": s4, "max": 5, "details": d4})

    s5, d5 = check_length(text)
    checks.append({"category": "Resume Length", "score": s5, "max": 8, "details": d5})

    s6, d6 = check_bullet_points(text)
    checks.append({"category": "Bullet Points", "score": s6, "max": 8, "details": d6})

    s7, d7 = check_action_verbs(text)
    checks.append({"category": "Action Verbs", "score": s7, "max": 8, "details": d7})

    s8, d8 = check_quantifiable_impact(text)
    checks.append({"category": "Quantified Impact", "score": s8, "max": 8, "details": d8})

    s9, d9 = check_buzzwords(text)
    checks.append({"category": "Buzzword Check", "score": s9, "max": 7, "details": d9})

    s10, d10 = check_personal_pronouns(text)
    checks.append({"category": "Personal Pronouns", "score": s10, "max": 5, "details": d10})

    s11, d11 = check_text_quality(text)
    checks.append({"category": "Text Quality", "score": s11, "max": 6, "details": d11})

    s_read, d_read = check_ats_readability(file_path)
    checks.append({"category": "ATS Readability", "score": s_read, "max": 15, "details": d_read})
    
    skills_count = len(entities.get('skills', []))
    if skills_count >= 10:
        s12, d12 = 8, [f"{skills_count} skills listed — comprehensive"]
    elif skills_count >= 5:
        s12, d12 = 5, [f"{skills_count} skills — add more"]
    elif skills_count > 0:
        s12, d12 = 3, [f"Only {skills_count} skills — aim for 10+"]
    else:
        s12, d12 = 1, ["No skills section — add a skills section"]
    checks.append({"category": "Skills Listed", "score": s12, "max": 10, "details": d12})

    s_email, d_email = check_email_professional(entities.get('email'))
    checks.append({"category": "Professional Email", "score": s_email, "max": 4, "details": d_email})

    s_links, d_links = check_links(text)
    checks.append({"category": "Online Profiles", "score": s_links, "max": 5, "details": d_links})

    s_dates, d_dates = check_date_consistency(text)
    checks.append({"category": "Date Consistency", "score": s_dates, "max": 4, "details": d_dates})

    s_certs, d_certs = check_certifications(text)
    checks.append({"category": "Certifications", "score": s_certs, "max": 3, "details": d_certs})

    s_depth, d_depth = check_description_depth(text)
    checks.append({"category": "Description Depth", "score": s_depth, "max": 5, "details": d_depth})

    s_tense, d_tense = check_verb_tenses(text)
    checks.append({"category": "Verb Tense Consistency", "score": s_tense, "max": 5, "details": d_tense})

    total = sum(c["score"] for c in checks)
    max_total = sum(c["max"] for c in checks)
    structural_pct = (total / max_total) * 100

    if structural_pct >= 80:
        grade = "Excellent"
    elif structural_pct >= 65:
        grade = "Good"
    elif structural_pct >= 50:
        grade = "Needs Improvement"
    else:
        grade = "Poor"

    fixes = []
    for c in sorted(checks, key=lambda x: x["score"] / x["max"]):
        if c["score"] < c["max"] * 0.7:
            fixes.append({"category": c["category"], "suggestion": c["details"][-1]})
        
    combined_score = int(structural_pct)

    return {
        "total_score": combined_score,
        "max_score": 100,
        "structural_score": int(structural_pct),
        "grade": grade,
        "checks": checks,
        "top_fixes": fixes[:5]
    }

