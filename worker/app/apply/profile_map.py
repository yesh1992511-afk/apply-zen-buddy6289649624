"""
Profile autofill mapper.

Given a portal field's question text (label / placeholder / aria-label / name),
return the best answer derived from the user's profile + related list tables.

Used by every portal-specific autofill module (Indeed Easy Apply, LinkedIn,
Greenhouse, Lever, Workday, generic forms) so a new question variant only
needs a new regex here.

Returns:
    str | int | bool | None    None => unknown, leave field blank for human review.
"""
from __future__ import annotations
import re
from typing import Any, Callable

_YES, _NO = "Yes", "No"


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _first(parts: list[str]) -> str:
    return parts[0] if parts else ""


def _last(parts: list[str]) -> str:
    return parts[-1] if parts else ""


def _yesno(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, bool):
        return _YES if v else _NO
    if isinstance(v, str):
        return _YES if v.strip().lower() in {"y", "yes", "true", "1"} else _NO
    return _YES if v else _NO


def _years_between(start: str | None, end: str | None) -> int | None:
    try:
        from datetime import date
        if not start:
            return None
        s = date.fromisoformat(start[:10])
        e = date.fromisoformat(end[:10]) if end else date.today()
        return max(0, (e - s).days // 365)
    except Exception:
        return None


def _highest_education(eds: list[dict]) -> str:
    rank = {"phd": 5, "doctor": 5, "master": 4, "mba": 4, "bachelor": 3, "associate": 2, "diploma": 2, "high school": 1, "secondary": 1}
    best, score = "", -1
    for e in eds or []:
        deg = _norm(e.get("degree") or "")
        for k, v in rank.items():
            if k in deg and v > score:
                best, score = e.get("degree") or "", v
    return best


# Rules are ordered. First match wins.
# Each rule: (compiled regex, lambda(profile, lists) -> answer)
RULES: list[tuple[re.Pattern, Callable[[dict, dict], Any]]] = []


def _rule(pattern: str, fn: Callable[[dict, dict], Any]) -> None:
    RULES.append((re.compile(pattern, re.IGNORECASE), fn))


# --- Name ---
_rule(r"\b(first|given)\s*name\b", lambda p, l: _first((p.get("full_name") or "").split()))
_rule(r"\b(last|family|sur)\s*name\b", lambda p, l: _last((p.get("full_name") or "").split()))
_rule(r"\b(middle)\s*name\b", lambda p, l: " ".join((p.get("full_name") or "").split()[1:-1]))
_rule(r"\b(preferred|nick)\s*name\b", lambda p, l: p.get("preferred_name") or _first((p.get("full_name") or "").split()))
_rule(r"\bfull\s*name|your name|legal name\b", lambda p, l: p.get("full_name"))
_rule(r"\bpronoun", lambda p, l: p.get("pronouns"))

# --- Contact ---
_rule(r"\bemail\b", lambda p, l: p.get("email"))
_rule(r"\b(phone|mobile|cell|tel)\b", lambda p, l: p.get("phone"))

# --- Address ---
_rule(r"street\s*address|address\s*line\s*1|^address$", lambda p, l: p.get("street_address"))
_rule(r"address\s*line\s*2|apartment|apt|suite|unit", lambda p, l: p.get("address_line_2"))
_rule(r"\b(city|town)\b", lambda p, l: p.get("city") or (p.get("location") or "").split(",")[0].strip() or None)
_rule(r"\b(state|province|region)\b", lambda p, l: p.get("state_region"))
_rule(r"\b(zip|postal|postcode|post\s*code)\b", lambda p, l: p.get("postal_code"))
_rule(r"\bcountry\b", lambda p, l: p.get("country"))
_rule(r"\b(nationality|citizenship)\b", lambda p, l: p.get("nationality"))
_rule(r"\b(location|where (are|do) you (located|live))\b", lambda p, l: p.get("location") or ", ".join(filter(None, [p.get("city"), p.get("country")])))

# --- DOB / age ---
_rule(r"date of birth|dob|birthday", lambda p, l: p.get("date_of_birth"))
_rule(r"are you (at least )?18|18\s*(or older|\+|years)", lambda p, l: _YES)  # if you're using this, you're an adult

# --- Work authorization ---
_rule(r"authori[sz]ed to work|legally (allowed|authori[sz]ed)|right to work|work permit", lambda p, l: _YES if (p.get("work_auth_country") or p.get("visa_status")) else "")
_rule(r"(require|need).*spons(or|er)ship|visa sponsor", lambda p, l: _yesno(p.get("needs_visa_now") or p.get("requires_sponsorship") or p.get("needs_visa_future")))
_rule(r"now or in the future require sponsor", lambda p, l: _yesno(p.get("needs_visa_now") or p.get("needs_visa_future") or p.get("requires_sponsorship")))
_rule(r"visa status|immigration status", lambda p, l: p.get("visa_status"))
_rule(r"visa expir|work permit expir", lambda p, l: p.get("visa_expiry"))
_rule(r"\bpassport\b", lambda p, l: _yesno(p.get("has_passport")))
_rule(r"security clearance", lambda p, l: p.get("security_clearance") or "None")

# --- Compensation ---
_rule(r"(desired|expected|requested)\s*(salary|compensation|pay)|salary expectation", lambda p, l: p.get("desired_salary"))
_rule(r"current (salary|compensation|pay)", lambda p, l: p.get("current_salary"))
_rule(r"salary (currency|in)", lambda p, l: p.get("salary_currency"))

# --- Availability ---
_NOTICE_CAT = {"immediate": "Immediately", "2w": "2 weeks", "1m": "1 month", "2m": "2 months", "3m": "3 months"}
def _notice(p: dict, _l: dict):
    cat = p.get("notice_period_category")
    if cat and cat in _NOTICE_CAT:
        return _NOTICE_CAT[cat]
    w = p.get("notice_period_weeks")
    if w:
        return f"{w} weeks"
    return p.get("earliest_start_date")
_rule(r"notice period|how (much )?notice|how soon can you (start|join)|earliest (start|join)", _notice)
_rule(r"start date|available from", lambda p, l: p.get("earliest_start_date"))
_rule(r"hours per week|weekly hours", lambda p, l: p.get("available_hours_per_week"))

# --- Work prefs ---
_rule(r"relocation (assist|help|support|package)|need.*relocation", lambda p, l: _yesno(p.get("relocation_assistance_needed")))
_rule(r"willing to relocat|relocation", lambda p, l: _yesno(p.get("willing_to_relocate")))
_rule(r"remote|work from home|on[\s-]?site|hybrid preference", lambda p, l: p.get("remote_preference"))
def _travel(p: dict, _l: dict):
    pct = p.get("travel_willingness_pct")
    if pct is not None:
        return f"Up to {pct}%" if pct > 0 else "No travel"
    return p.get("travel_willingness")
_rule(r"willing to travel|travel (percent|%)|travel requir", _travel)
_rule(r"shift (preference|availability)", lambda p, l: p.get("shift_preference"))

_rule(r"driver'?s? license|driving licence", lambda p, l: _yesno(p.get("drivers_license")))
_rule(r"own (transport|vehicle|car)", lambda p, l: _yesno(p.get("has_own_transport")))
_rule(r"(full[\s-]?time)", lambda p, l: _yesno(p.get("open_to_fulltime")))
_rule(r"(part[\s-]?time)", lambda p, l: _yesno(p.get("open_to_parttime")))
_rule(r"\bcontract(or|ing)?\b", lambda p, l: _yesno(p.get("open_to_contract")))
_rule(r"intern(ship)?", lambda p, l: _yesno(p.get("open_to_internship")))

# --- Experience & education ---
_rule(r"years (of )?(experience|exp)\b", lambda p, l: int(p.get("years_experience") or 0) or None)
_rule(r"highest (level of )?education|education level", lambda p, l: _highest_education(l.get("educations") or []))
_rule(r"(university|college|school) (name|attended)", lambda p, l: (l.get("educations") or [{}])[0].get("school"))
_rule(r"degree", lambda p, l: (l.get("educations") or [{}])[0].get("degree"))
_rule(r"(field of study|major)", lambda p, l: (l.get("educations") or [{}])[0].get("field"))
_rule(r"gpa", lambda p, l: (l.get("educations") or [{}])[0].get("gpa"))
_rule(r"current (employer|company)|present employer", lambda p, l: (l.get("experiences") or [{}])[0].get("company"))
_rule(r"current (title|position|role)", lambda p, l: (l.get("experiences") or [{}])[0].get("title"))
_rule(r"reason for leaving|why (are|do) you (leav|look)", lambda p, l: (p.get("screening_answers") or {}).get("reason_for_leaving"))

# --- Links ---
_rule(r"linkedin", lambda p, l: p.get("linkedin_url") or p.get("linkedin_username"))
_rule(r"github", lambda p, l: p.get("github_url"))
_rule(r"portfolio|website|personal site", lambda p, l: p.get("portfolio_url") or p.get("personal_website"))
_rule(r"twitter|\bx\.com\b", lambda p, l: p.get("twitter_url"))
_rule(r"stack ?overflow", lambda p, l: p.get("stackoverflow_url"))
_rule(r"dribbble", lambda p, l: p.get("dribbble_url"))
_rule(r"behance", lambda p, l: p.get("behance_url"))
_rule(r"medium", lambda p, l: p.get("medium_url"))

# --- EEOC (only if user opted in) ---
def _eeoc(key: str):
    return lambda p, l: p.get(key) if p.get("share_demographics") else None
_rule(r"\bgender\b", _eeoc("gender"))
_rule(r"ethnicity|race", _eeoc("ethnicity"))
_rule(r"veteran", _eeoc("veteran_status"))
_rule(r"disab(le|ility)", _eeoc("disability_status"))
_rule(r"lgbt", _eeoc("lgbtq_status"))

# --- Background checks / compliance ---
_rule(r"pass (a )?background check|background screen|consent.*background",
      lambda p, l: _yesno(p.get("consent_background_check")) if p.get("consent_background_check") is not None
      else ((p.get("screening_answers") or {}).get("able_to_pass_background_check") or _YES))
_rule(r"pass (a )?drug (test|screen)|consent.*drug",
      lambda p, l: _yesno(p.get("consent_drug_test")) if p.get("consent_drug_test") is not None
      else ((p.get("screening_answers") or {}).get("able_to_pass_drug_test") or _YES))
def _criminal(p: dict, _l: dict):
    v = p.get("criminal_record_disclosure")
    if v == "none": return _NO
    if v == "disclosed": return _YES
    if v == "decline": return "Decline to answer"
    return (p.get("screening_answers") or {}).get("criminal_record") or _NO
_rule(r"criminal (record|history|conviction)|felony", _criminal)
_rule(r"references? (available|on request|contact)", lambda p, l: _yesno(p.get("references_available_on_request")))


# --- Cover-letter type prompts ---
_rule(r"why (do you want|are you interested)", lambda p, l: (p.get("screening_answers") or {}).get("why_company") or p.get("summary"))
_rule(r"tell us about yourself|brief introduction|summary about you", lambda p, l: p.get("summary"))


def answer_for(question_text: str, profile: dict, lists: dict | None = None) -> Any:
    """
    Match `question_text` (the visible question/label on the portal form)
    against the rule set. Returns the best answer or None.

    `lists` is an optional dict of related rows: {"experiences": [...], "educations": [...], "languages": [...]}.
    """
    lists = lists or {}
    q = _norm(question_text)
    if not q:
        return None

    # Built-in regex rules.
    for pat, fn in RULES:
        if pat.search(q):
            try:
                val = fn(profile or {}, lists)
            except Exception:
                val = None
            if val not in (None, ""):
                return val

    # Fuzzy match against user-provided screening_answers.
    answers = profile.get("screening_answers") or {}
    if isinstance(answers, dict):
        # 1) exact key
        for k, v in answers.items():
            if _norm(k) and _norm(k) in q and v:
                return v
        # 2) loose: every word of the key appears in q
        for k, v in answers.items():
            if not v:
                continue
            words = [w for w in re.split(r"[_\s]+", _norm(k)) if len(w) > 2]
            if words and all(w in q for w in words):
                return v

    return None


def fill_kwargs(profile: dict, lists: dict | None = None) -> dict[str, Any]:
    """
    Return a flat dict of common form keys for portals that don't ask questions
    and instead expect named inputs (Greenhouse, Lever often work this way).
    """
    lists = lists or {}
    parts = (profile.get("full_name") or "").split()
    return {
        "first_name": _first(parts),
        "last_name": _last(parts),
        "full_name": profile.get("full_name"),
        "email": profile.get("email"),
        "phone": profile.get("phone"),
        "city": profile.get("city"),
        "state": profile.get("state_region"),
        "country": profile.get("country"),
        "postal_code": profile.get("postal_code"),
        "street_address": profile.get("street_address"),
        "linkedin": profile.get("linkedin_url"),
        "github": profile.get("github_url"),
        "portfolio": profile.get("portfolio_url") or profile.get("personal_website"),
        "twitter": profile.get("twitter_url"),
        "desired_salary": profile.get("desired_salary"),
        "current_salary": profile.get("current_salary"),
        "notice_weeks": profile.get("notice_period_weeks"),
        "earliest_start": profile.get("earliest_start_date"),
        "work_auth_country": profile.get("work_auth_country"),
        "visa_status": profile.get("visa_status"),
        "needs_sponsorship": _yesno(profile.get("needs_visa_now") or profile.get("requires_sponsorship")),
        "willing_to_relocate": _yesno(profile.get("willing_to_relocate")),
        "remote_preference": profile.get("remote_preference"),
        "headline": profile.get("headline"),
        "summary": profile.get("summary"),
        "years_experience": profile.get("years_experience"),
    }
