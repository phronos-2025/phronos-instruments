"""
Logical dump - INS-001

Captures what PostgREST cannot see: RLS policies, SQL functions, triggers, cron
jobs, sequences, and the auth schema. Complements backup_all.py (which exports
row data) and export_vocab_artifact.py (which exports the vectors).

`vocabulary_embeddings` DATA is excluded on purpose. It is 479 MB of incompressible
float text and is already captured, verbatim and checksummed, as vocab_embeddings.npy.
Its SCHEMA is still dumped, so the table can be recreated and reloaded from the
artifact if the drop ever needs undoing.

Usage:
    python scripts/pg_backup.py [--out DIR]
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _secrets import libpq_env, load_secrets, safe_dsn  # noqa: E402

# Supabase-internal schemas the `postgres` role cannot fully read. Dumping them
# aborts the whole run, and none of them hold project data.
EXCLUDE_SCHEMAS = ["vault", "pgsodium", "pgsodium_masks", "graphql", "graphql_public"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(Path.home() / "Documents" / "phronos-backups"))
    args = parser.parse_args()

    load_secrets()
    env = libpq_env()

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")
    out = Path(args.out) / stamp
    out.mkdir(parents=True, exist_ok=True)
    dump = out / "schema_and_data.dump"

    cmd = [
        "pg_dump",
        "--format=custom",
        "--no-owner",
        "--no-acl",
        "--verbose",
        "--exclude-table-data=public.vocabulary_embeddings",
        *[f"--exclude-schema={s}" for s in EXCLUDE_SCHEMAS],
        "--file", str(dump),
    ]

    print(f"pg_dump {safe_dsn()}")
    print(f"  -> {dump}")
    print(f"  excluding data: public.vocabulary_embeddings (backed up as .npy)")
    print(f"  excluding schemas: {', '.join(EXCLUDE_SCHEMAS)}\n")

    r = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=1800)
    warnings = [l for l in r.stderr.splitlines() if "warning" in l.lower() or "error" in l.lower()]
    if r.returncode != 0:
        print("pg_dump FAILED:\n" + r.stderr[-3000:])
        return 1
    for w in warnings[:20]:
        print("  " + w)

    size = dump.stat().st_size
    print(f"\nWrote {dump.name}: {size / 1e6:.1f} MB")

    # Inventory the table of contents so the dump's completeness is visible.
    toc = subprocess.run(["pg_restore", "--list", str(dump)], capture_output=True, text=True)
    (out / "dump_toc.txt").write_text(toc.stdout)
    counts = {}
    for line in toc.stdout.splitlines():
        for kind in ("TABLE DATA", "TABLE", "FUNCTION", "TRIGGER", "POLICY", "VIEW", "INDEX", "SEQUENCE"):
            if f" {kind} " in line:
                counts[kind] = counts.get(kind, 0) + 1
                break
    print("\nDump contents:")
    for k in sorted(counts):
        print(f"  {k:12} {counts[k]:>4}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
