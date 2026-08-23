export const CATEGORIES = ["scholarship", "exam", "job", "scheme", "admit-card", "result"];
export const STATUSES = ["open", "closing_soon", "closed"];

export function validateEntry(entry) {
  const errors = [];
  const req = ["id", "title", "category", "official_link", "source", "first_seen", "status"];
  for (const f of req) {
    if (!entry[f] || String(entry[f]).trim() === "") errors.push(`missing field: ${f}`);
  }
  if (entry.category && !CATEGORIES.includes(entry.category)) errors.push(`invalid category: ${entry.category}`);
  if (entry.status && !STATUSES.includes(entry.status)) errors.push(`invalid status: ${entry.status}`);
  if (entry.official_link && !/^https?:\/\//i.test(entry.official_link)) errors.push("official_link must be http(s)");
  if (entry.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(entry.deadline)) errors.push("deadline must be YYYY-MM-DD");
  if (entry.deadline_source_count !== undefined && entry.deadline && entry.category === "scholarship" && entry.deadline_source_count < 1) {
    errors.push("deadline needs at least 1 source");
  }
  if (typeof entry.title === "string" && entry.title.length > 300) errors.push("title too long");
  return { valid: errors.length === 0, errors };
}

export function deadlineSanity(entry, now = new Date()) {
  if (!entry.deadline) return { ok: true };
  const d = new Date(`${entry.deadline}T23:59:59+05:30`);
  if (Number.isNaN(d.getTime())) return { ok: false, reason: "unparseable deadline" };
  if (d < now) return { ok: false, reason: `deadline in past: ${entry.deadline}` };
  const maxFuture = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365 * 3);
  if (d > maxFuture) return { ok: false, reason: "deadline more than 3 years ahead" };
  return { ok: true };
}

export function contentHash(entry) {
  const norm = `${(entry.title || "").toLowerCase().replace(/\W+/g, " ").trim()}|${entry.official_link}`;
  let h1 = 0x811c9dc5, h2 = 0x1000193;
  for (let i = 0; i < norm.length; i++) {
    const c = norm.charCodeAt(i);
    h1 = ((h1 ^ c) * 0x01000193) >>> 0;
    h2 = ((h2 + c * 31) * 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(36)}-${h2.toString(36)}`;
}
