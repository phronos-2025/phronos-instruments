---
description: "Database schema and SQL conventions - halfvec types, RLS, race condition prevention"
globs: ["**/*.sql", "*.sql"]
alwaysApply: false
---

# Database Rules

## halfvec, Not vector

```sql
-- ✅ CORRECT - 16-bit floats, fits in free tier (~150MB)
embedding halfvec(1536)

-- ❌ WRONG - 32-bit floats, exceeds storage (~300MB)
embedding vector(1536)
```

## Index Operators

```sql
-- ✅ CORRECT
USING ivfflat (embedding halfvec_cosine_ops) WITH (lists = 100)

-- ❌ WRONG
USING ivfflat (embedding vector_cosine_ops)
```

## Race Condition Prevention

```sql
-- ✅ REQUIRED for shared resources (tokens, game state)
SELECT ... FOR UPDATE;

-- ❌ WRONG - Race condition on concurrent access
SELECT ... ;
```

## Table Naming

- Lowercase, plural: `games`, `users`, `share_tokens`
- Column names: lowercase, snake_case

## Data Types

```sql
-- UUIDs for primary keys
id UUID PRIMARY KEY DEFAULT gen_random_uuid()

-- Always TIMESTAMPTZ, never TIMESTAMP
created_at TIMESTAMPTZ DEFAULT NOW()

-- Foreign keys with CASCADE
REFERENCES users(id) ON DELETE CASCADE
```

## RLS Policies

All tables MUST have RLS enabled:
```sql
ALTER TABLE tablename ENABLE ROW LEVEL SECURITY;
```

## Schema Changes

Before modifying schema:
1. Check if change affects existing data
2. Ask user about migration strategy
3. Document in DECISION-HISTORY.md
