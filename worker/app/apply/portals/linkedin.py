"""LinkedIn Easy Apply. Best-effort selectors; real LinkedIn UI shifts often.

NOTE: This is the canonical example. Selectors WILL drift; treat the
selectors map as a single point of maintenance.
"""
import time
from pathlib import Path
from tempfile import NamedTemporaryFile
from .base import Portal, ApplyResult
from ..humanize import pause, type_humanlike
from ..gmail_otp import wait_for_code
from ...config import settings
from ...logger import db_log

SEL = {
    "easy_apply_btn": "button.jobs-apply-button:has-text('Easy Apply')",
    "next": "button[aria-label='Continue to next step']",
    "review": "button[aria-label='Review your application']",
    "submit": "button[aria-label='Submit application']",
    "phone": "input[id*='phoneNumber']",
    "upload_resume": "input[type='file']",
    "follow_company_checkbox": "label[for*='follow-company']",
    "username": "input#username",
    "password": "input#session_password",
    "signin_submit": "button[type='submit']",
    "otp_input": "input[name='pin']",
}


class LinkedIn(Portal):
    key = "linkedin"

    @staticmethod
    def matches(url: str) -> bool:
        return "linkedin.com/jobs" in url

    async def _login_if_needed(self, page) -> None:
        if "login" in page.url or await page.locator(SEL["username"]).count():
            await type_humanlike(page, SEL["username"], settings().APPLY_EMAIL)
            await type_humanlike(page, SEL["password"], settings().APPLY_PASSWORD)
            await pause(0.5, 1.2)
            await page.click(SEL["signin_submit"])
            await page.wait_for_load_state("networkidle", timeout=30000)
            # OTP?
            if await page.locator(SEL["otp_input"]).count():
                since = int(time.time()) - 10
                code = wait_for_code("linkedin", since_ts=since, timeout_s=120)
                if not code:
                    raise RuntimeError("LinkedIn OTP not received")
                await type_humanlike(page, SEL["otp_input"], code)
                await page.keyboard.press("Enter")
                await page.wait_for_load_state("networkidle", timeout=30000)

    async def apply(self, *, page, job, profile, resume_pdf, cover_letter_text):
        shots: list[str] = []
        try:
            await page.goto(job["url"], wait_until="domcontentloaded", timeout=45000)
            await pause(2, 4)
            await self._login_if_needed(page)
            await pause(1, 2)
            btn = page.locator(SEL["easy_apply_btn"]).first
            if not await btn.count():
                return ApplyResult(False, [], error="No Easy Apply button (external apply)")
            await btn.click()
            await pause(1.5, 3)

            # Upload resume
            with NamedTemporaryFile("wb", suffix=".pdf", delete=False) as tmp:
                tmp.write(resume_pdf)
                tmp_path = tmp.name
            try:
                if await page.locator(SEL["upload_resume"]).count():
                    await page.locator(SEL["upload_resume"]).first.set_input_files(tmp_path)
                    await pause(2, 4)

                # Phone field (best effort)
                if await page.locator(SEL["phone"]).count():
                    await page.locator(SEL["phone"]).first.fill(settings().APPLY_DEFAULT_PHONE)
                    await pause(0.5, 1.2)

                # Multi-step: click Next/Review until Submit appears (auto-fill OTP if asked)
                from ..browser import fill_otp_if_present
                from ..form_walker import safe_autofill
                for _ in range(8):
                    await fill_otp_if_present(page, portal_url=job["url"], timeout=90)
                    # Answer any custom screening questions on this step
                    await safe_autofill(page, profile)
                    if await page.locator(SEL["submit"]).count():
                        await page.locator(SEL["submit"]).first.click()
                        await pause(2, 4)
                        shot = await page.screenshot(full_page=True)
                        shots.append(_save_shot(job["id"], shot))
                        return ApplyResult(True, shots, notes="submitted")
                    if await page.locator(SEL["review"]).count():
                        await page.locator(SEL["review"]).first.click()
                    elif await page.locator(SEL["next"]).count():
                        await page.locator(SEL["next"]).first.click()
                    else:
                        # Unhandled custom question — bail safely.
                        shot = await page.screenshot(full_page=True)
                        shots.append(_save_shot(job["id"], shot))
                        return ApplyResult(False, shots, error="Unhandled custom question step")
                    await pause(1.5, 3)
                return ApplyResult(False, shots, error="Too many steps")
            finally:
                Path(tmp_path).unlink(missing_ok=True)
        except Exception as e:
            try:
                shot = await page.screenshot(full_page=True)
                shots.append(_save_shot(job["id"], shot))
            except Exception:
                pass
            db_log("error", f"linkedin apply error: {e}", scope="apply.linkedin",
                   job_id=job.get("id"))
            return ApplyResult(False, shots, error=str(e))


def _save_shot(job_id: str, png: bytes) -> str:
    from ...db import db, user_id
    path = f"{user_id()}/{job_id}/{int(time.time())}.png"
    db().storage.from_("screenshots").upload(path, png, {"content-type": "image/png"})
    return path
