"""Compatibility shim — OTP reading now goes through IMAP via ``app.gmail``.

The legacy implementation depended on a Google OAuth client and refresh token
provided via ``settings()``. We've replaced that with a simpler IMAP + Gmail
App Password flow stored per-user in the ``gmail_credentials`` table.

This module is kept so older imports keep working. Prefer
``app.gmail.wait_for_otp`` or ``app.apply.browser.fill_otp_if_present`` in
new code.
"""
from __future__ import annotations
from typing import Optional

from .. import gmail as _gmail


def wait_for_code(from_contains: str, *, since_ts: int = 0,  # noqa: ARG001 - kept for back-compat
                  timeout_s: int = 120) -> Optional[str]:
    """Block until a verification email arrives. Delegates to IMAP path."""
    return _gmail.wait_for_otp(from_contains, timeout=timeout_s, poll_interval=5)
