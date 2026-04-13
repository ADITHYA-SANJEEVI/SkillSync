import json
from pathlib import Path

def _load_courses():
    # Preferred location: backend/app/data/courses.json
    here = Path(__file__).parent
    path = here / "data" / "courses.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))

    # Fallback: frontend/courses.json (old location)
    root = here.resolve().parents[2]  # .../job-gap-fsd
    alt = root / "frontend" / "courses.json"
    if alt.exists():
        return json.loads(alt.read_text(encoding="utf-8"))

    # If neither exists, ship a tiny default list
    return [
        {"title": "Intro to SQL", "provider": "freecodecamp", "url": "https://www.freecodecamp.org/",
         "tags": ["sql"]},
        {"title": "Pandas Basics", "provider": "Kaggle", "url": "https://www.kaggle.com/learn/pandas",
         "tags": ["pandas", "python"]},
        {"title": "AWS Cloud Practitioner", "provider": "AWS", "url": "https://www.aws.training/",
         "tags": ["aws", "cloud"]},
    ]

COURSES = _load_courses()

def recommend_courses(missing_skills: list[str], limit: int = 10):
    ms = {s.lower().strip() for s in (missing_skills or [])}
    out = []
    for c in COURSES:
        tags = {t.lower().strip() for t in c.get("tags", [])}
        if ms & tags:
            out.append(c)
            if len(out) >= limit:
                break
    return out
