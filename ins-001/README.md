# INS-001: Semantic Associations

Cognitive assessment instrument measuring semantic creativity and communicability.

## What It Measures

- **Divergence**: How far your associations venture from predictable semantic neighborhoods
- **Convergence**: How accurately others can decode your associations

## Architecture

- **Backend**: FastAPI on Railway
- **Frontend**: Astro + React on Vercel
- **Database**: Supabase PostgreSQL with pgvector
- **Embeddings**: OpenAI `text-embedding-3-small`
- **LLM Guesser**: Claude Haiku 4.5

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - Technical architecture
- [Roadmap](docs/ROADMAP.md) - Implementation status
- [Conventions](docs/CONVENTIONS.md) - Critical implementation rules
- [Decision History](docs/DECISION-HISTORY.md) - Why decisions were made

## Setup

### Backend

```bash
cd ins-001/api
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

### Frontend

```bash
cd ins-001/web
npm install
npm run dev
```

## Vocabulary Loading

Before the API can function, vocabulary embeddings must be loaded:

```bash
cd ins-001/api
python scripts/embed_vocabulary.py
```

This loads 50K English words from wordfreq and embeds them via OpenAI.
