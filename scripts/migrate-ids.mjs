#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { contentHash } from "../lib/schema.js";

const DB = path.join(process.cwd(), "data", "opportunities.json");
const RED = path.join(process.cwd(), "data", "redirects.json");
const db = JSON.parse(readFileSync(DB, "utf8"));
let redirects = {};
try { redirects = JSON.parse(readFileSync(RED, "utf8")); } catch {}

const used = new Set();
let changed = 0;

for (const e of db.opportunities) {
  const oldId = e.id;
  let h = contentHash(e);
  while (used.has(h)) h = `${h}-x`;
  used.add(h);
  if (e.content_hash !== h || e.id !== h) {
    e.content_hash = h;
    e.id = h;
    changed++;
  }
  if (oldId && oldId !== e.id && !redirects[oldId]) {
    redirects[oldId] = e.id;
    redirects[`${oldId}.html`] = `${e.id}.html`;
  }
}

writeFileSync(DB, JSON.stringify(db, null, 2));
writeFileSync(RED, JSON.stringify(redirects, null, 2));
console.log(`Migrated ${changed}/${db.opportunities.length} ids. Redirect map: ${Object.keys(redirects).length}`);
