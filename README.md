# Bharat Naukri Alert

> Autonomous Indian opportunity-intelligence engine — scholarships, exams, jobs, schemes. Runs forever on free infrastructure.

## Kya Hai

Ek self-running pipeline jo sarkari portals ko rozana scrape karta hai, har opportunity ko
verify karke structured database me store karta hai, aur ek static website + Telegram alerts
me publish karta hai. Insaan ka rozana involvement zero.

## Architecture

```
sources.json  →  scrapers  →  extraction (LLM/heuristic)  →  verify  →  JSON DB (git)
                                                                    ├── static site (Cloudflare Pages)
                                                                    ├── Telegram digest + bot
                                                                    └── daily archive snapshots
```

- **Zero npm dependencies** — Node 18+ built-in fetch hi sab kuch karta hai (50-year longevity)
- **Multi-provider LLM fallback with key pools**: Gemini (multi-key rotation) → Groq → OpenRouter (keys na ho to heuristic mode)
- **Verification gate**: schema validation + deadline sanity + quarantine (galat entry kabhi publish nahi)
- **Self-evolution**: weekly agent apne metrics/mistakes padh ke recommendations deta hai

## Commands

```bash
npm run scrape      # live scrape + merge + archive
npm run verify      # validation + status flips (open/closing_soon/closed)
npm run build:site  # static site generate → site/dist/
npm run digest      # Telegram broadcast + command handling
npm run health      # source health check
npm run evolve      # weekly self-review report
npm test            # 15-test suite
```

## Directory Map

| Path | Kaam |
|------|------|
| `sources/sources.json` | Source registry — naya source = sirf yahan entry |
| `sources/scrapers/` | RSS + generic link-mining scrapers |
| `lib/` | http, rss, llm, extract, schema, store |
| `engine/` | scrape / verify / health-check / evolve orchestrators |
| `data/opportunities.json` | Live database |
| `data/archive/` | Immutable daily snapshots (permanent history) |
| `data/quarantine/` | Failed-verification entries |
| `memory/` | mistakes.json (learning), metrics.json, reports/ |
| `site/build.js` | Static site generator → `site/dist/` |
| `.github/workflows/` | scrape(4h) · digest(daily) · evolution(weekly) · keepalive(weekly) · CI |

## Setup

See [SETUP.md](SETUP.md) — keys, Telegram bot aur Cloudflare Pages deploy ke steps.

## Design Guarantees

1. **Koi paid dependency nahi** — GitHub Actions (public repo unlimited / private within quota), Cloudflare Pages, free LLM tiers
2. **Git = database** — koi external DB nahi jo mar sake
3. **Graceful degradation** — LLM down → heuristic mode; source dead → baaki sources chalte rahenge; keepalive commits se workflows kabhi disable nahi honge
4. **Trust first** — galat deadline quarantine me jaati hai, publish nahi hoti
