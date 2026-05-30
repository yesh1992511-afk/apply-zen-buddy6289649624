"""Indeed Easy Apply — best-effort 1-click. Falls back to handoff."""
import tempfile
from .base import Portal, ApplyResult
from ..humanize import pause


class Indeed(Portal):
    key = "indeed"

    @staticmethod
    def matches(url: str) -> bool:
        return "indeed.com" in url

    async def apply(self, *, page, job, profile, resume_pdf, cover_letter_text):
        shots: list[str] = []
        try:
            await page.goto(job["url"], wait_until="domcontentloaded", timeout=60000)
            await pause(1, 3)

            # Indeed sometimes shows an "Apply Now" → opens iframe wizard
            btn = page.locator("button:has-text('Apply now'), a:has-text('Apply now')").first
            if not await btn.count():
                return ApplyResult(False, shots, error="indeed: no apply button (likely external)")
            await btn.click()
            await pause(2, 4)

            # If wizard opened in iframe
            frames = [f for f in page.frames if "indeed" in (f.url or "")]
            target = frames[-1] if frames else page

            # Resume upload if requested
            file_input = target.locator("input[type='file']").first
            if await file_input.count():
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
                    tf.write(resume_pdf)
                    await file_input.set_input_files(tf.name)
                await pause(1, 2)

            # Click Continue/Submit until end (auto-fill OTP, autofill custom questions)
            from ..browser import fill_otp_if_present
            from ..form_walker import safe_autofill
            for _ in range(6):
                await fill_otp_if_present(target if hasattr(target, 'query_selector') else page, portal_url=job["url"], timeout=90)
                await safe_autofill(target, profile)
                nxt = target.locator(
                    "button:has-text('Continue'), button:has-text('Submit'), "
                    "button:has-text('Review your application')"
                ).first
                if not await nxt.count():
                    break
                await nxt.click()
                await pause(1, 3)

            body = await page.inner_text("body")
            if "submitted" in body.lower() or "thank" in body.lower():
                return ApplyResult(True, shots, notes="indeed easy apply submitted")
            return ApplyResult(False, shots, error="indeed: did not reach confirmation")
        except Exception as e:
            return ApplyResult(False, shots, error=f"indeed exception: {e}")
