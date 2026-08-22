import fs from "node:fs/promises";
import path from "node:path";
import { readDB } from "../lib/store.js";

const DIST = () => path.join(process.cwd(), "site", "dist");
const SITE_URL = process.env.SITE_URL || "https://bharat-naukri-alert.pages.dev";
const REPO_URL = process.env.REPO_URL || "https://github.com/ErBharatMalhotra/Bharat-Naukri-Alert";

const CAT_LABELS = {
  scholarship: { en: "Scholarships", hi: "à¤›à¤¾à¤¤à¥à¤°à¤µà¥ƒà¤¤à¥à¤¤à¤¿à¤¯à¤¾à¤", icon: "cap" },
  exam: { en: "Exams", hi: "à¤ªà¤°à¥€à¤•à¥à¤·à¤¾à¤à¤", icon: "file" },
  job: { en: "Jobs", hi: "à¤¨à¥Œà¤•à¤°à¤¿à¤¯à¤¾à¤", icon: "briefcase" },
  scheme: { en: "Schemes", hi: "à¤¯à¥‹à¤œà¤¨à¤¾à¤à¤", icon: "landmark" },
  "admit-card": { en: "Admit Cards", hi: "à¤à¤¡à¤®à¤¿à¤Ÿ à¤•à¤¾à¤°à¥à¤¡", icon: "ticket" },
  result: { en: "Results", hi: "à¤ªà¤°à¤¿à¤£à¤¾à¤®", icon: "trophy" },
};

function esc(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------- inline SVG icons ----------
const PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  cal: '<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><circle cx="16.5" cy="13" r="1.4"/>',
  cap: '<path d="M2 9.5 12 4.5l10 5-10 5z"/><path d="M6 11.8V16c0 1.5 2.7 2.8 6 2.8s6-1.3 6-2.8v-4.2"/><path d="M22 9.5V15"/>',
  file: '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5M9 13h6M9 17h4"/>',
  briefcase: '<rect x="2.5" y="7" width="19" height="13.5" rx="2.5"/><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M2.5 12.5h19"/>',
  landmark: '<path d="M3 21h18M5 21v-9M9.7 21v-9M14.3 21v-9M19 21v-9M2.5 10 12 3l9.5 7z"/>',
  ticket: '<path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6z"/><path d="M13 5v2.5M13 11v2M13 16.5V19"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0zM7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4"/>',
  shield: '<path d="M12 22s8-3.5 8-10V5.5L12 2 4 5.5V12c0 6.5 8 10 8 10z"/><path d="m9 11.5 2 2 4-4.5"/>',
  zap: '<path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5z"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M4.8 4.8l1.4 1.4M17.8 17.8l1.4 1.4M2.5 12h2M19.5 12h2M4.8 19.2l1.4-1.4M17.8 6.2l1.4-1.4"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/>',
  up: '<path d="m5 14 7-7 7 7"/>',
  link: '<path d="M10 13.5a4.5 4.5 0 0 0 6.8.5l2.5-2.5a4.5 4.5 0 0 0-6.4-6.4l-1.4 1.4"/><path d="M14 10.5a4.5 4.5 0 0 0-6.8-.5l-2.5 2.5a4.5 4.5 0 0 0 6.4 6.4l1.4-1.4"/>',
  alert: '<path d="M12 3 2.5 19.5a1.5 1.5 0 0 0 1.3 2.5h16.4a1.5 1.5 0 0 0 1.3-2.5L12 3z"/><path d="M12 10v4M12 17.5v.5"/>',
  ext: '<path d="M18 13.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5.5"/><path d="M14 3.5h6.5V10M21 3 11 13"/>',
  chev: '<path d="m9 5 7 7-7 7"/>',
};
const WA_PATH =
  'M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.58-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.34m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37A9.86 9.86 0 0 1 .16 11.9C.16 6.45 4.59 2.01 10.04 2.01c2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.43 9.89-9.89 9.89m8.42-18.3A11.81 11.81 0 0 0 12.05.02C5.5.02.16 5.35.16 11.91c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.42';
const TG_PATH =
  'M11.94 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm4.96 7.22c.1 0 .32.02.47.14a.5.5 0 0 1 .17.33c.02.09.04.3.02.47-.18 1.9-.96 6.5-1.36 8.63-.17.9-.5 1.2-.82 1.23-.7.06-1.23-.46-1.9-.9-1.06-.7-1.66-1.13-2.68-1.8-.63-.42-.26-.65.11-1.02.18-.18 1.26-1.2 1.6-1.52.11-.11.04-.17-.06-.17-.06 0-.15.02-.23.06-.16.07-2.44 1.56-2.74 1.67-.19.07-.36.1-.52.1-.2 0-.4-.06-.56-.18-.28-.2-.4-.53-.39-.84.02-.22.08-.43.11-.5.06-.2 1.71-2.4 1.84-2.58.16-.22.06-.34-.14-.34-.08 0-.2.02-.31.06-.19.07-1.3.83-1.85 1.2-.35.24-.7.48-1.05.72-.16.11-.42.27-.63.27-.24 0-.63-.14-.63-.14-.15-.06-.62-.23-.62-.49 0-.15.09-.32.27-.5.42-.4 2.19-1.46 2.8-1.87.19-.13.39-.26.58-.39.6-.4 1.37-.91 2.37-1.09 1.31-.23 2.32.14 2.94.63.63.49.9 1.13.82 1.83-.06.53-.4 1.2-.82 1.62-.13.13-.25.25-.36.36-.17.16-.28.27-.24.42.05.2.28.16.55.09.4-.1 1.51-.66 1.94-.94.43-.28.98-.6 1.3-.78.32-.18.6-.28.83-.28';

