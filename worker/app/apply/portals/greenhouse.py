"""Greenhouse ATS (boards.greenhouse.io/*). Most consistent ATS form layout."""
import time
from pathlib import Path
from tempfile import NamedTemporaryFile
from .base import Portal, ApplyResult
from ..humanize import pause
from ..form_walker import autofill_form
from ...config import settings
from ...db import db


class Greenhouse(Portal):
    key = "greenhouse"

    @staticmethod
    def matches(url: str) -> bool:
        return "greenhouse.io" in url or "boards.greenhouse.io" in url

    async def apply(self, *, page, job, profile, resume_pdf, cover_letter_text):
        shots = []
        try:
            await page.goto(job["url"], wait_until="domcontentloaded", timeout=45000)
            await pause(1, 2)
            # Greenhouse forms usually have id="application_form"
            await page.locator("#first_name").fill(profile.get("full_name", "").split(" ")[0])
            await page.locator("#last_name").fill(" ".join(profile.get("full_name", "").split(" ")[1:]) or "Candidate")
            await page.locator("#email").fill(settings().APPLY_EMAIL)
            if await page.locator("#phone").count():
                await page.locator("#phone").fill(settings().APPLY_DEFAULT_PHONE)

            with NamedTemporaryFile("wb", suffix=".pdf", delete=False) as tmp:
                tmp.write(resume_pdf)
                tmp_path = tmp.name
            try:
                file_inputs = page.locator("input[type='file']")
                n = await file_inputs.count()
                if n:
                    await file_inputs.nth(0).set_input_files(tmp_path)
                await pause(1, 2)
                if cover_letter_text:
                    cl = page.locator("textarea[name*='cover'], textarea[id*='cover']")
                    if await cl.count():
                        await cl.first.fill(cover_letter_text)
                await pause(0.5, 1.5)
                submit = page.locator("input[type='submit'], button[type='submit']").first
                await submit.click()
                await pause(2, 4)
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
