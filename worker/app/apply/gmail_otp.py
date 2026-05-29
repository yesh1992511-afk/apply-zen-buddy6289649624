"""Gmail OAuth → reads OTP / verification codes from the inbox."""
import base64
import re
import time
from typing import Optional
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from ..config import settings


def _service():
    s = settings()
    creds = Credentials(
        token=None,
        refresh_token=s.GMAIL_OAUTH_REFRESH_TOKEN,
        client_id=s.GMAIL_OAUTH_CLIENT_ID,
        client_secret=s.GMAIL_OAUTH_CLIENT_SECRET,
        token_uri="https://oauth2.googleapis.com/token",
        scopes=["https://www.googleapis.com/auth/gmail.readonly"],
    )
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


CODE_RE = re.compile(r"\b(\d{4,8})\b")


def read_text(svc, msg_id: str) -> str:
    m = svc.users().messages().get(userId="me", id=msg_id, format="full").execute()
    payload = m["payload"]
    parts = [payload] + (payload.get("parts") or [])
    bodies = []
    for p in parts:
        data = (p.get("body") or {}).get("data")
        if data:
            try:
                bodies.append(base64.urlsafe_b64decode(data).decode("utf-8", "ignore"))
            except Exception:
                pass
    return "\n".join(bodies)


def wait_for_code(from_contains: str, *, since_ts: int, timeout_s: int = 120) -> Optional[str]:
    """Poll Gmail until we see an email matching `from_contains` and extract digits."""
    svc = _service()
    deadline = time.time() + timeout_s
    q = f"from:{from_contains} newer_than:1h"
    while time.time() < deadline:
        res = svc.users().messages().list(userId="me", q=q, maxResults=5).execute()
        for m in res.get("messages") or []:
            full = svc.users().messages().get(userId="me", id=m["id"], format="metadata",
                                              metadataHeaders=["Date"]).execute()
            hdrs = {h["name"]: h["value"] for h in full["payload"]["headers"]}
            # crude time gate via internalDate
            internal = int(full.get("internalDate", "0")) // 1000
            if internal < since_ts:
                continue
            txt = read_text(svc, m["id"])
            m_code = CODE_RE.search(txt)
            if m_code:
                return m_code.group(1)
        time.sleep(5)
    return None
