// Cloudflare Pages Function — URL resolution for /o/*. Source of truth: site/functions/
// in the private core; published to the public runner repo's functions/ directory.
//
// Why this exists: _redirects cannot answer 410 Gone (Cloudflare Pages supports
// 301/302/303/307/308 plus a 200 proxy and nothing else), and a request served by a
// Function never gets _redirects applied to it. So the expired-listing promise — 200
// through the 45-day grace window, then 410, and never 404 for a URL Google already
// knows — has to be kept in code.
//
// The table belongs to the build, not to this file. site/build.js writes
// site/dist/_urlmap.json:
//   { "redirects": { "/o/<retired>": "/o/<current>" }, "gone": ["/o/<dead>"] }
// generated from the slug ledger (data/slug-history.json), the hand-kept table
// (data/redirects.json) and the census of every /o/ URL this site has ever published
// (data/published-urls.json).
//
// site/dist/_routes.json scopes this Function to /o/*, so every other path is still
// served as a plain static asset with its _redirects rules intact. This file is
// fail-safe anyway: a missing or unreadable map, an unknown path, or any error at all
// falls through to the asset handler, which answers exactly as it did before.

const MAP_PATH = "/_urlmap.json";
const MAP_TTL_MS = 60 * 1000; // a deploy can reuse an isolate; never trust the map forever
const CACHE_CONTROL = "public, max-age=0, must-revalidate"; // same rule as /o/* in _headers

let cache = { at: 0, map: null };

async function loadMap(env, request) {
  if (cache.map && Date.now() - cache.at < MAP_TTL_MS) return cache.map;
  try {
    const res = await env.ASSETS.fetch(new URL(MAP_PATH, request.url));
    if (!res.ok) return cache.map || { redirects: {}, gone: [] };
    const parsed = await res.json();
    const map = {
      redirects: parsed && typeof parsed.redirects === "object" && parsed.redirects ? parsed.redirects : {},
      gone: parsed && Array.isArray(parsed.gone) ? parsed.gone : [],
    };
    cache = { at: Date.now(), map };
    return map;
  } catch {
    // Keep serving with the previous map rather than turning a lookup failure into 404s.
    return cache.map || { redirects: {}, gone: [] };
  }
}

// The extensionless and .html spellings are the same URL to a crawler and both appeared
// in the published output, so the lookup normalises them before matching the table.
const lookupKey = (pathname) => pathname.replace(/\/+$/, "").replace(/\.html$/, "") || "/";

function goneResponse(path, origin) {
  const url = origin + path;
  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>Listing removed — Bharat Naukri Alert</title>
<style>body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;margin:0;background:#f5f6fa;color:#101828;line-height:1.65}
main{max-width:640px;margin:0 auto;padding:4rem 20px}h1{font-size:24px;margin:0 0 10px}
p{color:#5d6b82}a{color:#e8590c}</style>
</head>
<body><main>
<h1>410 — this listing has been removed</h1>
<p>${url} was a listing on Bharat Naukri Alert. Its application window closed and the
notification has since been withdrawn from our index, so this page is gone for good.</p>
<p><a href="/">Latest jobs, exams and results</a> &middot; <a href="/category/job">Jobs</a> &middot;
<a href="/category/result">Results</a> &middot; <a href="/category/admit-card">Admit cards</a></p>
</main></body></html>`;
  return new Response(body, {
    status: 410,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": CACHE_CONTROL, "X-Robots-Tag": "noindex" },
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  try {
    const url = new URL(request.url);
    const key = lookupKey(url.pathname);
    const map = await loadMap(env, request);

    if (map.gone.includes(key)) return goneResponse(key, url.origin);

    const target = map.redirects[key];
    if (target) {
      const to = new URL(target, url.origin);
      to.search = url.search; // keep campaign params, they were never part of the identity
      return new Response(null, { status: 301, headers: { Location: to.toString(), "Cache-Control": CACHE_CONTROL } });
    }
  } catch {
    // Never let this Function be the reason a page fails to load.
  }
  return next();
}
