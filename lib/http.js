import { setTimeout as sleep } from "node:timers/promises";

const DEFAULT_UA =
  "BharatNaukriAlert/0.1 (+https://github.com/bharat-naukri-alert; polite bot; contact via repo issues)";

export async function fetchText(url, { timeoutMs = 20000, retries = 2, headers = {} } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: { "user-agent": DEFAULT_UA, accept: "*/*", ...headers },
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
        headers: { "user-agent": DEFAULT_UA },
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
