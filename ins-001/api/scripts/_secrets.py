"""
Secrets loading - INS-001 scripts

DATABASE_URL is stored with a placeholder rather than an inline password:

    DATABASE_URL=postgresql://postgres:[DATABASE_PASSWORD]@db.<ref>.supabase.co:5432/postgres
    DATABASE_PASSWORD=<the actual password>

`resolve_database_url()` substitutes the value at runtime and percent-encodes it,
so passwords containing @ : / # ? still produce a parseable URI.

Prefer `libpq_env()` over the resolved URL when shelling out to psql/pg_dump: it
passes the password via PGPASSWORD in the child environment rather than on the
command line, where `ps` would expose it.
"""

from __future__ import annotations

import os
import urllib.parse
from pathlib import Path

from dotenv import load_dotenv

PLACEHOLDER = "[DATABASE_PASSWORD]"


def load_secrets() -> None:
    """Load env from ENV_FILE, api/.env, or ~/Documents/Secrets/instruments-keys.env."""
    env_file = os.environ.get("ENV_FILE")
    if env_file:
        load_dotenv(env_file)
        return
    local = Path(__file__).parent.parent / ".env"
    secrets = Path.home() / "Documents" / "Secrets" / "instruments-keys.env"
    load_dotenv(local if local.exists() else secrets)


def resolve_database_url() -> str:
    """DATABASE_URL with [DATABASE_PASSWORD] substituted and percent-encoded."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")

    if PLACEHOLDER not in url:
        return url  # already inlined

    password = os.environ.get("DATABASE_PASSWORD")
    if not password:
        raise RuntimeError(
            f"DATABASE_URL contains {PLACEHOLDER} but DATABASE_PASSWORD is not set"
        )
    return url.replace(PLACEHOLDER, urllib.parse.quote(password, safe=""))


def libpq_env() -> dict:
    """Environment for psql/pg_dump: connection via PG* vars, password out of argv."""
    parsed = urllib.parse.urlparse(resolve_database_url())
    env = dict(os.environ)
    env.update(
        PGHOST=parsed.hostname or "",
        PGPORT=str(parsed.port or 5432),
        PGUSER=urllib.parse.unquote(parsed.username or ""),
        PGPASSWORD=urllib.parse.unquote(parsed.password or ""),
        PGDATABASE=parsed.path.lstrip("/") or "postgres",
        PGSSLMODE=env.get("PGSSLMODE", "require"),
    )
    return env


def safe_dsn() -> str:
    """The DSN with the password redacted, for logging."""
    p = urllib.parse.urlparse(resolve_database_url())
    return f"{p.scheme}://{p.username}:***@{p.hostname}:{p.port}{p.path}"
