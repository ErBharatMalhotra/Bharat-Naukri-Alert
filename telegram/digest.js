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
await sendMessage(msg);

if (!process.argv.includes("--no-commands")) {
  const updates = await getUpdates(state.tg_offset || 0);
  for (const u of updates.slice(-20)) {
    const text = u.message?.text;
    if (!text?.startsWith("/")) continue;
    const reply = handleCommand(text, db.opportunities);
    if (reply) {
      await sendMessage(reply, { chatId: u.message.chat.id });
    }
    state.tg_offset = u.update_id + 1;
  }
}

state.last_digest_date = dateStr;
await writeState(state);
await appendMemory("metrics", { type: "digest", sent: digestEntries.length });
console.log(JSON.stringify({ digest_sent: true, entries: digestEntries.length }));
