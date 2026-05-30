"""Lever ATS (jobs.lever.co/*) — form fill + resume upload + submit."""
import io
import tempfile
from .base import Portal, ApplyResult
from ..humanize import pause, type_humanlike


class Lever(Portal):
    key = "lever"

    @staticmethod
    def matches(url: str) -> bool:
        return "jobs.lever.co" in url

    async def apply(self, *, page, job, profile, resume_pdf, cover_letter_text):
        shots: list[str] = []
        try:
            await page.goto(job["url"], wait_until="domcontentloaded", timeout=60000)
            await pause(1, 2)

            # Click Apply button
            apply_btn = page.locator("a.postings-btn, a[href*='/apply']").first
            await apply_btn.click()
            await page.wait_for_load_state("domcontentloaded")
            await pause(1, 2)

            # Required fields
            await type_humanlike(page, "input[name='name']", profile.get("full_name", ""))
            await type_humanlike(page, "input[name='email']", profile.get("apply_email") or profile.get("email", ""))
            if profile.get("phone"):
                await type_humanlike(page, "input[name='phone']", profile["phone"])
            if profile.get("location"):
                await type_humanlike(page, "input[name='location']", profile["location"])

            # Links
            for fld, val in [
                ("urls[LinkedIn]", profile.get("linkedin_url")),
                ("urls[GitHub]", profile.get("github_url")),
                ("urls[Portfolio]", profile.get("portfolio_url")),
            ]:
                if val:
                    loc = page.locator(f"input[name='{fld}']").first
                    if await loc.count():
                        await type_humanlike(page, f"input[name='{fld}']", val)

            # Resume upload
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
                tf.write(resume_pdf)
                resume_path = tf.name
            file_input = page.locator("input[type='file'][name='resume']").first
            await file_input.set_input_files(resume_path)
            await pause(1, 2)

            # Cover letter
            if cover_letter_text:
                cl_field = page.locator("textarea[name='comments'], textarea[name*='cover']").first
                if await cl_field.count():
                    await cl_field.fill(cover_letter_text)

            # Walk any custom screening questions before submit
            from ..form_walker import safe_autofill
            await safe_autofill(page, profile)

            # Submit
            await pause(1, 2)
            submit = page.locator("button[type='submit'], button:has-text('Submit')").first
            await submit.click()
            await page.wait_for_load_state("networkidle", timeout=30000)
            await pause(2, 4)

            # Verify success
            body = await page.inner_text("body")
            if "thank" in body.lower() or "received" in body.lower() or "submitted" in body.lower():
                return ApplyResult(True, shots, notes="lever submitted")
            return ApplyResult(False, shots, error="lever: no success confirmation")
        except Exception as e:
            return ApplyResult(False, shots, error=f"lever exception: {e}")