function strokeIcon(name, cls = "") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ""}</svg>`;
}
function fillIcon(name, cls = "") {
  const p = name === "tg" ? TG_PATH : WA_PATH;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${p}</svg>`;
}

function hue(s = "") {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) % 360;
  return h;
}
function initials(org = "") {
  const w = String(org).trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || "B") + (w[1]?.[0] || "")).toUpperCase();
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(d) {
  if (!d) return "";
  const p = String(d).split("-");
  return p.length === 3 ? `${Number(p[2])} ${MONTHS[Number(p[1]) - 1] || ""} ${p[0]}` : d;
}
function statusLabel(st) {
  return st === "closing_soon" ? "Closing Soon" : st === "closed" ? "Closed" : "Open";
}

// ---------- CSS (split into parts for readability) ----------
const CSS_A = `
:root{
--bg:#f5f6fa;--card:#ffffff;--ink:#101828;--mut:#5d6b82;--line:#e5e9f1;
--brand:#e8590c;--brand-2:#ff8a3d;--brand-soft:#fff0e6;
--navy:#0e1729;--navy-2:#16233d;
--ok:#15803d;--ok-bg:#e7f6ec;--warn:#b45309;--warn-bg:#fdf3df;--bad:#dc2626;--bad-bg:#fdecec;
--sh:0 1px 2px rgba(16,24,40,.05),0 12px 32px -20px rgba(16,24,40,.28);
--disp:'Sora',system-ui,-apple-system,'Segoe UI',sans-serif;
--body:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif}
[data-theme=dark]{
--bg:#0b1120;--card:#121b31;--ink:#e8edf6;--mut:#93a3bd;--line:#22304e;
--brand:#ff7a29;--brand-2:#ffa05c;--brand-soft:#2a1d12;
--navy:#0c1322;--navy-2:#121d35;
--ok:#4ade80;--ok-bg:#12291c;--warn:#fbbf24;--warn-bg:#2c2210;--bad:#f87171;--bad-bg:#301417;
--sh:0 1px 2px rgba(0,0,0,.35),0 14px 34px -22px rgba(0,0,0,.6)}
*{box-sizing:border-box;margin:0}
html{scroll-behavior:smooth}
body{font-family:var(--body);background:var(--bg);color:var(--ink);line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.wrap{max-width:1100px;margin:0 auto;padding:0 20px}

/* header */
.hdr{position:sticky;top:0;z-index:60;background:color-mix(in srgb,var(--card) 84%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.hdr-in{max-width:1100px;margin:auto;display:flex;align-items:center;gap:14px;padding:10px 20px}
.logo{display:flex;align-items:center;gap:10px;flex-shrink:0}
.mark{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--brand-2),var(--brand));color:#fff;display:grid;place-items:center;font-family:var(--disp);font-weight:800;font-size:15px;box-shadow:0 4px 12px -4px rgba(232,89,12,.55)}
.wordmark{font-family:var(--disp);font-weight:700;font-size:16px;letter-spacing:-.2px;white-space:nowrap}
.wordmark em{font-style:normal;color:var(--brand)}
.hnav{display:flex;gap:2px;margin-left:auto;overflow-x:auto;scrollbar-width:none}
.hnav::-webkit-scrollbar{display:none}
.hnav a{padding:7px 11px;border-radius:9px;font-size:13.5px;color:var(--mut);white-space:nowrap;transition:.15s}
.hnav a:hover{background:var(--brand-soft);color:var(--brand)}
.tbtn{width:37px;height:37px;border-radius:11px;border:1px solid var(--line);background:var(--card);color:var(--mut);cursor:pointer;display:grid;place-items:center;flex-shrink:0;transition:.15s}
.tbtn:hover{border-color:var(--brand);color:var(--brand)}
.tbtn svg{width:17px;height:17px}
.tbtn .ic-sun{display:none}
[data-theme=dark] .tbtn .ic-sun{display:block}
[data-theme=dark] .tbtn .ic-moon{display:none}

/* hero */
.hero{position:relative;overflow:hidden;color:#fff;background:radial-gradient(700px 320px at 12% -12%,rgba(255,138,61,.28),transparent 60%),radial-gradient(760px 360px at 96% -8%,rgba(64,120,255,.22),transparent 62%),linear-gradient(160deg,var(--navy),var(--navy-2))}
.hero::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(640px 340px at 50% 0,#000,transparent);mask-image:radial-gradient(640px 340px at 50% 0,#000,transparent)}
.hero-in{max-width:1100px;margin:auto;padding:58px 20px 48px;text-align:center;position:relative}
.hero-pill{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;letter-spacing:.4px;color:#ffd9bd;background:rgba(255,138,61,.13);border:1px solid rgba(255,138,61,.35);padding:7px 14px;border-radius:999px}
.hero-pill svg{width:14px;height:14px}
.hero h1{font-family:var(--disp);font-weight:800;font-size:clamp(25px,4.6vw,44px);letter-spacing:-1px;line-height:1.18;margin-top:18px}
.hero h1 em{font-style:normal;background:linear-gradient(90deg,var(--brand-2),#ffc46b);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero-sub{color:#b9c6da;max-width:560px;margin:14px auto 0;font-size:15px}
.search-wrap{position:relative;max-width:620px;margin:26px auto 0}
.search-wrap>svg{position:absolute;left:18px;top:50%;transform:translateY(-50%);width:19px;height:19px;color:#8fa2c0;pointer-events:none}
#q{width:100%;padding:17px 56px 17px 48px;font-family:var(--body);font-size:16px;font-weight:500;color:#fff;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:16px;outline:none;transition:.2s;backdrop-filter:blur(6px)}
#q::placeholder{color:#7f92b3}
#q:focus{border-color:rgba(255,138,61,.65);background:rgba(255,255,255,.09);box-shadow:0 0 0 4px rgba(255,138,61,.15)}
.search-kbd{position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:12px;font-weight:600;color:#8fa2c0;border:1px solid rgba(255,255,255,.2);border-bottom-width:2px;border-radius:7px;padding:3px 9px;pointer-events:none}
.stats-row{display:flex;justify-content:center;gap:14px;margin-top:30px;flex-wrap:wrap}
.stat{min-width:128px;padding:13px 22px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
.stat b{display:block;font-family:var(--disp);font-size:29px;font-weight:800;line-height:1.2}
.stat-warn b{color:#ffb37a}
.stat small{color:#93a5c1;font-size:12.5px;letter-spacing:.3px}
.hero-trust{margin-top:24px;color:#7f92b3;font-size:12.5px;display:flex;justify-content:center;align-items:center;gap:7px;flex-wrap:wrap}
.hero-trust svg{width:14px;height:14px;color:#57c98b}
`;

