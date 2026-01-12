# INS-001 Semantic Associations — Technical Architecture

**Version:** 3.0.0  
**Date:** 2026-01-12  
**Status:** Backend Implemented, Frontend Pending

---

## 1. Executive Summary

INS-001 measures **semantic creativity** (divergence from predictable associations) and **communicability** (convergence with recipients across three contexts: network, strangers, LLM). The architecture supports real-time embedding calculations, asynchronous multiplayer, and longitudinal cognitive profiles.

**Architecture:** Two-runtime deployment with React/Astro frontend on Vercel and Python FastAPI backend on Railway, backed by Supabase PostgreSQL with pgvector.

**Monthly cost:** ~$11 (Railway $5 + OpenAI embeddings ~$1 + Claude Haiku ~$5)

**Storage optimization:** Vocabulary embeddings use `halfvec` (16-bit floats) to fit 50K vectors in Supabase Free tier (~150MB).

**Implementation Status:**
| Component | Status |
|-----------|--------|
| Database schema | ✅ Complete |
| Auth middleware | ✅ Complete |
| Embedding service | ✅ Complete |
| Scoring algorithms | ✅ Complete |
| LLM guesser | ✅ Complete |
| Games API | ✅ Complete |
| Share/Join API | 🔄 Partial |
| Users/Profiles API | ⏳ Pending |
| Frontend | ⏳ Pending |
| Observability | ⏳ Pending |

---

## 2. Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Runtimes** | Vercel + Railway | Two deployment surfaces. Accept 300-400ms latency for embedding operations. |
| **Embeddings** | OpenAI `text-embedding-3-small` | Contextual embeddings solve polysemy. $0.02/1M tokens. |
| **Database** | Supabase PostgreSQL Free + pgvector | Managed hosting, vector similarity, RLS. `halfvec` for 50% storage reduction. |
| **LLM Guesser** | Claude Haiku 4.5 | Fast, cheap, consistent capability for construct validity. |
| **Auth** | Supabase Auth (including Anonymous Auth) | Built-in JWT handling, RLS integration. |
| **Background Jobs** | Supabase pg_cron | Scheduled jobs survive restarts. |
| **Analytics** | PostHog + Sentry | Funnel analytics, error tracking. |
| **Listings** | phronos.org/instruments/ |  Static Astro page listing instruments |
| **Description** | phronos.org/instruments/semantic-associations | Static description/landing page |
| **App Front-end** | instruments.phronos.org/ | React app (INS-001) |
| **Share Link Entry Point** | instruments.phronos.org/join/{token} | Share link entry point |
| **API** | api.instruments.phronos.org/ | FastAPI backend (or subdomain of subdomain) |

User flow:
1. Reads about INS-001 at phronos.org/instruments/semantic-associations
2. Clicks "Launch Instrument" → instruments.phronos.org
3. Plays game, gets results
4. Link back to phronos.org/methods/... for methodology details

### Decisions Deferred

| Feature | Reason |
|---------|--------|
| Supabase Pro ($25/mo) | Not needed until data loss is unacceptable or >400MB storage. |
| Stranger matching queue | Cold start problem. Launch with LLM + friend sharing. |
| Bridging mode | Ship Single Seed first. |

---

## 3. The Embedding Architecture

### 3.1 Why Contextual Embeddings

Static embeddings (GloVe) collapse polysemous words into single vectors. "Bank" becomes a blend of financial institution and riverbank. Divergence scores become noise.

**Solution:** OpenAI `text-embedding-3-small` with context injection:

```python
# embeddings.py - IMPLEMENTED
async def get_contextual_embedding(word: str, context: list[str]) -> list[float]:
    """Embed a word in semantic context."""
    if context:
        text = f"{word} (in context: {', '.join(context)})"
    else:
        text = word
    response = await openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding
```

### 3.2 Hybrid Embedding Strategy

| Operation | Embedding Type | Source | Latency |
|-----------|----------------|--------|---------|
| Noise floor | On-demand via OpenAI | Any seed word | ~300ms |
| Divergence scoring | Contextual (OpenAI) | Clues in seed context | ~300ms |
| Convergence scoring | Contextual (OpenAI) | Guesses in clue context | ~300ms |
| Word validation | Precomputed | Vocabulary table | <10ms |

### 3.3 Open Seed Words

Seed words are **unrestricted**—users can enter any word:
- Domain-specific terms (tachycardia, estoppel)
- Proper nouns (Shakespeare, Obi-Wan)
- Slang and neologisms (rizz, skibidi)
- Made-up words (will produce weak noise floors)

