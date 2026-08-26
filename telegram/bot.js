import { fetchText } from "../lib/http.js";
import { SITE_CONFIG } from "../lib/site-config.js";

const API = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

const FALLBACK_CHANNELS = ["@bharatnaukrialert"];

export async function sendMessage(text, { chatId, parseMode = "HTML", dryRun = false } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const primary = chatId || process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !primary || dryRun) {
    console.log(`[dry-run] would send ${text.length} chars to ${primary || "(no channel)"}`);
    return { ok: true, dry: true };
  }
  const targets = [primary, ...(chatId ? [] : FALLBACK_CHANNELS)].filter(
    (t, i, arr) => String(t).toLowerCase() !== String(arr[i - 1] || "").toLowerCase()
  );
  let lastErr;
  for (const target of targets) {
    try {
      const url = `${API(token, "sendMessage")}?chat_id=${encodeURIComponent(target)}&text=${encodeURIComponent(text)}&parse_mode=${parseMode}&disable_web_preview=false`;
      const res = JSON.parse(await fetchText(url));
      if (!res.ok) throw new Error(`telegram: ${res.description}`);
      if (String(target) !== String(primary)) console.log(`[telegram] sent via fallback channel ${target}`);
      return res;
    } catch (e) {
      lastErr = e;
      console.error(`[telegram] send failed for ${target}: ${String(e.message || e).slice(0, 100)}`);
    }
  }
  throw lastErr;
}

export async function getUpdates(offset) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return [];
  const url = `${API(token, "getUpdates")}?timeout=0&offset=${offset || 0}&allowed_updates=["message"]`;
  try {
    const res = JSON.parse(await fetchText(url));
    return res.ok ? res.result : [];
  } catch {
    return [];
  }
}

export function formatEntryLine(e, idx) {
  const flag = e.status === "closing_soon" ? "\u26a0\ufe0f" : "\ud83c\udd95";
  const dl = e.deadline ? ` | Last date: <b>${e.deadline}</b>` : "";
  return `${flag} <b>${e.title.slice(0, 90)}</b>\n${e.org}${dl}\n${e.official_link}`;
}

export function buildDigest(freshEntries, closingEntries, dateStr) {
  const fresh = freshEntries || [];
  const closing = closingEntries || [];
  if (!fresh.length && !closing.length) {
    return `\ud83d\udccd Bharat Naukri Alert Digest — ${dateStr}\n\nAaj koi naya opportunity add nahi hua. Kal phir check karna!`;
  }
  let msg = `\ud83d\udd34 <b>Bharat Naukri Alert Daily Digest</b> — ${dateStr}\n`;
  msg += fresh.length
    ? `\ud83c\udd95 ${fresh.length} naye${closing.length ? ` | \u26a0\ufe0f ${closing.length} jald band honge` : ""}`
    : `Aaj koi nayi entry nahi aayi${closing.length ? ` — par \u26a0\ufe0f ${closing.length} jald band ho rahe hain` : ""}`;
  msg += "\n";
  if (fresh.length) {
    msg += `\n\ud83c\udd95 <b>NAYE:</b>\n\n${fresh.map((e) => formatEntryLine(e)).join("\n\n")}`;
  }
  if (closing.length) {
    msg += `\n\n\u26a0\ufe0f <b>JALD BAND HONGE:</b>\n\n${closing.map((e) => formatEntryLine(e)).join("\n\n")}`;
  }
  msg += `\n\n\u2139\ufe0f Verify on official portal before applying.${SITE_CONFIG.telegramUrl ? `\n\ud83d\udce2 Channel: ${SITE_CONFIG.telegramUrl}` : ""}`;
  return msg;
}

export const HELP_TEXT = `Bharat Naukri Alert Bot:\n/new — aaj ke naye opportunities\n/deadlines — 7 din me band hone wale\n/search &lt;keyword&gt; — khojo\n/help — yeh message`;

export function handleCommand(cmd, dbEntries) {
  const [raw, ...rest] = cmd.trim().split(/\s+/);
  const c = raw.toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  if (c === "/start" || c === "/help") return HELP_TEXT;
  if (c === "/new") {
    const fresh = dbEntries.filter((e) => (e.first_seen || "").slice(0, 10) >= today);
    return fresh.length
      ? fresh.slice(0, 5).map((e) => formatEntryLine(e)).join("\n\n")
      : "Aaj abhi tak koi nayi entry nahi aayi.";
  }
  if (c === "/deadlines") {
    const soon = dbEntries
      .filter((e) => e.deadline && e.status !== "closed")
      .filter((e) => new Date(`${e.deadline}`) - new Date() < 7 * 86400000)
      .slice(0, 5);
    return soon.length ? soon.map((e) => formatEntryLine(e)).join("\n\n") : "Agle 7 din me kuch band nahi ho raha.";
  }
  if (c === "/search") {
    const q = rest.join(" ").toLowerCase();
    if (!q) return "Usage: /search scholarship";
    const hits = dbEntries
      .filter((e) => `${e.title} ${e.summary} ${e.category}`.toLowerCase().includes(q))
      .slice(0, 5);
    return hits.length ? hits.map((e) => formatEntryLine(e)).join("\n\n") : `"${q}" ke liye kuch nahi mila.`;
  }
  return null;
}
