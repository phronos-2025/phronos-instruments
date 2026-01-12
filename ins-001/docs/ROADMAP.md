# INS-001 Implementation Roadmap v3

**Aligned with Architecture v3.0.0**  
**Date:** 2026-01-12

---

## Current Status

### ✅ Completed (Sprint 1-2)

| Component | Files | Status |
|-----------|-------|--------|
| Database schema | `001_initial.sql` | All tables, RLS, functions, cron jobs |
| Auth middleware | `auth.py` | JWT validation, user/service clients |
| Models | `models.py` | All request/response shapes |
| Config | `config.py` | Settings, blocklist (disabled) |
| Embedding service | `embeddings.py` | OpenAI integration, noise floor, validation |
| Scoring | `scoring.py` | Divergence, convergence, archetypes, tests |
| LLM guesser | `llm.py` | Claude Haiku 4.5 integration |
| Games API | `games.py` | Create, get, clues, guesses endpoints |
| Conventions | `CONVENTIONS.md` | Critical rules documented |

### 🔄 In Progress

| Component | Status | Notes |
|-----------|--------|-------|
| Share routes | Code exists in schema | Route handler needed |
| Route mounting | Routes exist | Uncomment in main.py |

### ⏳ Remaining Work

| Component | Estimated | Priority |
|-----------|-----------|----------|
| Share API routes | 1 day | High |
| Users/Profiles API | 2 days | High |
| Embeddings API routes | 1 day | Medium |
| Frontend (React/Astro) | 5-7 days | High |
| PostHog integration | 0.5 days | Medium |
| Sentry integration | Done (main.py) | ✅ |
| Manual backup job | 1 day | Low |

---

## Architecture Summary

| Component | Choice | Cost |
|-----------|--------|------|
| Frontend | React/Astro on Vercel | Free |
| Backend | FastAPI on Railway | $5/mo |
| Database | Supabase PostgreSQL Free | Free |
| Embeddings | OpenAI `text-embedding-3-small` | ~$1/mo |
| LLM Guesser | Claude Haiku 4.5 | ~$5/mo |
| Analytics | PostHog | Free tier |
| Error Tracking | Sentry | Free tier |
| **Total** | | **~$11/mo** |

---

## Remaining Sprints

### Sprint 3: Complete API + Sharing (Days 1-3)

```
Day 1: Mount Routes + Share API
├── Uncomment route imports in main.py
├── Create share.py route handler
│   ├── POST /api/v1/games/{id}/share → generate token
│   └── POST /api/v1/join/{token} → call join_game_via_token()
├── Test end-to-end game creation + sharing
└── Verify RLS policies work correctly

Day 2: Users + Profiles API
├── Create users.py route handler
│   ├── GET /api/v1/users/me
│   ├── GET /api/v1/users/me/profile
│   └── POST /api/v1/users/me/accept-terms
├── Create profiles.py service
│   └── Profile computation logic
└── Test anonymous user flow

Day 3: Embeddings API + Testing
├── Create embeddings.py route handler
│   ├── POST /api/v1/embeddings/floor
│   └── POST /api/v1/embeddings/validate
├── Full API integration tests
└── Document any edge cases found
```

**Checkpoint:** Complete API, all routes working

### Sprint 4: Frontend (Days 4-10)

```
Day 4-5: Project Setup + Game UI
├── Astro + React project structure
├── Supabase client integration
├── Core screens:
│   ├── WordInput (seed word entry)
│   ├── SenseDisambiguation (for polysemous words)
│   ├── NoiseFloor (visualization)
│   ├── ClueEntry (5 clue inputs, validation)
│   └── Results (scores + interpretation)
└── Supabase Auth state management

Day 6-7: Account + Sharing
├── Anonymous auth flow (signInAnonymously)
├── Registered auth (magic link)
├── Anonymous → registered conversion (linkIdentity)
├── Terms acceptance modal
├── Share button + link generation
└── Join game flow via token

Day 8-9: Profile + Polish
├── Profile dashboard
│   ├── Divergence visualization
│   ├── Convergence by recipient type
│   ├── Archetype display
│   └── "Games until ready" progress
├── Error handling + loading states
├── Mobile responsiveness
└── Basic styling

Day 10: Integration + Launch Prep
├── PostHog event tracking
├── End-to-end testing
├── README + deployment docs
└── Deploy to Vercel + Railway
```

