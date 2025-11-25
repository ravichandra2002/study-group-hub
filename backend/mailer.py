
import os
import smtplib
from email.message import EmailMessage

SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587").strip() or 587)
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASS = os.getenv("SMTP_PASS", "").strip()
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER).strip() 
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() not in ("0", "false", "no")

def _ready():
    return all([SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM])

def send_email(to: str, subject: str, html: str, text: str = ""):
    """
    Send an email. Returns (ok, error_message_or_None).
    This function is VERBOSE: it prints SMTP dialogue so you can see what Gmail / SMTP says.
    """
    if not _ready():
        msg = "[mailer] not configured: set SMTP_HOST/PORT/USER/PASS/SMTP_FROM in .env"
        print(msg)
        return False, msg

    if not to:
        msg = "[mailer] missing 'to' address"
        print(msg)
        return False, msg

    try:
        em = EmailMessage()
        em["From"] = SMTP_FROM
        em["To"] = to
        em["Subject"] = subject
        if html:
            em.set_content(text or " ")
            em.add_alternative(html, subtype="html")
        else:
            em.set_content(text or "(no content)")

        print(f"[mailer] connecting to SMTP {SMTP_HOST}:{SMTP_PORT} (TLS={SMTP_USE_TLS}) as {SMTP_USER}")
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as s:
            s.set_debuglevel(1)  

            if SMTP_USE_TLS:
                s.ehlo()
                s.starttls()
                s.ehlo()

            s.login(SMTP_USER, SMTP_PASS)

            resp = s.send_message(em)
           
            if resp:
                print("[mailer] send_message returned errors:", resp)
                return False, f"SMTP refused recipient(s): {resp}"

        print(f"[mailer] sent → {to}")
        return True, None

    except smtplib.SMTPAuthenticationError as e:
        print("[mailer] AUTH error:", repr(e))
        return False, "SMTP authentication failed (check SMTP_USER/SMTP_PASS; for Gmail use an App Password)"
    except smtplib.SMTPResponseException as e:
        print("[mailer] SMTP response error:", e.smtp_code, e.smtp_error)
        return False, f"SMTP error {e.smtp_code}: {e.smtp_error!r}"
    except Exception as e:
        print("[mailer] generic error:", repr(e))
        return False, str(e)
def send_password_reset_email(to: str, code: str):
    """
    Convenience helper to send a password reset code.
    Uses the existing send_email() function.
    """
    subject = "Study Group Hub – Password reset code"

    text = f"""Hi,

You requested to reset your Study Group Hub password.

Your verification code is: {code}

This code will expire in 10 minutes. If you did not request this, you can ignore this email.

Thanks,
Study Group Hub Team
"""

    html = f"""
    <p>Hi,</p>
    <p>You requested to reset your <strong>Study Group Hub</strong> password.</p>
    <p>Your verification code is:
       <strong style="font-size:20px;letter-spacing:3px;">{code}</strong>
    </p>
    <p>This code will expire in <strong>10 minutes</strong>.
       If you did not request this, you can ignore this email.</p>
    <p>Thanks,<br/>Study Group Hub Team</p>
    """

    ok, err = send_email(to, subject, html, text)
    if not ok:
        print("[mailer] send_password_reset_email failed:", err)
    return ok, err
