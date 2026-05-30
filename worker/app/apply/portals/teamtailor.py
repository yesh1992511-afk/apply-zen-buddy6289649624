"""Teamtailor apply ({company}.teamtailor.com/*). Public hosted form."""
import time
from pathlib import Path
from tempfile import NamedTemporaryFile
from .base import Portal, ApplyResult
from ..humanize import pause
from ..form_walker import safe_autofill
from ...config import settings


class Teamtailor(Portal):
    key = "teamtailor"

    @staticmethod
    def matches(url: str) -> bool:
        return "teamtailor.com" in url

    async def apply(self, *, page, job, profile, resume_pdf, cover_letter_text):
        shots: list[str] = []
        try:
            await page.goto(job["url"], wait_until="domcontentloaded", timeout=45000)
            await pause(1, 2)
            for sel in ['a:has-text("Apply for this job")', 'a:has-text("Apply")',
                        'button:has-text("Apply")']:
                try:
                    btn = page.locator(sel).first
                    if await btn.count() and await btn.is_visible():
                        await btn.click(); await pause(1, 2); break
                except Exception:
                    continue

            full_name = profile.get("full_name", "")
            first = full_name.split(" ")[0] if full_name else ""
            last = " ".join(full_name.split(" ")[1:]) if full_name else "Candidate"

            async def fill_if(selector: str, value: str):
                try:
                    loc = page.locator(selector).first
                    if await loc.count() and value:
                        await loc.fill(value)
                except Exception:
                    pass

            await fill_if('input[name*="first" i]', first)
            await fill_if('input[name*="last" i]', last)
            await fill_if('input[type="email"]', settings().APPLY_EMAIL)
            await fill_if('input[type="tel"], input[name*="phone" i]', settings().APPLY_DEFAULT_PHONE)

            with NamedTemporaryFile("wb", suffix=".pdf", delete=False) as tmp:
                tmp.write(resume_pdf); tmp_path = tmp.name
            try:
                fi = page.locator("input[type='file']")
                if await fi.count():
                    await fi.nth(0).set_input_files(tmp_path)
                await pause(1, 2)
                if cover_letter_text:
                    cl = page.locator("textarea[name*='cover' i], textarea[name*='message' i]")
                    if await cl.count():
                        await cl.first.fill(cover_letter_text)
                await safe_autofill(page, profile)
                await pause(0.5, 1.5)
                submit = page.locator(
                    "button[type='submit'], button:has-text('Submit'), button:has-text('Send application')"
                ).first
                await submit.click(); await pause(2, 4)
                shot = await page.screenshot(full_page=True)
                shots.append(_save_shot(job["id"], shot))
                return ApplyResult(True, shots, notes="submitted")
            finally:
                Path(tmp_path).unlink(missing_ok=True)
        except Exception as e:
            try:
                shot = await page.screenshot(full_page=True)
                shots.append(_save_shot(job["id"], shot))
            except Exception:
                pass
            return ApplyResult(False, shots, error=str(e))


def _save_shot(job_id: str, png: bytes) -> str:
    from ...db import db, user_id
    path = f"{user_id()}/{job_id}/{int(time.time())}.png"
    db().storage.from_("screenshots").upload(path, png, {"content-type": "image/png"})
    return path
