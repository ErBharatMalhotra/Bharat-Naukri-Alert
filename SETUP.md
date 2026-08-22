# Setup Guide — 30 Minute One-Time

## 1. API Keys (sab free)

| Provider | Link | Kaam |
|----------|------|------|
| Gemini (recommended) | https://aistudio.google.com/apikey | Extraction + evolution brain |
| Groq | https://console.groq.com/keys | Fallback #1 (fast Llama) |
| OpenRouter | https://openrouter.ai/keys | Fallback #2 (`:free` models) |

Ek bhi na ho to system heuristic mode me chalega — but keys dene se extraction quality bahut badhti hai.

## 2. Telegram Bot (5 min)

1. Telegram me `@BotFather` open karo → `/newbot` → naam de do
2. Token copy karo (format: `123456:ABC-xyz`)
3. Public channel banao (e.g. `@avsar_updates`), bot ko **admin** banao
4. Channel ID note karo (`@channelusername` ya numeric `-100...`)

## 3. GitHub Repo + Secrets

```bash
git remote add origin https://github.com/<tumhara-user>/avsar-engine.git
git push -u origin main
```

Repo → Settings → Secrets and variables → Actions, ye add karo:

| Secret | Value |
|--------|-------|
| `GEMINI_API_KEY` | step 1 ka key |
| `TELEGRAM_BOT_TOKEN` | BotFather token |
| `TELEGRAM_CHANNEL_ID` | channel username/ID |

Optional: `GROQ_API_KEY`, `OPENROUTER_API_KEY`, custom `SITE_URL` variable.

## 4. Cloudflare Pages (free hosting)

1. https://dash.cloudflare.com → Workers & Pages → Create → Pages → **Connect to Git**
2. Repo select karo:
   - **Build command:** `node site/build.js`
   - **Build output directory:** `site/dist`
3. Deploy → live URL milega (`avsar-engine.pages.dev`)
4. Custom domain chahiye to Pages → Custom domains (~₹700/saal, optional)

## 5. Workflows Enable Karna

GitHub repo → **Actions** tab → har workflow pe "Enable" karo (scheduled workflows ke liye ek baar manual enable zaroori hota hai). Verify:

- `Scrape Pipeline` → "Run workflow" dabake manual test
- `Telegram Digest` → dry-run khud ho jayega agar secrets nahi hain

## 6. Verification Checklist

```bash
npm test          # 15/15 pass hone chahiye
npm run scrape    # real data aani chahiye (NSP pakka)
npm run verify    # quarantined: 0 ideally
npm run build:site
npm run digest    # [dry-run] message = telegram config pending hai
```

## Troubleshooting

- **Source 403 de raha hai** → bot-block; sources.json me alternate mirror add karo ya browser-like headers — health-check weekly batayega
- **LLM 404 model error** → model retire ho gaya; `GEMINI_MODEL` env var se override karo
- **Workflow disable ho gaya** → keepalive.yml Friday ko commit karta hai; manually re-enable karna padega agar 60+ din repo bilkul inactive raha
