import json
import os
import re
import time
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests


ORCID = os.getenv("ORCID", "").strip()            
MAILTO = os.getenv("MAILTO", "").strip()          

if not ORCID:
    raise SystemExit(
        "ERROR: ORCID env var required (e.g. 0000-0000-0000-0000)")

S = requests.Session()
S.headers["User-Agent"] = "github-pages-research-site"


def get_json(url: str, params: Optional[Dict[str, Any]] = None, retries: int = 8) -> Dict[str, Any]:
    """GET JSON with basic retry/backoff for rate limits."""
    for i in range(retries):
        r = S.get(url, params=params, timeout=60)
        if r.status_code == 429:
            time.sleep(2 * (i + 1))
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError(f"Failed after retries: {url}")


def norm_title(s: Optional[str]) -> str:
    s = (s or "").lower()
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"[^\w\s]", "", s)  # remove punctuation
    return s


def first_year_from_date(date_str: Optional[str]) -> Optional[int]:
    if not date_str or len(date_str) < 4:
        return None
    y = date_str[:4]
    return int(y) if y.isdigit() else None


def compute_h_index(cites: List[int]) -> int:
    cites = sorted([int(c) for c in cites if c is not None], reverse=True)
    h = 0
    for i, c in enumerate(cites, start=1):
        if c >= i:
            h = i
        else:
            break
    return h


def iter_hits(first_page: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    """Yield INSPIRE 'metadata' dicts across pagination."""
    page = first_page
    while True:
        hits = ((page.get("hits") or {}).get("hits")) or []
        for h in hits:
            yield h.get("metadata") or {}

        next_url = ((page.get("links") or {}).get("next"))
        if not next_url:
            break
        page = get_json(next_url)


def choose_best_venue(metadata: Dict[str, Any], journal: Optional[str], arxiv_id: Optional[str]) -> str:
    doc_types = set(metadata.get("document_type") or [])
    if journal:
        return journal
    if arxiv_id:
        return "arXiv"
    if "thesis" in doc_types:
        return "Thesis (INSPIRE)"
    return "INSPIRE"


def choose_best_url(doi: Optional[str], arxiv_id: Optional[str], recid: Optional[int]) -> str:
    if doi:
        return f"https://doi.org/{doi}"
    if arxiv_id:
        return f"https://arxiv.org/abs/{arxiv_id}"
    if recid:
        return f"https://inspirehep.net/literature/{recid}"
    return ""


def dedupe_key(p: Dict[str, Any]) -> Tuple[str, Any, Any]:
    if p.get("doi"):
        return ("doi", str(p["doi"]).lower(), None)
    if p.get("arxiv"):
        return ("arxiv", str(p["arxiv"]).lower(), None)
    if p.get("inspire_recid"):
        return ("recid", str(p["inspire_recid"]), None)
    return ("ty", norm_title(p.get("title")), p.get("year"))


def sort_key(p: Dict[str, Any]) -> Tuple[str, int]:
    d = p.get("publication_date") or ""
    y = int(p.get("year") or 0)
    return (d, y)


# -----------------------------
# 1) Resolve INSPIRE author from ORCID
# -----------------------------
author = get_json(f"https://inspirehep.net/api/orcid/{ORCID}")
metadata = author.get("metadata") or {}

ids = metadata.get("ids") or []
bai = None
for x in ids:
    if x.get("schema") == "INSPIRE BAI":
        bai = x.get("value")
        break

control_number = metadata.get("control_number")

if not bai and not control_number:
    raise SystemExit(
        "ERROR: Could not find INSPIRE BAI or control_number in ORCID author record.")

# INSPIRE search query:
# Preferred: q = "a <BAI>" (curated author identity)
# Fallback: refer to author record url
q = f"a {bai}" if bai else f"authors.record:$ref:\"https://inspirehep.net/api/authors/{control_number}\""

# -----------------------------
# 2) Query literature for this author
# -----------------------------
params = {
    "q": q,
    "sort": "mostrecent",
    "size": 1000,
    "fields": ",".join([
        "control_number",
        "titles.title",
        "authors.full_name",
        "citation_count",
        "dois.value",
        "arxiv_eprints.value",
        "publication_info.journal_title",
        "publication_info.year",
        "earliest_date",
        "preprint_date",
        "document_type",
    ])
}

if MAILTO:
    params["mailto"] = MAILTO

first_page = get_json("https://inspirehep.net/api/literature", params=params)

raw_items: List[Dict[str, Any]] = []
for m in iter_hits(first_page):
    recid = m.get("control_number")

    titles = m.get("titles") or []
    title = (titles[0].get("title") if titles else None) or "Untitled"

    authors_list = m.get("authors") or []
    authors = ", ".join([(a.get("full_name") or "").strip()
                        for a in authors_list if a.get("full_name")])

    citation_count = int(m.get("citation_count") or 0)

    dois = m.get("dois") or []
    doi = (dois[0].get("value") if dois else None)

    arx = m.get("arxiv_eprints") or []
    arxiv_id = (arx[0].get("value") if arx else None)

    pubinfo = m.get("publication_info") or []
    journal = None
    pub_year = None
    if pubinfo:
        journal = pubinfo[0].get("journal_title")
        pub_year = pubinfo[0].get("year")

    earliest_date = m.get("earliest_date") or m.get("preprint_date")
    year = pub_year or first_year_from_date(earliest_date)

    doc_types = set(m.get("document_type") or [])
    is_published = bool(journal)
    # theses are not "citable" in charts
    is_citable = True

    venue = choose_best_venue(m, journal, arxiv_id)
    url = choose_best_url(doi, arxiv_id, recid)

    raw_items.append({
        "inspire_recid": recid,
        "doi": doi,
        "arxiv": arxiv_id,

        "title": title,
        "authors": authors,
        "venue": venue,
        "year": year,
        "publication_date": earliest_date,
        "url": url,
        "cited_by_count": citation_count,

        "is_published": is_published,
        "is_citable": is_citable
    })

# -----------------------------
# 3) Deduplicate
# -----------------------------
seen = set()
items: List[Dict[str, Any]] = []
for p in raw_items:
    k = dedupe_key(p)
    if k in seen:
        continue
    seen.add(k)
    items.append(p)

# Sort newest first
items.sort(key=sort_key, reverse=True)

# -----------------------------
# 4) Stats from items
# -----------------------------
# Very lightweight collaborator proxy: unique coauthor full names across all items
coauthors = set()
for p in items:
    for name in (p.get("authors") or "").split(","):
        nm = name.strip()
        if nm:
            coauthors.add(nm)

stats = {
    "works_count": len(items),
    "cited_by_count": sum(int(p.get("cited_by_count") or 0) for p in items),
    "collaborators": max(0, len(coauthors) - 1),
    "h_index": compute_h_index([int(p.get("cited_by_count") or 0) for p in items]),
}

# -----------------------------
# 5) Write outputs
# -----------------------------
os.makedirs("data", exist_ok=True)
with open("data/publications.json", "w", encoding="utf-8") as f:
    json.dump({"items": items}, f, indent=2, ensure_ascii=False)

with open("data/stats.json", "w", encoding="utf-8") as f:
    json.dump(stats, f, indent=2, ensure_ascii=False)

print(f"INSPIRE BAI: {bai} | ORCID: {ORCID}")
print(f"Raw records: {len(raw_items)} | After dedupe: {len(items)}")
print("Updated data/publications.json and data/stats.json")