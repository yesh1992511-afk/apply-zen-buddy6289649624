"""Workday (*.myworkdayjobs.com) — experimental, long multi-step wizard.

Workday flows differ per tenant; this best-effort adapter handles the common
'Quick Apply with resume' path. Production reliability requires tenant-specific
selectors stored in source config.
"""
import tempfile
from .base import Portal, ApplyResult
from ..humanize import pause, type_humanlike


class Workday(Portal):
    key = "workday"

    @staticmethod
    def matches(url: str) -> bool:
        return "myworkdayjobs.com" in url

    async def apply(self, *, page, job, profile, resume_pdf, cover_letter_text):
        shots: list[str] = []
        try:
            await page.goto(job["url"], wait_until="domcontentloaded", timeout=60000)
            await pause(2, 4)

            apply_btn = page.locator("button[data-automation-id='applyManually'], a:has-text('Apply')").first
            if await apply_btn.count():
                await apply_btn.click()
                await pause(2, 4)

            # Most Workday tenants require sign-in or account creation first.
            # We require the user to seed a session manually in the persistent
            # profile dir (see browser.py) for the target tenant — flag if not present.
            if await page.locator("button[data-automation-id='signInLink']").count():
                return ApplyResult(False, shots,
                                   error="workday: account session not present in profile dir (manual seed required)")

            # Upload resume
            file_input = page.locator("input[type='file']").first
            if await file_input.count():
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
                    tf.write(resume_pdf)
                    await file_input.set_input_files(tf.name)
                await pause(2, 4)

            # Phone / location often pre-filled from profile after resume parse
            if profile.get("phone"):
                phone = page.locator("input[data-automation-id='phone-number']").first
                if await phone.count():
                    await type_humanlike(page, "input[data-automation-id='phone-number']", profile["phone"])

            # Walk Next/Submit chain (auto-fill OTP if portal asks)
            from ..browser import fill_otp_if_present
            for _ in range(10):
                await fill_otp_if_present(page, portal_url=job["url"], timeout=90)
                nxt = page.locator(
                    "button[data-automation-id='pageFooterNextButton'], "
                    "button[data-automation-id='bottom-navigation-next-button'], "
                    "button:has-text('Submit')"
                ).first
                if not await nxt.count():
                    break
                await nxt.click()
                await pause(2, 4)

            body = await page.inner_text("body")
            if "submitted" in body.lower() or "thank" in body.lower():
                return ApplyResult(True, shots, notes="workday submitted (experimental)")
            return ApplyResult(False, shots, error="workday: did not reach confirmation")
        except Exception as e:
            return ApplyResult(False, shots, error=f"workday exception: {e}")