const CSS_B = `
/* main sections */
.page-top{padding-top:28px}
.sec-head{display:flex;align-items:baseline;gap:12px;margin-bottom:6px}
.sec-head h2{font-family:var(--disp);font-size:21px;font-weight:700;letter-spacing:-.3px}
.res-count{color:var(--mut);font-size:13px}
.toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0 20px}
.chips{display:flex;gap:7px;flex-wrap:wrap}
.chip{padding:7px 14px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--mut);font-family:var(--body);font-size:13px;font-weight:500;cursor:pointer;transition:.15s}
.chip:hover{border-color:var(--brand);color:var(--brand)}
.chip.on{background:var(--brand);border-color:var(--brand);color:#fff;font-weight:600}
.toolbar-right{margin-left:auto;display:flex;gap:8px;align-items:center}
.seg{display:flex;background:var(--card);border:1px solid var(--line);border-radius:11px;padding:3px}
.seg button{border:0;background:transparent;color:var(--mut);font-family:var(--body);font-size:12.5px;font-weight:500;padding:6px 12px;border-radius:8px;cursor:pointer;transition:.15s}
.seg button.on{background:var(--ink);color:var(--bg);font-weight:600}
#sortSel{padding:8px 12px;border-radius:11px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-family:var(--body);font-size:12.5px;font-weight:500;cursor:pointer}

/* cards */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;padding-bottom:8px}
.op-card{display:flex;flex-direction:column;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;color:var(--ink);box-shadow:var(--sh);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
.op-card:hover{transform:translateY(-3px);border-color:rgba(232,89,12,.45);box-shadow:0 14px 34px -18px rgba(232,89,12,.35)}
.op-top{display:flex;align-items:center;gap:9px;min-width:0}
.avatar{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;font-family:var(--disp);font-weight:800;font-size:12.5px;flex-shrink:0;background:hsl(var(--h,20) 85% 93%);color:hsl(var(--h,20) 70% 34%)}
[data-theme=dark] .avatar{background:hsl(var(--h,20) 40% 20%);color:hsl(var(--h,20) 80% 72%)}
.op-org{font-size:12px;font-weight:600;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.op-sp{flex:1}
.cat-chip{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;letter-spacing:.3px;padding:4px 9px;border-radius:999px;flex-shrink:0}
.cat-chip svg{width:11px;height:11px}
.cc-scholarship{background:#efe9ff;color:#6d28d9}.cc-exam{background:#e3edff;color:#1d4ed8}.cc-job{background:#e2f6ea;color:#047857}.cc-scheme{background:#ffedd8;color:#c2410c}.cc-admit-card{background:#dcf5f2;color:#0f766e}.cc-result{background:#ffe4ea;color:#be123c}
[data-theme=dark] .cc-scholarship{background:#241a3d;color:#c4b5fd}[data-theme=dark] .cc-exam{background:#16233f;color:#93b4ff}[data-theme=dark] .cc-job{background:#12291c;color:#6ee7a0}[data-theme=dark] .cc-scheme{background:#2a1a0e;color:#fdba74}[data-theme=dark] .cc-admit-card{background:#0f2b28;color:#5eead4}[data-theme=dark] .cc-result{background:#2b1219;color:#fda4af}
.op-t{font-family:var(--disp);font-size:15.5px;font-weight:700;line-height:1.42;letter-spacing:-.2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:44px}
.op-s{font-size:12.5px;color:var(--mut);line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:-4px}
.op-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:10px;border-top:1px dashed var(--line)}
.dl-chip,.amt-chip{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;padding:5px 10px;border-radius:999px}
.dl-chip svg,.amt-chip svg{width:12px;height:12px;flex-shrink:0}
.amt-chip{background:var(--brand-soft);color:var(--brand)}
.dl-chip{background:var(--ok-bg);color:var(--ok)}
.dl-warn{background:var(--warn-bg)!important;color:var(--warn)!important}
.dl-bad{background:var(--bad-bg)!important;color:var(--bad)!important}
.dl-off{background:transparent!important;border:1px solid var(--line);color:var(--mut)!important}
.go{margin-left:auto;width:28px;height:28px;border-radius:9px;display:grid;place-items:center;color:var(--mut);background:var(--bg);transition:.18s}
.go svg{width:13px;height:13px}
.op-card:hover .go{background:var(--brand);color:#fff;transform:translate(2px,-2px)}

/* skeleton */
.sk-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;height:158px}
.sk{height:12px;border-radius:7px;background:linear-gradient(90deg,var(--line) 25%,var(--bg) 45%,var(--line) 65%);background-size:220% 100%;animation:shimmer 1.25s infinite linear}
.sk-a{width:52%;height:36px;border-radius:11px;margin-bottom:16px}
.sk-b{width:92%;margin-bottom:10px}
.sk-c{width:68%}
@keyframes shimmer{to{background-position:-120% 0}}

/* empty state */
.empty{text-align:center;padding:70px 20px 40px;color:var(--mut)}
.empty svg{width:42px;height:42px;opacity:.4}
.empty p{margin-top:12px;font-size:14.5px}

/* note */
.note{display:flex;gap:12px;align-items:flex-start;background:var(--warn-bg);border:1px solid color-mix(in srgb,var(--warn) 30%,transparent);border-radius:14px;padding:14px 16px;margin:26px 0 6px}
.note svg{width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--warn)}
.note p{font-size:13px;line-height:1.6;color:color-mix(in srgb,var(--warn) 70%,var(--ink))}
`;
let CSS = CSS_A + CSS_B;

