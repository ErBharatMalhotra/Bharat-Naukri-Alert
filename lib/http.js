import { setTimeout as sleep } from "node:timers/promises";

// Browser-like UA — kai sarkari portals (PIB etc.) bot UAs ko 403 block karte hain.
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const BASE_HEADERS = {
  "user-agent": DEFAULT_UA,
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-IN,en;q=0.9,hi;q=0.8",
};

export async function fetchText(url, { timeoutMs = 20000, retries = 2, headers = {} } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: { ...BASE_HEADERS, ...headers },
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      if (attempt < retries) await sleep(1500 * 2 ** attempt);
    }
  }
  throw lastErr;
}

export function politeDelay(ms = 3000) {
  return sleep(ms);
}

export async function isUrlAlive(url, { timeoutMs = 12000 } = {}) {
  const attempt = async (method) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: ctrl.signal,
        headers: BASE_HEADERS,
      });
      clearTimeout(t);
      return res.status;
    } catch (err) {
      clearTimeout(t);
      return 0;
    }
  };

  let status = await attempt("HEAD");
  if (status === 0) status = await attempt("GET");
  return { alive: status > 0, status };
}
