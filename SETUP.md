# Setup Guide — 30 Minute One-Time

## 1. API Keys (sab free)

| Provider | Link | Kaam |
|----------|------|------|
| Gemini (recommended) | https://aistudio.google.com/apikey | Extraction + evolution brain |
| Groq | https://console.groq.com/keys | Fallback #1 (fast Llama) |
| OpenRouter | https://openrouter.ai/keys | Fallback #2 (`:free` models) |

Ek bhi na ho to system heuristic mode me chalega — but keys dene se extraction quality bahut badhti hai.

**Multiple keys = zyada quota.** Har provider ke liye numbered secrets support hain:
Gemini 5 keys → `GEMINI_API_KEY_1` se `GEMINI_API_KEY_5` tak. System round-robin rotate karta hai
(ek key ka limit khatam → agli key), aur sab fail ho jayein to agla provider fallback hai:
**Gemini → Groq → OpenRouter**. Baad me naya key add karna ho to bas naya secret (`GROQ_API_KEY_2`, etc.) bana do — code change ki zaroorat nahi.

## 2. Telegram Bot (5 min)

1. Telegram me `@BotFather` open karo → `/newbot` → naam de do
2. Token copy karo (format: `123456:ABC-xyz`)
3. Public channel banao (e.g. `@bharatnaukri_alert`), bot ko **admin** banao
4. Channel ID note karo (`@channelusername` ya numeric `-100...`)

## 3. GitHub Repo + Secrets

```bash
git remote add origin https://github.com/<tumhara-user>/bharat-naukri-alert.git
git push -u origin main
```

Repo → Settings → Secrets and variables → Actions, ye add karo:

| Secret | Value |
|--------|-------|
| `GEMINI_API_KEY_1` ... `GEMINI_API_KEY_5` | step 1 ki 5 Gemini keys |
| `TELEGRAM_BOT_TOKEN` | BotFather token |
| `TELEGRAM_CHANNEL_ID` | channel username/ID |

Optional: `GROQ_API_KEY_1`, `OPENROUTER_API_KEY_1`, custom `SITE_URL` variable.

## 4. Cloudflare Pages (free hosting)

1. https://dash.cloudflare.com → Workers & Pages → Create → Pages → **Connect to Git**
2. Repo select karo:
   - **Build command:** `node site/build.js`
   - **Build output directory:** `site/dist`
3. Deploy → live URL milega (`bharat-naukri-alert.pages.dev`)
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

- **Source 403 de raha hai** → bot-block; sources.json me alternate mirror add karo — PIB ko browser-like UA chahiye (http.js me set hai)
- **LLM 404 model error** → model retire ho gaya; `GEMINI_MODEL` env var se override karo
- **API quota bachana hai** → `LLM_MAX_CALLS` env se per-run LLM budget control hota hai (default 8). System pehle dedupe + heuristic use karta hai, LLM sirf tab jab deadline heuristic se na mile
- **Workflows disable** → repo me rozana data commits hote hain isliye activity bani rehti hai; agar 60+ din bilkul inactive hua to Actions tab se manually re-enable karna padega