**Why this is safe:**
1. Seed never enters LLM prompt (it's the hidden answer)
2. Only visible to two consenting players
3. OpenAI embeds any string via subword tokenization
4. Gibberish produces weak games, not crashes

**Clues and guesses** remain vocabulary-restricted for prompt safety and scoring reliability.

---

## 4. Scoring Algorithms

> **Source of truth:** `scoring.py` contains the exact implementations with tests.

### 4.1 Divergence

**Definition:** How far the sender's clues venture from predictable associations.

```
divergence = 1 - mean(cosine_similarity(clue_embeddings, floor_centroid))
```

**Range:** [0, 1]. Higher = more creative.

**Interpretation:**
- 0.0-0.3: Low divergence (conventional)
- 0.3-0.6: Moderate divergence
- 0.6-1.0: High divergence (creative)

### 4.2 Convergence

**Definition:** How accurately the recipient guesses the seed word.

```
convergence = max(cosine_similarity(guess_embeddings, seed_embedding))
```

**With bonuses:**
- String exact match (case-insensitive): return 1.0
- Fuzzy exact match (>99% similarity): return 1.0 (handles misspellings like Ghandi/Gandhi)

**Range:** [0, 1]. Higher = better communication.

### 4.3 Derived Metrics

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| **Semantic Portability** | C_stranger / C_network | How well associations travel outside your context |
| **Consistency** | 1 - (σ_divergence / μ_divergence) | Reliability of pattern across games |
| **LLM Alignment** | C_llm / C_stranger | Whether you think like the "statistical average" |

### 4.4 Profile Archetypes

| Divergence | Network | Stranger | Archetype |
|------------|---------|----------|-----------|
| High | High | High | **Creative Communicator** |
| High | High | Low | **In-Group Creator** |
| High | Low | Low | **Idiosyncratic** |
| Low | High | High | **Conventional Coordinator** |
| Low | Low | Low | **Communication Difficulty** |

### 4.5 Profile Thresholds

Profiles require 15 games minimum across recipient types:
- Divergence: 5 games
- Network Convergence: 5 games
- Stranger/LLM Convergence: 5 games (combined)

---

## 5. Data Model

> **Source of truth:** `001_initial.sql`

### 5.1 Core Tables

```
vocabulary_embeddings    50K words with halfvec(1536) embeddings
users                    Extends auth.users, tracks anonymous status
games                    Core game records with seed, clues, guesses, scores
share_tokens             One-time use tokens for game invitations
social_edges             Graph of who has played together
user_profiles            Computed cognitive profile aggregates
```

### 5.2 Key Design Decisions

**halfvec for storage:**
```sql
embedding halfvec(1536)  -- 16-bit floats: ~150MB for 50K words
-- NOT: embedding vector(1536)  -- 32-bit floats: ~300MB
```

**Separate share tokens:**
```sql
CREATE TABLE share_tokens (
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    game_id UUID REFERENCES games(id),
    is_active BOOLEAN DEFAULT TRUE
);
```
Share tokens are separate from game_id, enabling invalidation without deleting games.

**Open seed tracking:**
```sql
seed_in_vocabulary BOOLEAN DEFAULT TRUE  -- For analytics filtering
```

### 5.3 RLS Policies

All tables enforce Row Level Security:
- `users`: Self only
- `games`: Sender can do everything, recipient can read
- `share_tokens`: Public read (for join flow)
- `social_edges`: Participants can read
- `user_profiles`: Self only
- `vocabulary_embeddings`: Public read

---

## 6. API Contract

### 6.1 Games

| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `/api/v1/games` | POST | ✅ | Create game (returns noise floor) |
| `/api/v1/games/{id}` | GET | ✅ | Get game state |
| `/api/v1/games/{id}/clues` | POST | ✅ | Submit clues (computes divergence) |
| `/api/v1/games/{id}/guesses` | POST | ✅ | Submit guesses (computes convergence) |

### 6.2 Sharing

| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `/api/v1/games/{id}/share` | POST | ⏳ | Generate share token |
| `/api/v1/join/{token}` | POST | ⏳ | Join game via token |

### 6.3 Users & Profiles

| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `/api/v1/users/me` | GET | ⏳ | Get current user |
| `/api/v1/users/me/profile` | GET | ⏳ | Get cognitive profile |
| `/api/v1/users/me/accept-terms` | POST | ⏳ | Accept terms (anonymous users) |

### 6.4 Embeddings

| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `/api/v1/embeddings/floor` | POST | ⏳ | Generate noise floor |
| `/api/v1/embeddings/validate` | POST | ⏳ | Check word in vocabulary |

---

## 7. Security

### 7.1 Authentication Flow

```
Anonymous → signInAnonymously() → Play games → linkIdentity() → Registered
```

### 7.2 Critical: User JWT for RLS

> **Source of truth:** `auth.py`

The backend MUST use the user's JWT, not the service key:

```python
# ✅ CORRECT - RLS enforced
async def get_authenticated_client(credentials):
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    supabase.auth.set_session(credentials.credentials, "")
    response = supabase.auth.get_user()
    return supabase, user_dict

# ❌ WRONG - Bypasses all RLS
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
```

**Service key use:** Background jobs only (profile computation, cleanup).

### 7.3 Input Validation

| Input | Validation | Rationale |
|-------|------------|-----------|
| Seed word | Length 1-50 only | Never enters LLM, private game |
| Clues | Must exist in vocabulary | Goes to LLM prompt |
| Guesses | Must exist in vocabulary | Needs reliable embeddings |

### 7.4 LLM Prompt Safety

User clues are validated AND XML-escaped:

```python
escaped_clues = [html.escape(c) for c in clues]
clue_xml = "\n".join(f"  <clue>{c}</clue>" for c in escaped_clues)
```

### 7.5 Race Condition Prevention

Join flow uses `FOR UPDATE` to prevent double-joins:

```sql
SELECT st.game_id INTO v_game_id
FROM share_tokens st
WHERE st.token = share_token_input
FOR UPDATE;  -- Locks row until transaction completes
```

---

## 8. Observability

### 8.1 Backups (Free Tier)

Daily pg_cron job triggers Railway endpoint to export to Cloudflare R2:

```sql
SELECT cron.schedule('daily-backup', '0 2 * * *', $$
    SELECT net.http_post(
        url := 'https://app.railway.app/api/internal/backup',
        headers := '{"Authorization": "Bearer ${KEY}"}'::jsonb
    );
$$);
```

**Upgrade trigger:** When data loss is unacceptable, upgrade to Supabase Pro ($25/mo) for PITR.

### 8.2 Scheduled Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `expire-games` | Hourly | Set expired status on old games |
| `cleanup-anon-users` | Daily 3am | Remove inactive anonymous users |
| `daily-backup` | Daily 2am | Export to R2 |

### 8.3 Analytics Events (PostHog)

| Event | Properties |
|-------|------------|
| `game_created` | game_id, recipient_type, seed_in_vocabulary |
| `game_completed` | game_id, divergence, convergence |
| `user_converted` | user_id, games_before_conversion |
| `profile_ready` | user_id, games_played |

### 8.4 Alerts

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Embedding API errors | >5% | Page on-call |
| Database size | >400 MB | Upgrade to Pro or prune |
| Game completion rate | <70% | Investigate UX |

---

## 9. Configuration

> **Source of truth:** `config.py`

| Setting | Value | Notes |
|---------|-------|-------|
| NUM_CLUES | 5 | Clues per game |
| NUM_GUESSES | 3 | Guesses allowed |
| NOISE_FLOOR_K | 20 | Words in noise floor |
| LLM_TEMPERATURE | 0.3 | Claude guesser temperature |
| FUZZY_EXACT_MATCH_THRESHOLD | 0.99 | Similarity for "exact" match |
| PROFILE_THRESHOLD_GAMES | 15 | Games needed for profile |

**Blocklist:** Disabled for MVP. No clear benefit for private games between consenting players.

---

## 10. File Structure

```
app/
├── main.py              # FastAPI app, routes mounted here
├── config.py            # Environment variables, settings
├── models.py            # Pydantic models (API contract)
├── auth.py              # JWT validation middleware
├── games.py             # Game CRUD routes
├── scoring.py           # Divergence/convergence algorithms
├── embeddings.py        # OpenAI integration, validation
├── llm.py               # Claude guesser
└── [pending]
    ├── share.py         # Share token routes
    ├── users.py         # User/profile routes
    └── profiles.py      # Profile computation

migrations/
└── 001_initial.sql      # Full schema + RLS + functions + cron
```

---

## 11. Known Limitations

### 11.1 Polysemy Exploit

Users can select "bat" (animal), then clue "baseball" for artificially high divergence.

**Current approach:** Accept as strategy. Monitor via analytics. Future: sense consistency scoring.

### 11.2 Free Tier Storage

500MB limit. Current usage ~235MB with 50K vocabulary. Alert at 400MB.

### 11.3 No PITR

Free tier has no point-in-time recovery. Manual backups only.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.0.0 | 2026-01-12 | Reflects actual implementation. Backend complete, frontend pending. Reorganized for clarity. |
| 2.6.0 | 2026-01-12 | Open seed words, fuzzy exact match, blocklist disabled |
| 2.5.0 | 2026-01-12 | Cost optimization: halfvec, manual backups, $11/mo |
| 2.0.0 | 2026-01-11 | Simplified architecture, contextual embeddings |
| 1.0.0 | 2026-01-11 | Initial architecture |