**Checkpoint:** Playable game, end-to-end

### Sprint 5: Observability + Beta (Days 11-14)

```
Day 11: Analytics
├── PostHog integration
│   ├── game_created event
│   ├── game_completed event
│   ├── user_converted event
│   └── profile_ready event
├── Funnel visualization setup
└── Identify calls on auth

Day 12: Backups + Monitoring
├── Cloudflare R2 setup (free tier)
├── Backup endpoint in Railway
├── pg_cron job for daily backup
└── Storage monitoring dashboard

Day 13-14: Beta Testing
├── Soft launch to friends
├── Collect feedback
├── Bug fixes
└── Iterate on UX issues
```

**Checkpoint:** Production-ready for beta users

---

## Key Implementation Notes

### Mounting Routes (main.py)

```python
# Uncomment these lines:
from app.routes import games, embeddings, users, share

app.include_router(games.router, prefix="/api/v1/games", tags=["games"])
app.include_router(embeddings.router, prefix="/api/v1/embeddings", tags=["embeddings"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(share.router, prefix="/api/v1", tags=["share"])
```

### Share Route Handler

```python
# app/routes/share.py
from fastapi import APIRouter, HTTPException, Depends
from app.auth import get_authenticated_client
from app.models import CreateShareTokenResponse, JoinGameResponse
from app.config import APP_URL

router = APIRouter()

@router.post("/games/{game_id}/share", response_model=CreateShareTokenResponse)
async def create_share_token(game_id: str, auth = Depends(get_authenticated_client)):
    supabase, user = auth
    
    # Verify user owns the game and it's ready to share
    game = supabase.table("games") \
        .select("*") \
        .eq("id", game_id) \
        .eq("sender_id", user["id"]) \
        .eq("status", "pending_guess") \
        .single() \
        .execute()
    
    if not game.data:
        raise HTTPException(404, "Game not found or not ready to share")
    
    # Create share token
    token_result = supabase.table("share_tokens") \
        .insert({"game_id": game_id}) \
        .execute()
    
    token = token_result.data[0]
    return CreateShareTokenResponse(
        token=token["token"],
        expires_at=token["expires_at"],
        share_url=f"{APP_URL}/join/{token['token']}"
    )

@router.post("/join/{token}", response_model=JoinGameResponse)
async def join_game(token: str, auth = Depends(get_authenticated_client)):
    supabase, user = auth
    
    result = supabase.rpc("join_game_via_token", {"share_token_input": token}).execute()
    
    if not result.data:
        raise HTTPException(400, "Failed to join game")
    
    game = result.data[0]
    return JoinGameResponse(
        game_id=str(game["game_id"]),
        seed_word=game["seed_word"],
        clues=game["clues"],
        sender_display_name=game.get("sender_display_name")
    )
```

### Users Route Handler

```python
# app/routes/users.py
from fastapi import APIRouter, HTTPException, Depends
from app.auth import get_authenticated_client
from app.models import UserResponse, ProfileResponse, AcceptTermsRequest
from app.config import PROFILE_THRESHOLD_GAMES

router = APIRouter()

@router.get("/me", response_model=UserResponse)
async def get_current_user(auth = Depends(get_authenticated_client)):
    supabase, user = auth
    
    result = supabase.table("users") \
        .select("*") \
        .eq("id", user["id"]) \
        .single() \
        .execute()
    
    if not result.data:
        raise HTTPException(404, "User not found")
    
    u = result.data
    return UserResponse(
        user_id=u["id"],
        display_name=u.get("display_name"),
        is_anonymous=u["is_anonymous"],
        games_played=u["games_played"],
        profile_ready=u["profile_ready"],
        created_at=u["created_at"]
    )

@router.get("/me/profile", response_model=ProfileResponse)
async def get_profile(auth = Depends(get_authenticated_client)):
    supabase, user = auth
    
    result = supabase.table("user_profiles") \
        .select("*") \
        .eq("user_id", user["id"]) \
        .single() \
        .execute()
    
    # Calculate games until ready
    profile = result.data or {}
    total_games = (
        (profile.get("divergence_n") or 0) +
        (profile.get("network_convergence_n") or 0) +
        (profile.get("stranger_convergence_n") or 0) +
        (profile.get("llm_convergence_n") or 0)
    )
    games_until_ready = max(0, PROFILE_THRESHOLD_GAMES - total_games)
    
    return ProfileResponse(
        user_id=user["id"],
        divergence_mean=profile.get("divergence_mean"),
        divergence_std=profile.get("divergence_std"),
        divergence_n=profile.get("divergence_n", 0),
        network_convergence_mean=profile.get("network_convergence_mean"),
        network_convergence_n=profile.get("network_convergence_n", 0),
        stranger_convergence_mean=profile.get("stranger_convergence_mean"),
        stranger_convergence_n=profile.get("stranger_convergence_n", 0),
        llm_convergence_mean=profile.get("llm_convergence_mean"),
        llm_convergence_n=profile.get("llm_convergence_n", 0),
        semantic_portability=profile.get("semantic_portability"),
        consistency_score=profile.get("consistency_score"),
        archetype=profile.get("archetype"),
        profile_ready=games_until_ready == 0,
        games_until_ready=games_until_ready
    )

@router.post("/me/accept-terms")
async def accept_terms(request: AcceptTermsRequest, auth = Depends(get_authenticated_client)):
    supabase, user = auth
    
    if not request.accepted:
        raise HTTPException(400, "Terms must be accepted")
    
    supabase.table("users") \
        .update({"terms_accepted_at": "now()"}) \
        .eq("id", user["id"]) \
        .execute()
    
    return {"accepted": True}
```