const CSS_C = `
/* breadcrumb + page heads */
.crumb{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--mut);margin-bottom:16px;flex-wrap:wrap}
.crumb svg{width:12px;height:12px;opacity:.55}
.crumb a:hover{color:var(--brand)}
.page-h{font-family:var(--disp);font-size:clamp(22px,3.2vw,30px);font-weight:800;letter-spacing:-.5px;display:flex;align-items:center;gap:12px}
.cnt-badge{font-size:13px;font-weight:700;background:var(--brand-soft);color:var(--brand);padding:4px 12px;border-radius:999px}
.page-sub{color:var(--mut);font-size:14px;margin-top:4px}

/* detail */
.d-head{margin-top:6px}
.d-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.d-head h1{font-family:var(--disp);font-size:clamp(21px,3.4vw,32px);font-weight:800;letter-spacing:-.6px;line-height:1.25;margin:10px 0 12px}
.status-pill{font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:5px 11px;border-radius:999px}
.sp-open{background:var(--ok-bg);color:var(--ok)}
.sp-closing_soon{background:var(--bad-bg);color:var(--bad)}
.sp-closed{background:var(--line);color:var(--mut)}
.info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:20px 0 18px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.tile small{display:block;font-size:10.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-bottom:5px}
.tile b{font-family:var(--disp);font-size:15.5px;font-weight:700}
.tile-sub{display:block;font-size:12px;margin-top:3px;color:var(--brand);font-weight:600}
.d-sum{font-size:15px;margin:4px 0 10px}
.edu-row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 4px}
.edu-chip{font-size:12.5px;font-weight:500;background:var(--card);border:1px solid var(--line);padding:5px 13px;border-radius:999px;color:var(--mut)}

/* CTA panel */
.cta-panel{display:flex;align-items:center;gap:18px;flex-wrap:wrap;background:linear-gradient(135deg,color-mix(in srgb,var(--brand) 9%,var(--card)),var(--card));border:1px solid color-mix(in srgb,var(--brand) 35%,transparent);border-radius:18px;padding:20px 22px;margin:24px 0 6px}
.cta-panel h3{font-family:var(--disp);font-size:17px;font-weight:700}
.cta-panel p{font-size:13px;color:var(--mut);margin-top:3px}
.cta-actions{display:flex;gap:9px;flex-wrap:wrap;margin-left:auto}
.btn{display:inline-flex;align-items:center;gap:8px;font-family:var(--body);font-size:13.5px;font-weight:600;padding:12px 18px;border-radius:12px;border:0;cursor:pointer;transition:.18s}
.btn svg{width:15px;height:15px}
.btn-pri{background:linear-gradient(135deg,var(--brand-2),var(--brand));color:#fff;box-shadow:0 8px 20px -8px rgba(232,89,12,.6)}
.btn-pri:hover{transform:translateY(-2px);box-shadow:0 12px 26px -10px rgba(232,89,12,.75)}
.btn-ghost{background:var(--card);border:1px solid var(--line);color:var(--ink)}
.btn-ghost:hover{border-color:var(--brand);color:var(--brand)}
.btn-ghost.wa:hover{border-color:#25d366;color:#25d366}
.btn-ghost.tg:hover{border-color:#29a9eb;color:#29a9eb}
.rel-sec{margin-top:38px}
.rel-sec h2{font-family:var(--disp);font-size:19px;font-weight:700;margin-bottom:14px}

/* footer */
.ft{border-top:1px solid var(--line);background:var(--card);margin-top:54px}
.ft-in{max-width:1100px;margin:auto;display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:30px;padding:38px 20px 26px}
.ft-brand p{font-size:13px;color:var(--mut);margin:12px 0 14px;max-width:36ch}
.trust{list-style:none;padding:0;display:grid;gap:8px}
.trust li{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--mut)}
.trust svg{width:14px;height:14px;color:var(--brand);flex-shrink:0}
.ft-col h4{font-size:11.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);margin-bottom:13px}
.ft-links{display:grid;gap:9px}
.ft-links a{font-size:13.5px;opacity:.85;transition:.15s}
.ft-links a:hover{color:var(--brand);opacity:1}
.ft-bar{border-top:1px solid var(--line)}
.ft-bar>div{max-width:1100px;margin:auto;padding:16px 20px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--mut)}

/* back-to-top */
#toTop{position:fixed;right:22px;bottom:22px;width:44px;height:44px;border-radius:13px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;display:grid;place-items:center;opacity:0;pointer-events:none;transform:translateY(8px);transition:.25s;z-index:70;box-shadow:var(--sh)}
#toTop.show{opacity:1;pointer-events:auto;transform:none}
#toTop:hover{background:var(--brand);color:#fff;border-color:var(--brand)}
#toTop svg{width:17px;height:17px}

/* reveal on scroll */
[data-reveal]{opacity:0;transform:translateY(16px);transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.25,1)}
[data-reveal].rv-in{opacity:1;transform:none}

@media(max-width:720px){
.hdr-in{padding:10px 14px;gap:10px}
.hero-in{padding:42px 16px 38px}
.toolbar-right{margin-left:0;width:100%;justify-content:space-between}
.ft-in{grid-template-columns:1fr;gap:24px}
.cta-actions{margin-left:0;width:100%}
.cta-actions .btn{flex:1;justify-content:center}
.info-grid{grid-template-columns:repeat(2,1fr)}
.stats-row{gap:10px}
.stat{min-width:104px;padding:11px 16px}
.stat b{font-size:24px}
}
@media(prefers-reduced-motion:reduce){
[data-reveal]{opacity:1!important;transform:none!important;transition:none!important}
html{scroll-behavior:auto}
}
`;
CSS += CSS_C;

