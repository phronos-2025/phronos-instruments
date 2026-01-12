---
description: "Global rules for INS-001 project - consultation requirements and required reading"
alwaysApply: true
---

# INS-001 Semantic Associations - Global Rules

## BEFORE ANY CHANGE

1. Read the relevant documentation files
2. Understand the existing implementation  
3. **ASK THE USER** for clarification if anything is ambiguous
4. Explain proposed changes and get approval BEFORE implementing

## Required Reading (priority order)

- `CONVENTIONS.md` - Critical implementation rules (MUST READ FIRST)
- `INS-001-ARCHITECTURE-v3.md` - Technical architecture
- `INS-001-ROADMAP-v3.md` - Implementation status
- `INS-001-DECISION-HISTORY.md` - Why decisions were made
- `models.py` - API contract (DO NOT MODIFY FIELD NAMES)
- `scoring.py` - Scoring algorithms (DO NOT MODIFY FORMULAS)

## ALWAYS ASK before:

- Adding new dependencies
- Changing API shapes in models.py
- Modifying database schema
- Adding new endpoints not in roadmap
- Changing scoring logic
- Security-related changes
- Environment variable changes
- Anything not explicitly in the roadmap

## Present Options When:

- Multiple implementation approaches exist
- Trade-offs between performance/complexity
- The specification is ambiguous
- You're unsure about intent

Format: "I see two options: [A] ... [B] ... Which would you prefer?"

## When You Don't Know

1. **Stop and ask** - Don't guess at intent
2. **Quote the relevant doc** - Show what you found
3. **Explain uncertainty** - "I'm not sure if X or Y"
4. **Propose options** - Let user decide

## Quick Reference

### Status Codes
- 200: Success
- 400: Validation error (use ErrorResponse)
- 401: Not authenticated
- 403: Not authorized (RLS blocked)
- 404: Not found
- 500: Server error

### Key Constants (from config.py)
- NUM_CLUES = 5
- NUM_GUESSES = 3
- NOISE_FLOOR_K = 20
- LLM_TEMPERATURE = 0.3
- FUZZY_EXACT_MATCH_THRESHOLD = 0.99
- PROFILE_THRESHOLD_GAMES = 15
