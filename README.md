# Resume Analyser

An AI-powered resume screening system that takes a folder of resumes and a job description, ranks candidates by fit, scores each resume for ATS compatibility, and generates personalized HR interview questions.

Built to handle real-world messiness — any resume format (PDF, DOCX, images, scanned documents), noisy OCR text, and inconsistent formatting.

---

## Features

- **Universal Resume Parsing** — Handles PDF, DOCX, TXT, and image files. Automatically falls back to OCR for scanned PDFs.
- **Entity Extraction** — Pulls name, email, phone, skills, education, and experience from any resume, with an LLM fallback for noisy OCR text.
- **JD-Based Ranking** — Paste a job description; the system auto-extracts required skills and ranks all resumes using a hybrid scoring approach.
- **Hybrid Scoring** — Combines embedding similarity, keyword matching, and LLM-based judgment for accurate, robust ranking.
- **ATS Compatibility Score** — 19 structural checks (sections, keywords, action verbs, quantified impact, readability via PyMuPDF layout analysis) validated against industry tools within 0-5 points.
- **HR Question Generation** — Generates personalized interview questions per candidate across four categories: Knowledge Verification, Experience Validation, Gap Assessment, and Confidence Check.
- **Web Interface** — React frontend with a dashboard for upload, ranking, ATS analysis, and interview prep.

---

## Architecture

```
Resume Files (PDF / DOCX / Image)  +  Job Description
                    |
        ┌───────────┴───────────┐
        │   INGESTION PIPELINE   │
        │  parser → extractor    │
        │  (text + entities)     │
        └───────────┬───────────┘
                    |
        ┌───────────┴───────────┐
        │   MATCHING PIPELINE    │
        │  embedder + scorer     │
        │  (embedding + keyword  │
        │   + LLM scoring)       │
        └───────────┬───────────┘
                    |
        ┌───────────┴───────────┐
        │  Ranked Candidates     │
        │  + ATS Scores          │
        │  + HR Questions        │
        └───────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python, FastAPI, Uvicorn |
| **PDF Parsing** | PyMuPDF |
| **DOCX Parsing** | python-docx |
| **OCR** | EasyOCR |
| **Embeddings** | sentence-transformers (all-mpnet-base-v2) |
| **Similarity** | NumPy (cosine similarity) |
| **LLM** | OpenRouter (Llama 4 Maverick) with local Ollama fallback |
| **Frontend** | React, Vite, Axios |

---

## Project Structure

```
resume-analyser/
├── src/
│   ├── parser.py          # Universal file parser (PDF, DOCX, image, OCR)
│   ├── extractor.py       # Entity extraction (name, email, skills, etc.)
│   ├── embedder.py        # Embedding generation + cosine similarity
│   ├── scorer.py          # Hybrid scoring (embedding + keyword + LLM)
│   ├── ats_scorer.py      # ATS compatibility scoring (19 checks)
│   ├── question_gen.py    # HR interview question generation
│   ├── llm.py             # Central LLM caller (OpenRouter + Ollama fallback)
│   └── config.py          # Model settings, weights, thresholds
├── frontend/              # React + Vite web interface
├── app.py                 # FastAPI backend (API endpoints)
├── cli.py                 # Command-line pipeline (for quick testing)
├── requirements.txt       # Python dependencies
└── README.md
```

---

## How Scoring Works

The final match score combines three signals:

| Signal | Weight | What It Measures |
|---|---|---|
| **Embedding similarity** | 30% | Overall semantic match between resume and JD |
| **Keyword match** | 20% | Exact JD skills found in the resume |
| **LLM scoring** | 50% | Contextual judgment, including transferable skills |

**Why hybrid?** Embeddings understand meaning but miss exact keywords and can't differentiate numbers ("5 years" vs "3 years"). Keyword matching is precise but misses synonyms. LLM scoring handles OCR typos and context. Together they produce reliable rankings.

Weights adjust dynamically — when a JD has many required skills (20+), the LLM signal is weighted higher to avoid dilution.

---

## ATS Scoring

The ATS scorer runs 19 checks grouped into:

- **Contact & Structure** — name/email/phone, standard sections, professional email, online profiles
- **Content Quality** — action verbs, quantified impact, buzzword detection, personal pronouns, description depth
- **Formatting** — file format, resume length, bullet points, verb tense consistency, text quality
- **ATS Readability** — PyMuPDF layout analysis to detect scanned PDFs, multi-column layouts, images, and tables (the actual issues real ATS systems flag)

Validated against EnhanceCV and ResumeWorded — scores match within 0-5 points.

---

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ (for frontend)
- Ollama (optional, for local LLM fallback)

### Backend

```bash
# Clone and enter the project
git clone https://github.com/devakajla/Resume-analyser.git
cd resume-analyser

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Add your OpenRouter API key
echo "OPENROUTER_API_KEY=your-key-here" > .env

# Run the backend
uvicorn app:app --reload
```

The API will be available at `http://127.0.0.1:8000` with interactive docs at `/docs`.

> **Note:** First run downloads ~500MB of ML models (embedding + OCR), cached for future use.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The web interface will be available at `http://localhost:5173`.

### Local LLM Fallback (Optional)

```bash
ollama pull qwen2.5-coder:7b
ollama serve
```

If OpenRouter is unavailable, the system automatically falls back to local Ollama.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload-resumes` | Upload one or more resume files |
| `POST` | `/set-jd` | Submit a job description (auto-extracts skills) |
| `POST` | `/rank` | Rank all resumes against the JD |
| `POST` | `/generate-questions/{filename}` | Generate HR questions for a candidate |
| `POST` | `/ats-score/{filename}` | Get ATS compatibility score |
| `GET` | `/status` | Check current system state |

---

## Usage

1. **Upload resumes** — drop a folder of resumes (any format)
2. **Paste a JD** — the system extracts required skills automatically
3. **Rank** — candidates are scored and sorted, shortlisted vs not-shortlisted
4. **Analyze** — click any candidate for ATS score or HR interview questions

---

## Challenges Solved

- **Scanned PDFs** — PyMuPDF returns empty text for image-based PDFs; solved by converting each page to an image and running OCR.
- **Spaced-out headers** — some resumes render headers as `S K I L L S`; a normalization step joins spaced letters before parsing.
- **OCR noise breaking keyword match** — added embedding-based and LLM-based matching so typos like "Lcarning" don't cause misses.
- **Skill dilution** — when a JD lists 50+ skills, matching a few gives a misleadingly low score; dynamic weighting shifts emphasis to the LLM signal.
- **Fair transferable-skill scoring** — calibrated the LLM prompt so a candidate from a related field gets a reasonable score instead of zero.

---

## Limitations & Future Work

- **In-memory storage** — data resets on server restart; a database (PostgreSQL) would add persistence.
- **English-only** — the embedding and OCR models are English-trained.
- **No authentication** — production use would need user auth and rate limiting.
- **Future:** candidate comparison view, resume feedback generation, pre-saved JD templates, Docker deployment.

---

*Built as a portfolio project to explore production-level GenAI — parsing, retrieval, hybrid scoring, and LLM integration beyond simple API calls.*
