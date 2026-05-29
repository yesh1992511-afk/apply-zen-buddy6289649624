"""Gmail via IMAP (read OTPs) + SMTP (send notifications). Uses user-stored
App Password from `gmail_credentials` table. No external SDKs — stdlib only."""
from __future__ import annotations
import imaplib
import smtplib
import email as emaillib
import re
import ssl
import time
from email.header import decode_header
from email.message import EmailMessage
from email.utils import parseaddr  # noqa: F401  (kept for future from-filtering)
from typing import Optional
from datetime import datetime, timedelta, timezone

from .db import db, user_id
from .logger import db_log


# ---------------------------------------------------------------------------
# Credentials
# ---------------------------------------------------------------------------
def _creds() -> Optional[dict]:
    try:
        row = db().table("gmail_credentials").select("*").eq("user_id", user_id()).maybe_single().execute().data
        return row
    except Exception:
        return None


def is_configured() -> bool:
    c = _creds()
    return bool(c and c.get("email") and c.get("app_password"))


# ---------------------------------------------------------------------------
# SMTP send
# ---------------------------------------------------------------------------
def send_email(to: str, subject: str, body: str, html: Optional[str] = None) -> bool:
    c = _creds()
    if not c:
        db_log("warn", "Gmail not configured — skipping send", scope="gmail")
        return False

    msg = EmailMessage()
    msg["From"] = c["email"]
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")

    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(c.get("smtp_host", "smtp.gmail.com"), c.get("smtp_port", 465), context=ctx, timeout=30) as s:
            s.login(c["email"], c["app_password"])
            s.send_message(msg)
        db().table("gmail_credentials").update({"last_error": None, "verified_at": datetime.now(timezone.utc).isoformat()}).eq("user_id", user_id()).execute()
        return True
    except Exception as e:
        db_log("error", f"Gmail SMTP send failed: {e}", scope="gmail")
        db().table("gmail_credentials").update({"last_error": str(e)[:500]}).eq("user_id", user_id()).execute()
        return False


def send_and_log(kind: str, subject: str, body: str, *, job_id: str | None = None,
                 application_id: str | None = None, html: str | None = None,
                 recipient_override: str | None = None) -> bool:
    """Send via Gmail and write to notification_log."""
    # Resolve recipient
    settings = db().table("notification_settings").select("recipient_email").eq("user_id", user_id()).maybe_single().execute().data
    recipient = recipient_override or (settings or {}).get("recipient_email")
    if not recipient:
        prof = db().table("profile").select("email").eq("user_id", user_id()).maybe_single().execute().data
        recipient = (prof or {}).get("email")
    if not recipient:
        db_log("warn", f"No recipient email for notification kind={kind}", scope="gmail")
        return False

    ok = send_email(recipient, subject, body, html=html)
    db().table("notification_log").insert({
        "user_id": user_id(),
        "kind": kind,
        "subject": subject,
        "body": body[:5000],
        "recipient_email": recipient,
        "status": "sent" if ok else "failed",
        "job_id": job_id,
        "application_id": application_id,
    }).execute()
    return ok


# ---------------------------------------------------------------------------
# IMAP OTP read
# ---------------------------------------------------------------------------
_OTP_KEYWORDS = re.compile(r"(code|verification|verify|otp|one[- ]?time|pin|passcode|security code)", re.I)
_OTP_PATTERN = re.compile(r"(?<!\d)(\d{4,8})(?!\d)")


def _decode_part(part) -> str:
    try:
        payload = part.get_payload(decode=True)
        if not payload:
            return ""
        charset = part.get_content_charset() or "utf-8"
        return payload.decode(charset, errors="replace")
    except Exception:
        return ""


def _extract_body(msg) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            if ct == "text/plain":
                return _decode_part(part)
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                return re.sub(r"<[^>]+>", " ", _decode_part(part))
        return ""
    return _decode_part(msg)