// ---------- theme boot (no FOUC), favicon ----------
const THEME_BOOT = "(function(){try{var t=localStorage.getItem('bna-theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();";

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23e8590c'/%3E%3Ctext x='32' y='44' font-family='Arial,sans-serif' font-size='30' font-weight='700' fill='%23ffffff' text-anchor='middle'%3EBN%3C/text%3E%3C/svg%3E";

function layout({ title, desc, canonical, body, jsonld }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="Bharat Naukri Alert">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#e8590c">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap" rel="stylesheet">
<script>${THEME_BOOT}</script>
<style>${CSS}</style>
<script type="application/ld+json">${jsonld || "{}"}</script>
</head>
<body>
${body}
</body>
</html>`;
}

function header(prefix = "") {
  const cats = Object.entries(CAT_LABELS)
    .map(([k, v]) => `<a href="${prefix}category/${k}.html">${v.en}</a>`)
    .join("");
  return `<header class="hdr"><div class="hdr-in">
<a class="logo" href="${prefix}index.html"><span class="mark">B</span><span class="wordmark">Bharat <em>Naukri Alert</em></span></a>
<nav class="hnav"><a href="${prefix}index.html">Home</a>${cats}</nav>
<button id="themeBtn" class="tbtn" aria-label="Toggle theme">${strokeIcon("sun", "ic-sun")}${strokeIcon("moon", "ic-moon")}</button>
</div></header>`;
}

function footerHTML(prefix = "") {
  const cats = Object.entries(CAT_LABELS)
    .map(([k, v]) => `<a href="${prefix}category/${k}.html">${v.en}</a>`)
    .join("");
  return `<footer class="ft"><div class="ft-in">
<div class="ft-brand">
<a class="logo" href="${prefix}index.html"><span class="mark">B</span><span class="wordmark">Bharat <em>Naukri Alert</em></span></a>
<p>Sarkari portals se rozana opportunities scrape, verify aur publish hoti hain â€” poora history Git me permanent save rehta hai.</p>
<ul class="trust"><li>${strokeIcon("shield")}Verified data, quarantine gate</li><li>${strokeIcon("zap")}Har 4 ghante auto-update</li><li>${strokeIcon("clock")}Deadline tracking built-in</li></ul>
</div>
<div class="ft-col"><h4>Categories</h4><div class="ft-links">${cats}</div></div>
<div class="ft-col"><h4>Resources</h4><div class="ft-links">
<a href="${prefix}sitemap.xml">Sitemap</a>
<a href="${REPO_URL}" target="_blank" rel="noopener">GitHub Repository</a>
<a href="${SITE_URL}/data/opportunities.json" target="_blank" rel="noopener">Open Data (JSON)</a>
</div></div>
</div>
<div class="ft-bar"><div><span>&copy; ${new Date().getFullYear()} Bharat Naukri Alert &middot; Independent information service &mdash; koi sarkari website nahi hai.</span><span>Autonomous agent se bana &middot; GitHub Actions pe chalta hai</span></div></div></footer>
<button id="toTop" aria-label="Back to top">${strokeIcon("up")}</button>`;
}

function note() {
  return `<div class="note" data-reveal>${strokeIcon("alert")}<p><b>Disclaimer:</b> Yeh independent information service hai &mdash; sarkari portal nahi. Apply karne se pehle official website par details aur last date zaroor verify karein.</p></div>`;
}

// ---------- reusable HTML builders ----------
function catChip(cat) {
  const L = CAT_LABELS[cat] || {};
  return `<span class="cat-chip cc-${cat}">${strokeIcon(L.icon || "file")}${L.en || cat}</span>`;
}

function dlChip(e) {
  if (e.deadline) {
    return `<span class="dl-chip" data-dl="${e.deadline}">${strokeIcon("cal")}<span>${fmtDate(e.deadline)}</span><span class="dl-txt"></span></span>`;
  }
  return `<span class="dl-chip">${strokeIcon("clock")}<span>Last date &mdash; portal check karo</span></span>`;
}

function cardHTML(e, rel = "") {
  return `<a class="op-card" data-reveal href="${rel}o/${encodeURIComponent(e.id)}.html">
<div class="op-top"><span class="avatar" style="--h:${hue(e.org)}">${initials(e.org)}</span>
<span class="op-org">${esc(e.org || "Government of India")}</span><span class="op-sp"></span>${catChip(e.category)}</div>
<h3 class="op-t">${esc(e.title)}</h3>
${e.summary ? `<p class="op-s">${esc(e.summary)}</p>` : ""}
<div class="op-foot">${dlChip(e)}${e.amount ? `<span class="amt-chip">${strokeIcon("wallet")}${esc(String(e.amount)).slice(0, 26)}</span>` : ""}<span class="go">${strokeIcon("ext")}</span></div>
</a>`;
}

function detailBody(e, related) {
  const L = CAT_LABELS[e.category] || { en: e.category, hi: "", icon: "file" };
  const url = `${SITE_URL}/o/${encodeURIComponent(e.id)}.html`;
  const shareTxt = encodeURIComponent(`${e.title} â€” ${url}`);
  const shareUrl = encodeURIComponent(url);
  const edu = (e.eligibility?.education || []).map((x) => `<span class="edu-chip">${esc(x)}</span>`).join("");
  const relCards = (related || []).map((r) => cardHTML(r, "../")).join("");
  return `${header("../")}
<main class="wrap page-top">
<nav class="crumb"><a href="../index.html">Home</a>${strokeIcon("chev")}<a href="../category/${e.category}.html">${L.en}</a>${strokeIcon("chev")}<span>${esc(e.title.slice(0, 60))}</span></nav>
<div class="d-head">
<div class="d-meta">${catChip(e.category)}<span class="status-pill sp-${e.status}">${statusLabel(e.status)}</span></div>
<h1>${esc(e.title)}</h1>
<div class="d-meta"><span class="avatar" style="--h:${hue(e.org)}">${initials(e.org)}</span><span class="op-org">${esc(e.org || "Government of India")}</span></div>
</div>
<div class="info-grid">
<div class="tile"><small>Last Date</small><b>${e.deadline ? fmtDate(e.deadline) : "&mdash; portal check karo"}</b>${e.deadline ? '<span class="tile-sub" id="dl-sub"></span>' : ""}</div>
<div class="tile"><small>Benefit / Pay</small><b>${e.amount ? esc(String(e.amount)) : "&mdash;"}</b></div>
<div class="tile"><small>Category</small><b>${L.hi || L.en}</b></div>
<div class="tile"><small>Status</small><b>${statusLabel(e.status)}</b></div>
</div>
${e.summary ? `<p class="d-sum" data-reveal>${esc(e.summary)}</p>` : ""}
${edu ? `<div class="edu-row" data-reveal>${edu}</div>` : ""}
<section class="cta-panel" data-reveal>
<div><h3>Apply karna hai?</h3><p>Official portal par jao &mdash; wahan ki details sabse sahi hoti hain.</p></div>
<div class="cta-actions">
<a class="btn btn-pri" href="${esc(e.official_link)}" target="_blank" rel="nofollow noopener">Official Portal ${strokeIcon("ext")}</a>
<button class="btn btn-ghost" type="button" data-copy="${esc(url)}">${strokeIcon("link")}<span class="cp-l">Copy Link</span></button>
<a class="btn btn-ghost wa" href="https://wa.me/?text=${shareTxt}" target="_blank" rel="noopener" aria-label="WhatsApp par share karo">${fillIcon("wa")}WhatsApp</a>
<a class="btn btn-ghost tg" href="https://t.me/share/url?url=${shareUrl}&amp;text=${shareTxt}" target="_blank" rel="noopener" aria-label="Telegram par share karo">${fillIcon("tg")}Telegram</a>
</div>
</section>
${note()}
${relCards ? `<section class="rel-sec"><h2>Isi category me aur bhi</h2><div class="grid">${relCards}</div></section>` : ""}
</main>
${footerHTML("../")}
<script>${RUNTIME_JS}</script>`;
}

// ---------- shared runtime JS (all pages; no template literals inside) ----------
const RUNTIME_JS = `
(function(){
var d=document;
function $$all(s,r){return Array.prototype.slice.call((r||d).querySelectorAll(s));}
var tb=d.getElementById('themeBtn');
if(tb){tb.addEventListener('click',function(){
var t=d.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
d.documentElement.setAttribute('data-theme',t);
try{localStorage.setItem('bna-theme',t);}catch(e){}});}
function pd(s){var p=s.split('-');return new Date(+p[0],p[1]-1,+p[2]);}
var io=null;
function reveal(root){
var els=$$all('[data-reveal]:not(.rv-in)',root);
if(!('IntersectionObserver' in window)||window.matchMedia('(prefers-reduced-motion: reduce)').matches){
els.forEach(function(el){el.classList.add('rv-in');});return;}
if(!io){io=new IntersectionObserver(function(es){es.forEach(function(x){
if(x.isIntersecting){x.target.classList.add('rv-in');io.unobserve(x.target);}});},{threshold:.07});}
els.forEach(function(el){io.observe(el);});}
function enhance(root){
$$all('[data-dl]',root).forEach(function(el){
if(el.getAttribute('data-done'))return;el.setAttribute('data-done','1');
var v=el.getAttribute('data-dl');if(!v)return;
var days=Math.round((pd(v).getTime()-new Date(new Date().setHours(0,0,0,0)).getTime())/86400000);
var txt,tone;
if(days<0){txt='date nikal gayi';tone='dl-off';}
else if(days===0){txt='AAJ last date';tone='dl-bad';}
else if(days<=3){txt=(days===1?'kal':days+' din')+' last date';tone='dl-bad';}
else if(days<=10){txt=days+' din bache';tone='dl-warn';}
else{txt=days+' din bache';tone='';}
if(tone)el.classList.add(tone);
var s=el.querySelector('.dl-txt');if(s)s.textContent=txt;
if(el.hasAttribute('data-main')){
var sub=d.getElementById('dl-sub');
if(sub)sub.textContent=days<0?'Window close ho chuki hai':(days===0?'Aaj hi apply karo!':days+' din baaki hain');}});
reveal(root);}
window.BNA={enhance:enhance};
enhance();
$$all('[data-copy]').forEach(function(b){
b.addEventListener('click',function(){var l=b.querySelector('.cp-l'),o=l?l.textContent:'';
function ok(){if(l){l.textContent='Copy ho gaya';setTimeout(function(){l.textContent=o;},1600);}}
try{navigator.clipboard.writeText(b.getAttribute('data-copy')).then(ok,ok);}catch(e){ok();}});});
var tt=d.getElementById('toTop');
if(tt){window.addEventListener('scroll',function(){tt.classList.toggle('show',window.scrollY>420);},{passive:true});
tt.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});}
window.addEventListener('keydown',function(e){
var q=d.getElementById('q');
if(e.key==='/'&&q&&d.activeElement!==q&&!/INPUT|TEXTAREA|SELECT/.test((d.activeElement&&d.activeElement.tagName)||'')){e.preventDefault();q.focus();}});
})();
`;

// ---------- index page app JS ----------
const APP_JS = `
(function(){
var IDX=null,st={q:'',f:'all',x:'all',s:'new'};
var d=document,list=d.getElementById('list'),skels=d.getElementById('skels'),
cnt=d.getElementById('resCount'),empty=d.getElementById('empty'),
q=d.getElementById('q'),filters=d.getElementById('filters'),
seg=d.getElementById('seg'),sortSel=d.getElementById('sortSel');
function low(x){return (x||'').toLowerCase();}
function apply(){
if(!IDX)return;
var term=low(st.q.trim());
var out=IDX.filter(function(e){
if(st.f!=='all'&&e.c!==st.f)return false;
if(st.x==='closing'&&e.st!=='closing_soon')return false;
if(st.x==='open'&&e.st!=='open')return false;
if(term&&(low(e.t)+' '+low(e.o)+' '+low(e.s)).indexOf(term)<0)return false;
return true;});
if(st.s==='new'){out.sort(function(a,b){return (b.f||'').localeCompare(a.f||'');});}
else{out.sort(function(a,b){
var xa=a.d?1:0,xb=b.d?1:0;if(xa!==xb)return xb-xa;
return (a.d||'9999').localeCompare(b.d||'9999');});}
render(out);}
function render(out){
list.innerHTML=out.slice(0,60).map(function(e){return e.h;}).join('');
cnt.textContent=out.length+(out.length===1?' opportunity':' opportunities');
empty.hidden=out.length>0;
skels.hidden=true;
list.hidden=false;
if(window.BNA)BNA.enhance(list);}
fetch('search-index.json').then(function(r){return r.json();})
.then(function(j){IDX=j;apply();})
.catch(function(){IDX=[];render([]);});
var tm;
q.addEventListener('input',function(){clearTimeout(tm);tm=setTimeout(function(){st.q=q.value;apply();},120);});
filters.addEventListener('click',function(ev){
var b=ev.target.closest('.chip');if(!b)return;
filters.querySelectorAll('.chip').forEach(function(c){c.classList.remove('on');});
b.classList.add('on');st.f=b.getAttribute('data-f');apply();});
seg.addEventListener('click',function(ev){
var b=ev.target.closest('button');if(!b)return;
seg.querySelectorAll('button').forEach(function(c){c.classList.remove('on');});
b.classList.add('on');st.x=b.getAttribute('data-x');apply();});
sortSel.addEventListener('change',function(){st.s=sortSel.value;apply();});
Array.prototype.forEach.call(document.querySelectorAll('[data-n]'),function(el){
var T=+el.getAttribute('data-n')||0,t0=null,dur=900;
function step(ts){if(t0===null)t0=ts;var p=Math.min((ts-t0)/dur,1);p=1-Math.pow(1-p,3);
el.textContent=Math.round(T*p);if(p<1)requestAnimationFrame(step);}
requestAnimationFrame(step);});
})();
`;

// ---------- build ----------
async function writeFile(relPath, content) {
  const file = path.join(DIST(), relPath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

const SKEL_CARDS = Array(6)
  .fill('<div class="sk-card"><div class="sk sk-a"></div><div class="sk sk-b"></div><div class="sk sk-b"></div><div class="sk sk-c"></div></div>')
  .join("");

export async function buildSite() {
  const db = await readDB();
  const entries = db.opportunities.filter((o) => o.status !== "closed");
  await fs.rm(DIST(), { recursive: true, force: true });
  await fs.mkdir(DIST(), { recursive: true });

  const stats = {
    total: db.opportunities.length,
    open: entries.length,
    closing: entries.filter((e) => e.status === "closing_soon").length,
  };
  let pages = 0;

  // ---- homepage ----
  const idxBody = `${header("")}
