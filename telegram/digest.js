import { readDB, readState, writeState, appendMemory } from "../lib/store.js";
import { sendMessage, getUpdates, buildDigest, handleCommand } from "./bot.js";

const dateStr = new Date().toISOString().slice(0, 10);

const db = await readDB();
const state = await readState();

const lastDigest = state.last_digest_date || "";
const fresh = db.opportunities.filter((e) => (e.first_seen || "").slice(0, 10) >= (lastDigest || dateStr));
const closing = db.opportunities.filter((e) => e.status === "closing_soon");
const digestEntries = [...new Map([...fresh, ...closing].map((e) => [e.id, e])).values()].slice(0, 8);

const msg = buildDigest(digestEntries, dateStr);

let sent = false;
let sendError = "";
try {
  await sendMessage(msg);
  sent = true;
} catch (e) {
  sendError = String(e.message || e);
  console.error("[telegram] digest send failed:", sendError);
  if (/chat not found|not found/i.test(sendError)) {
    console.error("[telegram] Hint: TELEGRAM_CHANNEL_ID galat hai ya bot channel ka admin nahi hai (@username public ke liye, -100... private ke liye).");
  } else if (/401|unauthorized/i.test(sendError)) {
    console.error("[telegram] Hint: TELEGRAM_BOT_TOKEN invalid hai.");
  }
}

if (!process.argv.includes("--no-commands")) {
  const updates = await getUpdates(state.tg_offset || 0);
  for (const u of updates.slice(-20)) {
    const text = u.message?.text;
    if (!text?.startsWith("/")) continue;
    const reply = handleCommand(text, db.opportunities);
    if (reply) {
      try {
        await sendMessage(reply, { chatId: u.message.chat.id });
      } catch (e) {
        console.error("[telegram] reply failed:", String(e.message || e).slice(0, 120));
      }
    }
    state.tg_offset = u.update_id + 1;
  }
}

state.last_digest_date = dateStr;
await writeState(state);
await appendMemory("metrics", { type: "digest", sent: digestEntries.length, ok: sent });
console.log(JSON.stringify({ digest_sent: sent, entries: digestEntries.length, error: sendError || null }));