def _extract_otp_from_text(text: str) -> Optional[str]:
    if not text:
        return None
    # Look near OTP keywords first
    for m in _OTP_KEYWORDS.finditer(text):
        window = text[max(0, m.start() - 50): m.end() + 200]
        codes = _OTP_PATTERN.findall(window)
        for c in codes:
            if 4 <= len(c) <= 8:
                return c
    # Fallback: any 6-digit code
    for c in _OTP_PATTERN.findall(text):
        if len(c) == 6:
            return c
    return None


def fetch_otp(sender_domain: Optional[str] = None, *, since_minutes: int = 5,
              keywords: Optional[list[str]] = None) -> Optional[str]:
    """Connect to IMAP, search recent unread messages, extract OTP.

    Args:
        sender_domain: filter by `From:` (e.g. "indeed.com"). None = any sender.
        since_minutes: how recent emails to consider.
        keywords: subject keywords to prioritize (e.g. ["Indeed", "verification"]).
    """
    c = _creds()
    if not c:
        return None

    try:
        M = imaplib.IMAP4_SSL(c.get("imap_host", "imap.gmail.com"), c.get("imap_port", 993))
        M.login(c["email"], c["app_password"])
        M.select("INBOX")

        since_date = (datetime.now(timezone.utc) - timedelta(minutes=since_minutes)).strftime("%d-%b-%Y")
        criteria = ["UNSEEN", f'SINCE {since_date}']
        if sender_domain:
            criteria.append(f'FROM "{sender_domain}"')

        typ, data = M.search(None, *criteria)
        if typ != "OK" or not data or not data[0]:
            M.logout()
            return None

        ids = data[0].split()
        # Most recent first
        for mid in reversed(ids[-15:]):
            typ, msg_data = M.fetch(mid, "(RFC822)")
            if typ != "OK":
                continue
            msg = emaillib.message_from_bytes(msg_data[0][1])
            subject = ""
            try:
                parts = decode_header(msg.get("Subject", ""))
                subject = "".join((s.decode(e or "utf-8", errors="replace") if isinstance(s, bytes) else s) for s, e in parts)
            except Exception:
                pass
            body = _extract_body(msg)
            haystack = f"{subject}\n{body}"

            # If keywords provided, require at least one
            if keywords and not any(k.lower() in haystack.lower() for k in keywords):
                continue

            code = _extract_otp_from_text(haystack)
            if code:
                # Mark seen so we don't reuse
                try:
                    M.store(mid, "+FLAGS", "\\Seen")
                except Exception:
                    pass
                M.logout()
                db_log("info", f"OTP {code} extracted (sender={sender_domain})", scope="gmail")
                return code
        M.logout()
        return None
    except Exception as e:
        db_log("error", f"Gmail IMAP fetch failed: {e}", scope="gmail")
        return None


def wait_for_otp(sender_domain: Optional[str] = None, *, timeout: int = 120,
                 poll_interval: int = 5, keywords: Optional[list[str]] = None) -> Optional[str]:
    """Block until an OTP arrives or timeout elapses."""
    if not is_configured():
        db_log("warn", "wait_for_otp called but Gmail not configured", scope="gmail")
        return None
    deadline = time.time() + timeout
    while time.time() < deadline:
        code = fetch_otp(sender_domain, since_minutes=5, keywords=keywords)
        if code:
            return code
        time.sleep(poll_interval)
    return None


def verify_credentials() -> tuple[bool, Optional[str]]:
    """Quick IMAP + SMTP login test. Returns (ok, error_message)."""
    c = _creds()
    if not c:
        return False, "Gmail not configured"
    try:
        M = imaplib.IMAP4_SSL(c.get("imap_host", "imap.gmail.com"), c.get("imap_port", 993))
        M.login(c["email"], c["app_password"])
        M.logout()
    except Exception as e:
        return False, f"IMAP login failed: {e}"
    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(c.get("smtp_host", "smtp.gmail.com"), c.get("smtp_port", 465), context=ctx, timeout=15) as s:
            s.login(c["email"], c["app_password"])
    except Exception as e:
        return False, f"SMTP login failed: {e}"
    db().table("gmail_credentials").update({"verified_at": datetime.now(timezone.utc).isoformat(), "last_error": None}).eq("user_id", user_id()).execute()
    return True, None
