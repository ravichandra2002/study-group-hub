# backend/helpers.py
from __future__ import annotations

import re
from datetime import datetime
from typing import Optional, Tuple

from bson import ObjectId
from flask import g
from flask_jwt_extended import get_jwt_identity, get_jwt, verify_jwt_in_request

# ---------------------------------------------------------------------
# General utilities
# ---------------------------------------------------------------------

def now_utc() -> datetime:
    """Naive UTC datetime for Mongo (consistent with the rest of the app)."""
    return datetime.utcnow()

def oid(value) -> Optional[ObjectId]:
    """Parse a value into an ObjectId, or return None if invalid."""
    if value is None:
        return None
    try:
        return ObjectId(str(value))
    except Exception:
        return None

# ---------------------------------------------------------------------
# University / tenant helpers
# ---------------------------------------------------------------------

_FREE_MAIL_PROVIDERS = {
    # common personal mail providers to reject
    "gmail.com", "googlemail.com",
    "yahoo.com", "ymail.com",
    "outlook.com", "hotmail.com", "live.com", "msn.com",
    "icloud.com", "me.com", "mac.com",
    "proton.me", "protonmail.com",
    "aol.com", "gmx.com", "yandex.com",
    "zoho.com", "mail.com",
}

def extract_domain(email: str) -> Optional[str]:
    """Return the domain (lower-case) part of an email, or None."""
    if not email or "@" not in email:
        return None
    return email.rsplit("@", 1)[1].strip().lower()

def is_university_domain(domain: str) -> bool:
    """
    Heuristic acceptance of academic domains:
      - *.edu  or *.edu.*
      - *.ac.* (e.g., ac.uk, ac.jp)
    Rejects known free-mail providers.
    """
    if not domain:
        return False
    d = domain.lower()
    if d in _FREE_MAIL_PROVIDERS:
        return False
    if d.endswith(".edu") or ".edu." in d:
        return True
    if ".ac." in d:
        return True
    return False

def _tenant_root_label(domain: str) -> Optional[str]:
    """
    Root label used as the tenant slug base.
      kent.edu -> 'kent'
      csuohio.edu -> 'csuohio'
      cam.ac.uk -> 'cam'
      sub.dept.kent.edu -> 'kent'
    """
    if not domain:
        return None
    parts = [p for p in domain.split(".") if p]
    try:
        if parts[-1] == "edu" and len(parts) >= 2:
            return parts[-2]
        if "edu" in parts:
            idx = parts.index("edu")
            if idx > 0:
                return parts[idx - 1]
        if "ac" in parts:
            idx = parts.index("ac")
            if idx > 0:
                return parts[idx - 1]
    except Exception:
        pass
    return None

_slug_re = re.compile(r"[^a-z0-9]+")

def _slugify(s: str) -> str:
    s = (s or "").strip().lower()
    s = _slug_re.sub("_", s)
    return s.strip("_")

def university_from_email(email: str) -> Tuple[str, str, str]:
    """
    Returns (domain, tenant_slug, db_name) for a valid university address.
    Raises ValueError if invalid / public email.
    """
    domain = extract_domain(email)
    if not domain or not is_university_domain(domain):
        raise ValueError("Use a valid university email address")
    root = _tenant_root_label(domain) or domain.split(".")[0]
    tenant = _slugify(root)
    db_name = f"study_group_hub_{tenant}"
    return domain, tenant, db_name

def tenant_from_request(fallback_email: Optional[str] = None) -> Optional[str]:
    """
    Preferred: read 'tenant' claim from the current JWT.
    Fallback: infer from given email.
    """
    try:
        verify_jwt_in_request(optional=True)
        claims = get_jwt() or {}
        t = claims.get("tenant")
        if t:
            return _slugify(str(t))
    except Exception:
        pass
    if fallback_email:
        try:
            _, tenant, _ = university_from_email(fallback_email)
            return tenant
        except Exception:
            return None
    return None

# Convenience aliases for auth.py imports (backwards compat)
def extract_email_domain(email: str) -> Optional[str]:
    return extract_domain(email)

def is_public_email_domain(domain: str) -> bool:
    return (domain or "").lower() in _FREE_MAIL_PROVIDERS

# ---------------------------------------------------------------------
# Auth / user helpers
# ---------------------------------------------------------------------

def current_user(db) -> Optional[dict]:
    """
    Load the current user document (for the active tenant DB) using the JWT identity.
    Identity can be a Mongo id or an email.
    """
    try:
        verify_jwt_in_request()
    except Exception:
        return None

    ident = get_jwt_identity()
    if ident is None:
        return None

    _id = oid(ident)
    if _id:
        doc = db.users.find_one({"_id": _id})
        if doc:
            return doc

    if isinstance(ident, str) and "@" in ident:
        return db.users.find_one({"email": ident.strip().lower()})

    return None
