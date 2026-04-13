from __future__ import annotations
from typing import List, Dict, Optional
from pathlib import Path
import csv, requests
from bs4 import BeautifulSoup
from app.services.skill_extract import extract_skills

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
CSV_PATH = DATA_DIR / "jobs_sample.csv"
COURSES_PATH = DATA_DIR / "courses_catalog.csv"

def load_course_catalog() -> List[Dict]:
    rows = []
    if COURSES_PATH.exists():
        with COURSES_PATH.open('r', encoding='utf-8') as f:
            rdr = csv.DictReader(f)
            for r in rdr:
                r['skills'] = [x.strip() for x in (r.get('skills') or '').split('|') if x.strip()]
                rows.append(r)
    return rows

def _read_csv(limit: int = 50) -> List[Dict]:
    rows = []
    if not CSV_PATH.exists(): return rows
    with CSV_PATH.open('r', encoding='utf-8') as f:
        rdr = csv.DictReader(f)
        for i, r in enumerate(rdr):
            if i >= limit: break
            desc = r.get('description','')
            rows.append({
                'id': r.get('id') or str(i),
                'title': r.get('title',''),
                'company': r.get('company',''),
                'location': r.get('location',''),
                'description': desc,
                'skills': extract_skills(desc),
            })
    return rows

def _scrape_naukri(query: Optional[str], limit: int = 30) -> List[Dict]:
    try:
        q = (query or 'machine learning engineer').replace(' ', '-')
        url = f'https://www.naukri.com/{q}-jobs'
        html = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10).text
        soup = BeautifulSoup(html, 'html.parser')
        cards = soup.select(\"[data-test='job-listing']\") or soup.select('article')
        jobs = []
        for i, c in enumerate(cards[:limit]):
            title = (c.get_text(' ', strip=True) or '')[:120]
            desc = title
            jobs.append({'id': f'naukri-{i}', 'title': title[:60], 'company':'Naukri', 'location':'IN',
                         'description': desc, 'skills': extract_skills(desc)})
        return jobs
    except Exception:
        return []

def _scrape_linkedin(query: Optional[str], limit: int = 30) -> List[Dict]:
    try:
        q = (query or 'machine learning engineer').replace(' ', '%20')
        url = f'https://www.linkedin.com/jobs/search/?keywords={q}'
        html = requests.get(url, headers={'User-Agent':'Mozilla/5.0'}, timeout=10).text
        soup = BeautifulSoup(html, 'html.parser')
        cards = soup.select('ul.jobs-search__results-list li') or soup.select('li')
        jobs = []
        for i, c in enumerate(cards[:limit]):
            title = (c.get_text(' ', strip=True) or '')[:120]
            desc = title
            jobs.append({'id': f'li-{i}', 'title': title[:60], 'company':'LinkedIn', 'location':'—',
                         'description': desc, 'skills': extract_skills(desc)})
        return jobs
    except Exception:
        return []

def get_jobs(provider: str = 'csv', limit: int = 50, query: Optional[str] = None) -> List[Dict]:
    provider = (provider or 'csv').lower()
    if provider == 'csv':
        rows = _read_csv(limit=limit)
    elif provider == 'naukri':
        rows = _scrape_naukri(query=query, limit=limit) or _read_csv(limit=limit)
    elif provider == 'linkedin':
        rows = _scrape_linkedin(query=query, limit=limit) or _read_csv(limit=limit)
    else:
        rows = _read_csv(limit=limit)
    for i, r in enumerate(rows):
        r.setdefault('id', str(i))
        r.setdefault('title','Untitled')
        r.setdefault('company','')
        r.setdefault('location','')
        r.setdefault('description','')
        r.setdefault('skills', [])
    return rows
