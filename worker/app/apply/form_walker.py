"""
Generic question-walker for ATS forms.

Walks every form field on the page, derives the visible "question" text
(label / aria-label / placeholder / name), looks up an answer via
profile_map.answer_for, and fills inputs / textareas / selects /
radio groups accordingly.

Designed to be portal-agnostic: ATS forms vary widely but the question
text is almost always present somewhere near the input.
"""
from __future__ import annotations
from typing import Any
from .profile_map import answer_for


def load_lists(user_id: str | None) -> dict:
    """Fetch related rows (experiences/educations/languages/...) the mapper may need.

    Shared by all portal adapters so they can call autofill_form uniformly.
    """
    if not user_id:
        return {}
    from ..db import db
    out: dict = {}
    for tbl in ("experiences", "educations", "languages", "certifications", "skills", "projects"):
        try:
            res = db().table(tbl).select("*").eq("user_id", user_id).execute()
            out[tbl] = res.data or []
        except Exception:
            out[tbl] = []
    return out


async def safe_autofill(page, profile: dict) -> dict[str, int] | None:
    """Convenience wrapper: load lists + run autofill, swallow all exceptions.
    Call this right before the final Submit click in any portal adapter."""
    try:
        lists = load_lists(profile.get("user_id"))
        return await autofill_form(page, profile, lists)
    except Exception:
        return None


async def _label_for(page, handle) -> str:
    """Best-effort: extract the human question text for a single input element."""
    try:
        parts = await handle.evaluate(
            """el => {
                const out = [];
                if (el.labels && el.labels.length) {
                    for (const lbl of el.labels) out.push(lbl.innerText || lbl.textContent || '');
                }
                if (el.getAttribute('aria-label')) out.push(el.getAttribute('aria-label'));
                if (el.getAttribute('aria-labelledby')) {
                    for (const id of el.getAttribute('aria-labelledby').split(/\\s+/)) {
                        const ref = document.getElementById(id);
                        if (ref) out.push(ref.innerText || ref.textContent || '');
                    }
                }
                if (el.getAttribute('placeholder')) out.push(el.getAttribute('placeholder'));
                if (el.getAttribute('name')) out.push(el.getAttribute('name'));
                if (el.getAttribute('id')) out.push(el.getAttribute('id'));
                // climb up to find a question container
                let p = el.parentElement;
                for (let i = 0; i < 4 && p; i++) {
                    const lab = p.querySelector('label, .question, .field-label, legend');
                    if (lab) { out.push(lab.innerText || lab.textContent || ''); break; }
                    p = p.parentElement;
                }
                return out.join(' || ');
            }"""
        )
        return parts or ""
    except Exception:
        return ""


async def fill_text_inputs(page, profile: dict, lists: dict | None = None) -> int:
    """Fill <input type=text|email|tel|number|url|date> and <textarea>. Returns number filled."""
    filled = 0
    selectors = "input:not([type='hidden']):not([type='file']):not([type='submit']):not([type='button']):not([type='checkbox']):not([type='radio']), textarea"
    handles = await page.locator(selectors).element_handles()
    for h in handles:
        try:
            if not await h.is_visible():
                continue
            current = await h.evaluate("e => e.value")
            if current:
                continue  # don't overwrite existing values
            label = await _label_for(page, h)
            ans = answer_for(label, profile, lists)
            if ans is None or ans == "":
                continue
            await h.fill(str(ans))
            filled += 1
        except Exception:
            continue
    return filled


async def select_dropdowns(page, profile: dict, lists: dict | None = None) -> int:
    """Pick best matching option in each <select>. Returns number set."""
    filled = 0
    handles = await page.locator("select").element_handles()
    for h in handles:
        try:
            if not await h.is_visible():
                continue
            label = await _label_for(page, h)
            ans = answer_for(label, profile, lists)
            if ans is None or ans == "":
                continue
            target = str(ans).strip().lower()
            opts = await h.evaluate(
                "el => Array.from(el.options).map(o => ({value: o.value, text: (o.text||'').trim()}))"
            )
            chosen = None
            for o in opts:
                if o["text"].lower() == target or o["value"].lower() == target:
                    chosen = o["value"]; break
            if not chosen:
                for o in opts:
                    if target in o["text"].lower() or target in o["value"].lower():
                        chosen = o["value"]; break
            if chosen is not None:
                await h.select_option(value=chosen)
                filled += 1
        except Exception:
            continue
    return filled


async def click_radios(page, profile: dict, lists: dict | None = None) -> int:
    """For each radio group, click the option whose label matches the computed answer."""
    filled = 0
    try:
        groups = await page.evaluate(
            """() => {
                const seen = new Set(); const out = [];
                document.querySelectorAll("input[type='radio']").forEach(r => {
                    if (!r.name || seen.has(r.name)) return;
                    seen.add(r.name); out.push(r.name);
                });
                return out;
            }"""
        )
    except Exception:
        return 0
    for name in groups:
        try:
            radios = await page.locator(f"input[type='radio'][name='{name}']").element_handles()
            if not radios:
                continue
            first = radios[0]
            label = await _label_for(page, first)
            ans = answer_for(label, profile, lists)
            if ans is None or ans == "":
                continue
            target = str(ans).strip().lower()
            for r in radios:
                try:
                    rlabel = await _label_for(page, r)
                    if target in (rlabel or "").lower():
                        await r.click()
                        filled += 1
                        break
                except Exception:
                    continue
        except Exception:
            continue
    return filled


async def autofill_form(page, profile: dict, lists: dict | None = None) -> dict[str, int]:
    """Walk the whole form and fill what we can. Returns counts for logging."""
    text = await fill_text_inputs(page, profile, lists)
    sel = await select_dropdowns(page, profile, lists)
    rad = await click_radios(page, profile, lists)
    return {"text": text, "select": sel, "radio": rad}