---

## File Structure (Target)

```
phronos-api/
├── app/
│   ├── main.py              # ✅ FastAPI app
│   ├── config.py            # ✅ Settings
│   ├── models.py            # ✅ Pydantic models
│   ├── auth.py              # ✅ JWT middleware
│   ├── games.py             # ✅ Game routes
│   ├── scoring.py           # ✅ Scoring algorithms
│   ├── embeddings.py        # ✅ Embedding service
│   ├── llm.py               # ✅ LLM guesser
│   ├── share.py             # ⏳ Share routes
│   ├── users.py             # ⏳ User routes
│   └── profiles.py          # ⏳ Profile computation
├── migrations/
│   └── 001_initial.sql      # ✅ Full schema
├── scripts/
│   └── embed_vocabulary.py  # ⏳ Vocabulary loader
├── requirements.txt         # ✅ Dependencies
├── CONVENTIONS.md           # ✅ Rules
└── Dockerfile               # ⏳ For Railway

phronos-site/
├── src/
│   ├── pages/
│   │   ├── instruments/
│   │   │   └── semantic-associations.astro
│   │   ├── join/
│   │   │   └── [token].astro
│   │   └── account/
│   │       └── profile.astro
│   ├── components/
│   │   └── instruments/
│   │       └── semantic-associations/
│   │           ├── Game.tsx
│   │           ├── NoiseFloor.tsx
│   │           ├── ClueEntry.tsx
│   │           ├── GuessEntry.tsx
│   │           └── Results.tsx
│   └── lib/
│       ├── supabase.ts
│       ├── api.ts
│       └── posthog.ts
└── package.json
```

---

## Risks & Mitigations

| Risk | Status | Mitigation |
|------|--------|------------|
| RLS bypass via service key | ✅ Mitigated | auth.py uses user JWT |
| Double-join race condition | ✅ Mitigated | FOR UPDATE in join function |
| Self-play data pollution | ✅ Mitigated | join function checks sender ≠ recipient |
| OpenAI latency | Acceptable | ~300ms, not blocking |
| Storage limit (500MB) | Monitoring | halfvec saves 50%, alert at 400MB |
| Low conversion rate | Monitor | PostHog funnel tracking |

---

## Immediate Next Steps

1. **Create share.py** - Share token generation + join flow
2. **Create users.py** - User info + profile endpoints
3. **Mount routes in main.py** - Uncomment imports
4. **Test full API** - Postman/curl tests
5. **Start frontend** - Astro project setup
6. **Deploy to Railway** - Get API running

---

## Definition of Done (MVP)

- [ ] Anonymous user can play vs Claude
- [ ] User can share game link with friend
- [ ] Friend can join and guess
- [ ] Both see scores + interpretation
- [ ] User can create account
- [ ] Profile shows after 15 games
- [ ] PostHog tracking events
- [ ] No critical errors in Sentry
- [ ] Mobile-responsive UI
