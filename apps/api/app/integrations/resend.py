"""Resend email — magic links + occasional notifications."""

from __future__ import annotations

import resend

from app.core.config import settings
from app.core.log import log

resend.api_key = settings.resend_api_key


def _frontend_origin() -> str:
    if settings.allowed_origins:
        return settings.allowed_origins[0].rstrip("/")
    return "http://localhost:3000"


async def send_magic_link(*, email: str, token: str) -> None:
    """Email a sign-in link. The link encodes both the email and token."""
    if settings.app_env == "development" and not settings.resend_api_key:
        # In dev without Resend, log the magic link so the developer can copy it.
        log.info("magic_link.dev", email=email, token=token,
                 link=f"{_frontend_origin()}/verify?email={email}&token={token}")
        return

    link = f"{_frontend_origin()}/verify?email={email}&token={token}"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                max-width: 480px; margin: 32px auto; color: #1B2A4E;">
      <h1 style="font-size: 18px; font-weight: 500;">ESUI sign-in</h1>
      <p>Click to sign in. This link expires in 15 minutes.</p>
      <p><a href="{link}" style="display:inline-block;padding:10px 18px;
            background:#1B2A4E;color:#F5EBD0;text-decoration:none;border-radius:6px;">
        Sign in
      </a></p>
      <p style="font-size:12px;color:#666;">If you didn't request this, ignore.</p>
    </div>
    """

    resend.Emails.send({
        "from": settings.resend_from,
        "to": email,
        "subject": "ESUI sign-in",
        "html": html,
    })
    log.info("magic_link.sent", email=email)
