# AGENTS.md - INS-001 Semantic Associations

## Project Overview

INS-001 is a cognitive assessment instrument measuring:
- **Divergence**: Semantic creativity (how far clues venture from predictable associations)
- **Convergence**: Communicability (how accurately recipients guess the seed word)

## Critical Documentation

Read these before making changes:

1. `CONVENTIONS.md` - Implementation rules (MUST READ)
2. `INS-001-ARCHITECTURE-v3.md` - Technical decisions
3. `INS-001-ROADMAP-v3.md` - What's done, what's pending
4. `INS-001-DECISION-HISTORY.md` - Why things are the way they are

## Locked Components

These cannot be changed without explicit user approval:

| File | What's Locked | Why |
|------|---------------|-----|
| scoring.py | All formulas | Construct validity |
| llm.py | Model name (`claude-haiku-4-5-20251001`) | LLM Alignment metric |
| models.py | Field names | API contract |
| 001_initial.sql | halfvec type | Storage limits |

## Security Invariants

1. **Never use service key in routes** - Use `get_authenticated_client()`
2. **Seed words are open** - No vocabulary validation for seeds
3. **Clues/guesses are closed** - Must validate against vocabulary
4. **XML-escape LLM inputs** - Defense in depth

## Consultation Required

Always ask the user before:
- Adding dependencies
- Changing API shapes
- Modifying schema
- Security changes
- Anything not in the roadmap

## Implementation Status

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

## Code Style

- Use async/await consistently
- Error responses use dict format: `{"error": "...", "detail": "..."}`
- Validate clues/guesses against vocabulary
- Use contextual embeddings for scoring (include clues as context)

## When In Doubt

1. Read the relevant documentation
2. Check CONVENTIONS.md
3. Ask the user
4. Propose options, don't decide unilaterally
