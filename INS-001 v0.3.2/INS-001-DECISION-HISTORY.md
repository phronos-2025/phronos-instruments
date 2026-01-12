# INS-001 Decision History

**Purpose:** Preserve architectural decisions, rationale, and evolution for posterity.  
**Date Range:** 2026-01-11 to 2026-01-12

---

## 1. Architecture Evolution

### v1 → v2: The Great Simplification

| v1 (Abandoned) | v2 (Implemented) | Rationale |
|----------------|------------------|-----------|
| Three runtimes (Vercel + Edge Functions + Railway) | Two runtimes (Vercel + Railway) | Reduced complexity. Edge Functions were premature optimization. Accept 300-400ms latency. |
| GloVe static embeddings | OpenAI contextual embeddings | GloVe collapsed polysemous words into single vectors. "Bank" became a blend of financial/riverbank. Broke divergence scoring. |
| Groq/Llama for LLM guesser | Claude Haiku 4.5 | Construct validity requires consistent capability. Can't change models mid-study. |
| Extensive schema (assessment_types, matching_queue, consent_versions) | Core tables only | YAGNI. Build what you need when you need it. |
| Custom anonymous sessions | Supabase Anonymous Auth | Off-the-shelf, secure, handles conversion. |
| APScheduler for background jobs | pg_cron | pg_cron survives process restarts. |
| Custom logging infrastructure | PostHog + Sentry | Purpose-built tools are better. |
| Supabase Pro ($25/mo) | Supabase Free + halfvec | halfvec gives 50% storage reduction. Manual backups until data is valuable. |
| vector(1536) | halfvec(1536) | 16-bit floats: ~150MB instead of ~300MB. Fits in 500MB free tier. |

### v2 → v2.5: Cost Optimization

**Problem:** Original design assumed Supabase Pro ($25/mo) for PITR backups.

**Solution:** 
- Use halfvec (16-bit) instead of vector (32-bit) for embeddings
- 50K words × 1536 dims × 2 bytes = ~150MB instead of ~300MB
- Manual backups to Cloudflare R2 (10GB free)
- Upgrade to Pro when: >100 active users, or any revenue

**Monthly cost:** $11 (Railway $5 + OpenAI ~$1 + Claude ~$5)

### v2.5 → v2.6: Open Seed Words

**Problem:** Originally required seed words to be in vocabulary. Users complained they couldn't use domain-specific terms, proper nouns, slang.

