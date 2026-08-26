import { setTimeout as sleep } from "node:timers/promises";
import https from "node:https";

// Browser-like UA — kai sarkari portals (PIB etc.) bot UAs ko 403 block karte hain.
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const BASE_HEADERS = {
  "user-agent": DEFAULT_UA,
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-IN,en;q=0.9,hi;q=0.8",
};

// Some sarkari portals ship incomplete TLS chains (Node can't AIA-fetch like browsers).
// Read-only retry without chain verification — safe for public GET scraping.
export function insecureGetText(url, { timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: "GET",
        headers: { ...BASE_HEADERS },
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode >= 400) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      }
    );
    req.on("timeout", () => req.destroy(new Error(`timeout after ${timeoutMs}ms`)));
    req.on("error", reject);
    req.end();
  });
}

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
      const cmsg = `${err?.message || ""} ${err?.cause?.message || ""} ${err?.cause?.code || ""}`;
      if (/certificate|TLS|SSL|self-?signed|unable to verify/i.test(cmsg)) {
        try {
          return await insecureGetText(url, { timeoutMs });
        } catch (err2) {
          lastErr = err2;
        }
      }
      if (attempt < retries) await sleep(1500 * 2 ** attempt);
    }
  }
  throw lastErr;
}

export function politeDelay(ms = 3000) {
  return sleep(ms);
}

// Reader-proxy fallbacks for sites that block datacenter IPs (Cloudflare 403 etc).
// Returns rendered/raw HTML so html mining works unchanged.
export async function fetchTextViaProxy(url, { timeoutMs = 25000 } = {}) {
  const attempts = [
    [`https://r.jina.ai/${url}`, { "x-return-format": "html", "user-agent": DEFAULT_UA }],
    [`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, { "user-agent": DEFAULT_UA }],
  ];
  let lastErr;
  for (const [proxied, headers] of attempts) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(proxied, { signal: ctrl.signal, redirect: "follow", headers });
      if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error(`all proxies failed for ${url}: ${lastErr?.message || "unknown"}`);
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