<section class="hero"><div class="hero-in">
<span class="hero-pill">${strokeIcon("shield")}Rozana auto-verify &middot; 100% free</span>
<h1>Naukri Â· Scholarship Â· Exam Â· Yojana<br><em>sab ek jagah.</em></h1>
<p class="hero-sub">Sarkari portals se rozana opportunities collect hoti hain, verify hokar yahan publish. Koi spam nahi &mdash; seedha jaankari.</p>
<div class="search-wrap">${strokeIcon("search")}<input id="q" type="search" placeholder="Search karo: scholarship, SSC, yojana..." autocomplete="off" aria-label="Search opportunities"><span class="search-kbd">/</span></div>
<div class="stats-row">
<div class="stat"><b data-n="${stats.total}">0</b><small>Total tracked</small></div>
<div class="stat"><b data-n="${stats.open}">0</b><small>Active abhi</small></div>
<div class="stat stat-warn"><b data-n="${stats.closing}">0</b><small>Jald band honge</small></div>
</div>
<p class="hero-trust">${strokeIcon("zap")}Data har 4 ghante me update hota hai &middot; Git-backed permanent history</p>
</div></section>
<main class="wrap page-top">
<div class="sec-head"><h2>Aaj ke mauke</h2><span id="resCount" class="res-count">${entries.length} opportunities</span></div>
<div class="toolbar">
<div class="chips" id="filters"><button class="chip on" data-f="all">All</button>${Object.entries(CAT_LABELS).map(([k, v]) => `<button class="chip" data-f="${k}">${v.en}</button>`).join("")}</div>
<div class="toolbar-right">
<div class="seg" id="seg"><button class="on" data-x="all">Sabhi</button><button data-x="open">Open</button><button data-x="closing">Closing</button></div>
<select id="sortSel" aria-label="Sort opportunities"><option value="new">Naya pehle</option><option value="deadline">Deadline nazdeek</option></select>
</div></div>
<div class="grid" id="list">${[...entries].sort((a, b) => (b.first_seen || "").localeCompare(a.first_seen || "")).slice(0, 60).map((e) => cardHTML(e)).join("")}</div>
<div class="grid" id="skels" hidden>${SKEL_CARDS}</div>
<div class="empty" id="empty" hidden>${strokeIcon("search")}<p>Kuch nahi mila. Doosra keyword try karo ya filter hata do.</p></div>
${note()}
</main>
${footerHTML("")}
<script>${RUNTIME_JS}</script>
<script>${APP_JS}</script>`;
  await writeFile("index.html", layout({
    title: "Bharat Naukri Alert â€” Sarkari Scholarships, Exams, Jobs & Schemes Tracker",
    desc: "Naukri, scholarship, exam aur sarkari yojana ke updates â€” rozana auto-collect aur verify. Deadline kabhi miss mat karo.",
    canonical: `${SITE_URL}/`,
    body: idxBody,
    jsonld: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Bharat Naukri Alert",
      description: "Autonomous tracker of Indian government scholarships, exams, jobs and schemes",
      url: SITE_URL,
    }),
  }));
  pages++;

  // ---- category pages ----
  for (const [cat, labels] of Object.entries(CAT_LABELS)) {
    const list = entries.filter((e) => e.category === cat);
    const body = `${header("../")}
