import os

EMBEDDING_MODEL = 'all-mpnet-base-v2'
EMBEDDING_WEIGHT = 0.50
SKILL_WEIGHT = 0.50
MIN_SCORE_THRESHOLD = 0.3
SUPPORTED_FORMATS = {'.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg'}

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = "meta-llama/llama-4-maverick"
