# Phronos Instruments

Repository for cognitive assessment instruments developed by Phronos Observatory.

## Instruments

- **[INS-001: Semantic Associations](ins-001/)** - Measures semantic creativity (divergence) and communicability (convergence)

## Structure

```
phronos-instruments/
├── shared/              # Shared design system and utilities
├── ins-001/             # Semantic Associations instrument
│   ├── api/             # FastAPI backend
│   ├── web/             # Astro + React frontend
│   └── docs/            # Architecture, roadmap, conventions
├── analytics/           # SQL views for research notebooks
└── ins-002/             # Future instruments
```

## Development

Each instrument is self-contained with its own API and frontend. See individual instrument READMEs for setup instructions.

## Links

- **Main Site:** https://phronos.org
- **Instruments:** https://instruments.phronos.org
- **API:** https://api.instruments.phronos.org