<main class="wrap page-top">
<nav class="crumb"><a href="../index.html">Home</a>${strokeIcon("chev")}<span>${labels.en}</span></nav>
<h1 class="page-h">${labels.en} <span class="cnt-badge">${list.length}</span></h1>
<p class="page-sub">${labels.hi} &mdash; rozana auto-update hota hai.</p>
${list.length ? `<div class="grid">${list.map((e) => cardHTML(e, "../")).join("")}</div>` : `<div class="empty">${strokeIcon("search")}<p>Abhi kuch nahi hai. Jald update hoga.</p></div>`}
${note()}
</main>
${footerHTML("../")}
<script>${RUNTIME_JS}</script>`;
    await writeFile(`category/${cat}.html`, layout({
      title: `${labels.en} â€” Bharat Naukri Alert`,
      desc: `Latest government ${labels.en.toLowerCase()} with deadlines, auto-updated daily.`,
      canonical: `${SITE_URL}/category/${cat}.html`,
      body,
    }));
    pages++;
  }

  // ---- detail pages ----
  for (const e of entries) {
    const related = entries.filter((x) => x.category === e.category && x.id !== e.id).slice(0, 3);
    await writeFile(`o/${encodeURIComponent(e.id)}.html`, layout({
      title: `${e.title.slice(0, 60)} â€” Last date ${e.deadline || "check portal"} | Bharat Naukri Alert`,
      desc: (e.summary || `${e.title} by ${e.org}. Check deadline and apply.`).slice(0, 155),
      canonical: `${SITE_URL}/o/${encodeURIComponent(e.id)}.html`,
      body: detailBody(e, related),
      jsonld: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: e.title,
        description: e.summary || e.title,
        url: `${SITE_URL}/o/${encodeURIComponent(e.id)}.html`,
        keywords: [e.category, e.org, "government"],
      }),
    }));
    pages++;
  }

  // ---- search index ----
  const searchIndex = entries.map((e) => ({
    t: e.title,
    o: e.org,
    c: e.category,
    d: e.deadline,
    s: (e.summary || "").slice(0, 140),
    a: e.amount || "",
    st: e.status,
    f: e.first_seen,
    h: cardHTML(e),
  }));
  await writeFile("search-index.json", JSON.stringify(searchIndex));

  // ---- sitemap / robots / llms.txt ----
  const urls = ["", ...Object.keys(CAT_LABELS).map((c) => `category/${c}.html`), ...entries.map((e) => `o/${encodeURIComponent(e.id)}.html`)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `\t<url><loc>${SITE_URL}/${u}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>`).join("\n")}
</urlset>`;
  await writeFile("sitemap.xml", sitemap);
  await writeFile("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml`);
  await writeFile("llms.txt", `# Bharat Naukri Alert\n\nAutonomous tracker of Indian government opportunities: scholarships, exams, jobs, schemes.\nStructured JSON data available in the source repository under data/.\n`);

  return { pages: pages + 3, entries: entries.length, stats };
}

if (process.argv[1] && process.argv[1].endsWith("build.js")) {
  console.log(JSON.stringify(await buildSite(), null, 2));
}
