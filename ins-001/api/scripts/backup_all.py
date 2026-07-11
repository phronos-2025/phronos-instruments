"""
Full data backup - INS-001

Exports every table to JSON + CSV before the Supabase Pro -> Free migration.
Independent of pg_dump: uses only PostgREST and the Auth Admin API, so it needs
no database password.

PostgREST caps every response at 1000 rows regardless of the requested range,
so every table is paginated explicitly. Assuming a larger page size silently
truncates the export.

Usage:
    python scripts/backup_all.py [--out DIR]

Requires SUPABASE_URL and SUPABASE_SERVICE_KEY (read from ENV_FILE,
scripts/../.env, or ~/Documents/Secrets/instruments-keys.env).
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

PAGE_SIZE = 1000  # PostgREST hard cap

# Every table in the public schema, with the row count observed on 2026-07-10.
# The counts are asserted at the end so a silently truncated export fails loudly.
EXPECTED_ROWS = {
    "vocabulary_embeddings": 30000,
    "games": 193,
    "users": 67,
    "study_evaluations": 17,
    "study_surveys": 13,
    "mailing_list": 12,
    "peer_ratings": 10,
    "study_enrollments": 8,
    "share_tokens": 7,
    "model_versions": 3,
    "system_config": None,  # not counted during review
    "instruments": None,
    "studies": 1,
    "social_edges": 0,
}

# vocabulary_embeddings is backed up by export_vocab_artifact.py as a .npy;
# dumping 30k x 1536 floats to JSON here would produce a ~500 MB file.
SKIP_FULL_DUMP = {"vocabulary_embeddings"}


def load_env() -> tuple[str, str]:
    env_file = os.environ.get("ENV_FILE")
    if env_file:
        load_dotenv(env_file)
    else:
        local = Path(__file__).parent.parent / ".env"
        secrets = Path.home() / "Documents" / "Secrets" / "instruments-keys.env"
        load_dotenv(local if local.exists() else secrets)

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return url.rstrip("/"), key


def request(url: str, key: str, path: str) -> tuple[list, str | None]:
    """GET against PostgREST. Returns (rows, content-range header)."""
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Prefer": "count=exact",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.load(resp), resp.headers.get("content-range")


def fetch_table(url: str, key: str, table: str) -> list[dict]:
    """Fetch every row, paginating around the 1000-row cap.

    No ORDER BY: the tables dumped here all fit in a single page, and there is
    no column name common to all of them. vocabulary_embeddings is the only
    table that spans pages, and it is exported separately with an explicit order.
    """
    rows: list[dict] = []
    offset = 0
    while True:
        page, _ = request(url, key, f"{table}?select=*&offset={offset}&limit={PAGE_SIZE}")
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return rows


def fetch_auth_users(url: str, key: str) -> list[dict]:
    """auth.users is not exposed through PostgREST; use the Admin API."""
    users: list[dict] = []
    page = 1
    while True:
        req = urllib.request.Request(
            f"{url}/auth/v1/admin/users?page={page}&per_page=200",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            batch = json.load(resp).get("users", [])
        if not batch:
            break
        users.extend(batch)
        page += 1
    return users


def write_csv(path: Path, rows: list[dict]) -> None:
    if not rows:
        path.write_text("")
        return
    fields: list[str] = []
    for row in rows:
        for k in row:
            if k not in fields:
                fields.append(k)
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {k: json.dumps(v) if isinstance(v, (dict, list)) else v for k, v in row.items()}
            )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--out",
        default=str(Path.home() / "Documents" / "phronos-backups"),
        help="Backup root; a dated subdirectory is created inside it",
    )
    args = parser.parse_args()

    url, key = load_env()
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")
    out = Path(args.out) / stamp
    out.mkdir(parents=True, exist_ok=True)

    print(f"Backing up {url} -> {out}\n")

    manifest: dict[str, object] = {
        "exported_at": stamp,
        "supabase_url": url,
        "tables": {},
    }
    failures: list[str] = []

    for table, expected in EXPECTED_ROWS.items():
        if table in SKIP_FULL_DUMP:
            _, content_range = request(url, key, f"{table}?select=word&limit=1")
            total = int(content_range.split("/")[-1]) if content_range else -1
            print(f"  {table:24} {total:>6} rows  (skipped: see export_vocab_artifact.py)")
            manifest["tables"][table] = {"rows": total, "dumped": False}
            if expected is not None and total != expected:
                failures.append(f"{table}: expected {expected}, got {total}")
            continue

        try:
            rows = fetch_table(url, key, table)
        except urllib.error.HTTPError as e:
            print(f"  {table:24} FAILED  HTTP {e.code} {e.reason}")
            failures.append(f"{table}: HTTP {e.code}")
            continue

        (out / f"{table}.json").write_text(json.dumps(rows, indent=1, default=str))
        write_csv(out / f"{table}.csv", rows)

        flag = ""
        if expected is not None and len(rows) != expected:
            flag = f"  <-- expected {expected}"
            failures.append(f"{table}: expected {expected}, got {len(rows)}")
        print(f"  {table:24} {len(rows):>6} rows{flag}")
        manifest["tables"][table] = {"rows": len(rows), "dumped": True}

    print()
    auth_users = fetch_auth_users(url, key)
    (out / "auth_users.json").write_text(json.dumps(auth_users, indent=1, default=str))
    print(f"  {'auth.users (Admin API)':24} {len(auth_users):>6} rows")
    manifest["tables"]["auth.users"] = {"rows": len(auth_users), "dumped": True}
    if len(auth_users) != EXPECTED_ROWS["users"]:
        failures.append(f"auth.users: expected {EXPECTED_ROWS['users']}, got {len(auth_users)}")

    (out / "MANIFEST.json").write_text(json.dumps(manifest, indent=1))

    print(f"\nWrote {out}")
    if failures:
        print("\nROW COUNT MISMATCHES — do not proceed:")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("\nAll row counts match. Still required before Phase 1:")
    print("  pg_dump --no-owner --no-acl -Fc \"$DATABASE_URL\" -f schema_and_data.dump")
    print("  (captures RLS policies, functions, triggers, cron jobs — none of which")
    print("   are reachable through PostgREST. Needs DATABASE_URL from the dashboard.)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