**Analysis:**
- Seed word never enters LLM prompt (it's the hidden answer)
- Only visible to two consenting players
- OpenAI can embed ANY string via subword tokenization
- No legal requirement to filter (Section 230)
- Gibberish seeds produce weak games, not crashes

**Decision:** Allow any seed word. Track `seed_in_vocabulary` for analytics filtering.

**Clues/guesses remain vocabulary-restricted:**
- Clues go to LLM prompt → need validation
- Guesses need reliable embeddings → need vocabulary lookup

---

## 2. Security Decisions

### The Service Key Catastrophe (Almost)

**Near-miss:** Initial implementation used `SUPABASE_SERVICE_KEY` in route handlers.

**Problem:** Service key bypasses ALL Row Level Security. Any authenticated user could read/write any data.

**Fix:** 
```python
# CORRECT: Create client with user's JWT
supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
supabase.auth.set_session(user_jwt, "")
# RLS now enforced based on auth.uid()
```

**Rule:** Service key is ONLY for background jobs (profile computation, cleanup).

### The Double-Join Race Condition

**Bug:** Two users clicking same share link simultaneously could both join.

**Fix:** Row-level locking in Postgres:
```sql
SELECT st.game_id INTO v_game_id
FROM share_tokens st
WHERE st.token = share_token_input
FOR UPDATE;  -- Blocks concurrent transactions
```

### Share Tokens vs Game IDs

**Original design:** Share link contained game_id directly.

**Problem:** 
- Game ID is permanent, can't invalidate share link
- Exposing internal IDs is a security smell

**Solution:** Separate `share_tokens` table with one-time use tokens:
- Token is random hex, not guessable
- Can be deactivated without affecting game
- One-time use (is_active = FALSE after join)

### The Self-Play Exploit

**Bug:** Users could share game with themselves to inflate stats.

**Fix:** Check in join function:
```sql
IF v_game_sender_id = v_recipient_id THEN
    RAISE EXCEPTION 'You cannot join your own game';
END IF;
```

---

## 3. Embedding Decisions

### Why Not GloVe?

GloVe (and Word2Vec) are static embeddings that collapse word senses:

```
glove("bank") = 0.3 * financial_bank + 0.7 * river_bank
```

When user selects "bat" (animal) and clues "vampire, cave, nocturnal", the noise floor is calculated from the static "bat" vector which is dominated by baseball associations. Divergence scores become meaningless.

**Solution:** OpenAI contextual embeddings with sense injection:
```python
embed("bank (in context: river, fish, water)")  # riverbank meaning
embed("bank (in context: money, savings, account)")  # financial meaning
```

### Why OpenAI vs Self-Hosted?

| Option | Cost | Latency | Quality |
|--------|------|---------|---------|
| OpenAI text-embedding-3-small | $0.02/1M tokens | ~200ms | Excellent |
| Self-hosted sentence-transformers | $0 (compute) | ~50ms | Good |
| GloVe static | $0 | <1ms | Poor (polysemy) |

**Decision:** OpenAI. Cost is negligible (~$1/mo). Quality is better. Maintenance is zero.

### Noise Floor: Precomputed vs On-Demand

**Evolution:**
1. v1: Precomputed only (word must be in vocabulary)
2. v2.6: On-demand for any word (embed via OpenAI, query vocabulary)

**Implementation:**
```python
# Always embed on-demand (handles any word)
seed_emb = await get_embedding(seed_word)

# Query vocabulary table for nearest neighbors
result = supabase.rpc("get_noise_floor_by_embedding", {
    "seed_embedding": seed_emb,
    "seed_word": seed_word,
    "k": 20
})
```

**Cost:** ~$0.00002 per request. Negligible.

---

## 4. Scoring Decisions

### Fuzzy Exact Match

**Problem:** Misspellings like "Ghandi" vs "Gandhi" should count as correct.

**Solution:** If embedding similarity > 99%, treat as exact match:
```python
FUZZY_EXACT_MATCH_THRESHOLD = 0.99

if max_similarity > FUZZY_EXACT_MATCH_THRESHOLD:
    return 1.0, True  # exact_match = True
```

### The Polysemy Exploit (Unresolved)

**Scenario:** 
- User picks "bat" (animal)
- Noise floor: vampire, cave, nocturnal, wing
- User clues: "baseball"

**Result:**
- Divergence: High (baseball is far from animal words)
- Convergence: High (recipient guesses "bat" from "baseball")

**Problem:** User exploited knowledge of alternate meaning, not creativity.

**Options Considered:**
1. Accept as strategy (current)
2. Sense consistency penalty (future)
3. UI warning (future)

**Decision:** Accept for MVP. Monitor frequency. Build sense consistency check if exploitation is common.

### Contextual Embeddings for Scoring

**Critical insight:** Use clues as context when embedding guesses.

```python
# Seed word is embedded in context of clues
seed_emb = await get_contextual_embedding(game["seed_word"], clues)

# Guesses are embedded in context of clues
guess_embs = [await get_contextual_embedding(g, clues) for g in guesses]
```

This ensures polysemous seeds are disambiguated by the clues.

---

## 5. Database Decisions

### halfvec vs vector

**Problem:** vector(1536) uses 32-bit floats = 6KB per embedding. 50K words = 300MB. Exceeds free tier headroom.

**Solution:** halfvec(1536) uses 16-bit floats = 3KB per embedding. 50K words = 150MB.

**Tradeoff:** Slight precision loss (16-bit vs 32-bit). Not significant for cosine similarity.

**Index consideration:** Must use `halfvec_cosine_ops`, not `vector_cosine_ops`:
```sql
CREATE INDEX idx_vocab_embedding ON vocabulary_embeddings 
    USING ivfflat (embedding halfvec_cosine_ops) WITH (lists = 100);
```

### JSONB for Noise Floor

**Decision:** Store noise floor as JSONB in games table, not as separate rows.

```sql
noise_floor JSONB NOT NULL  -- [{word: "dog", similarity: 0.85}, ...]
```

**Rationale:** 
- Always read together
- Never queried individually
- Simplifies schema

### Why Not Prisma/Drizzle?

**Considered:** TypeScript ORMs for type safety.

**Decision:** Raw SQL + Supabase client.

**Rationale:**
- pgvector operations need raw SQL anyway
- Supabase client handles auth/RLS
- Less abstraction = fewer surprises

---

## 6. LLM Guesser Decisions

### Why Claude Haiku?

| Model | Cost | Latency | Quality |
|-------|------|---------|---------|
| Claude Haiku 4.5 | $0.25/1M input | ~500ms | Good |
| GPT-4o-mini | $0.15/1M input | ~400ms | Good |
| Groq Llama 3.1 8B | Free | ~200ms | Variable |

**Decision:** Claude Haiku 4.5

**Rationale:**
- Construct validity requires consistent model capability
- Can't change models during study (confounds results)
- Haiku is fast and cheap enough
- Anthropic alignment with project values

### Prompt Structure

**Original:** Plain text prompt with clues inline.

**Final:** XML-escaped clues in structured format:
```xml
<clues>
  <clue>morning</clue>
  <clue>caffeine</clue>
  <clue>bean</clue>
</clues>
```

**Rationale:** Defense in depth. Even though clues are validated against vocabulary, escape them anyway.

### Temperature Setting

**Options:** 0.0 (deterministic), 0.3 (slight variety), 0.7 (creative)

**Decision:** 0.3

**Rationale:** Some variety prevents memorization, but mostly consistent for construct validity.

---

## 7. Deferred Decisions

### Stranger Matching Queue

**Problem:** Need strangers to play against for C_stranger metric.

**Challenge:** Cold start problem. No strangers until users exist.

**Decision:** Defer. Launch with:
1. LLM guesser (always available)
2. Friend sharing (network effects)

**Future:** Add matching queue when user base is large enough (>1000 MAU).

### Bridging Mode

**Concept:** Multiple seed words that "bridge" different semantic domains.

**Challenge:** Complex UI, polysemy handling harder, scoring unclear.

**Decision:** Ship Single Seed first. Validate core mechanics before adding complexity.

### Email Notifications

**When needed:** Notify recipient when game is ready.

**Decision:** Defer. Share links work for MVP. Add notifications when:
- Users complain about missed games
- Conversion data shows drop-off at notification point

### Full Consent Versioning

**Original design:** Complex consent_versions table, user_consents join table.

**Decision:** Simple boolean + timestamp for MVP:
```sql
terms_accepted_at TIMESTAMPTZ  -- NULL = not accepted
```

**Upgrade when:** Legal requires versioned consent tracking.

---

## 8. Blocklist Decision

### v2.4: Blocklist Required

**Implementation:** Downloaded LDNOOBW blocklist, filtered vocabulary, script fails if blocklist missing.

### v2.6: Blocklist Disabled

**Analysis:**
- Seed word never enters LLM prompt
- Only visible to two consenting players in private game
- No legal requirement (Section 230 protects platforms)
- Blocklist adds complexity, maintenance burden
- Users might legitimately want to use "offensive" words in context

**Decision:** Disable blocklist for MVP. Uncomment if:
- App store distribution requires it
- Abuse patterns emerge
- Legal advice changes

**Code:**
```python
def is_blocked_word(word: str) -> bool:
    # return word.lower().strip() in BLOCKLIST
    return False  # Disabled for MVP
```

---

## 9. Lessons Learned

### Start Simple

Original v1 had:
- Three runtimes
- Edge Functions for "performance"
- Extensive schema for "flexibility"
- Custom everything

v2 shipped with:
- Two runtimes
- No Edge Functions
- Minimal schema
- Off-the-shelf auth/analytics

### Security First

Almost shipped with service key in route handlers. Would have been a catastrophic data breach.

**Lesson:** Write CRITICAL security rules first. Reference them constantly.

### YAGNI Applied

Tables that were designed but never created:
- `assessment_types`
- `assessment_sessions`
- `matching_queue`
- `consent_versions`
- `user_consents`

**Lesson:** Don't build what you don't need yet.

### Document Critical Decisions

CONVENTIONS.md was invaluable. Critical rules in one place:
- Never use service key in routes
- Open seeds, closed clues/guesses
- Halfvec storage
- FOR UPDATE locking

**Lesson:** Write the rules before writing the code.

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-11 | - | Initial architecture |
| 2.0.0 | 2026-01-11 | - | Simplified, contextual embeddings |
| 2.1.0 | 2026-01-11 | - | Security hardening |
| 2.2.0 | 2026-01-11 | - | RLS fixes, share tokens |
| 2.3.0 | 2026-01-11 | - | Race condition fix |
| 2.4.0 | 2026-01-11 | - | Blocklist, self-play prevention |
| 2.5.0 | 2026-01-12 | - | Cost optimization (halfvec) |
| 2.6.0 | 2026-01-12 | - | Open seed words |
| 3.0.0 | 2026-01-12 | - | Implementation complete, docs updated |
