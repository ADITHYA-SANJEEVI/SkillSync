def match_skills(resume_skills: list[str], market_skills: list[str]):
    rs = {s.lower().strip() for s in (resume_skills or [])}
    ms = {s.lower().strip() for s in (market_skills or [])}
    overlap = sorted(rs & ms)
    missing = sorted(ms - rs)
    base = len(ms) if ms else 1
    suitability = round(100.0 * (len(overlap) / base), 2)
    return overlap, missing, suitability
