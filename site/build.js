import fs from "node:fs/promises";
import path from "node:path";
import { readDB } from "../lib/store.js";
import { SITE_CONFIG } from "../lib/site-config.js";
import { postsFromDetails, feeFromDetails } from "../lib/org-detect.js";

const PORTAL_NAME_RE = /sarkari\s*result|rojgar\s*result|free\s*job\s*alert|sarkari\s*job\s*find|sarkari\s*ujala|more details visit/i;

const DIST = () => path.join(process.cwd(), "site", "dist");
const SITE_URL = SITE_CONFIG.url;
const REPO_URL = SITE_CONFIG.repoUrl;

const CAT_LABELS = {
  scholarship: { en: "Scholarships", hi: "छात्रवृत्तियाँ", icon: "cap" },
  exam: { en: "Exams", hi: "परीक्षाएँ", icon: "file" },
  job: { en: "Jobs", hi: "नौकरियाँ", icon: "briefcase" },
  scheme: { en: "Schemes", hi: "योजनाएँ", icon: "landmark" },
  "admit-card": { en: "Admit Cards", hi: "एडमिट कार्ड", icon: "ticket" },
  "answer-key": { en: "Answer Keys", hi: "उत्तर कुंजी", icon: "file" },
  result: { en: "Results", hi: "परिणाम", icon: "trophy" },
  quiz: { en: "Quizzes", hi: "प्रश्नोत्तरी", icon: "target" },
};

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry", "Chandigarh",
];

const LANGS = {
  en: {
    home: "Home", cat_scholarship: "Scholarships", cat_exam: "Exams", cat_job: "Jobs", cat_scheme: "Schemes",
    "cat_admit-card": "Admit Cards", cat_result: "Results",
    pill: "Verified daily by our team · 100% free", t1: "Jobs, Scholarships, Exams, Yojanas", t2: "all in one place.",
    sub: "Government opportunities checked and verified daily from official portals. No spam — straight information.",
    search_ph: "Search: scholarship, SSC, vacancy...", st_total: "Total tracked", st_open: "Active now", st_closing: "Closing soon",
    trust: "Data updated twice daily, every day",
    latest: "Latest opportunities", f_all: "All", seg_all: "All", seg_open: "Open", seg_closing: "Closing",
    sel_state: "All States", sel_qual: "All Qualifications", sort_new: "Newest first", sort_dl: "Deadline soonest",
    profile: "My Eligibility", saved: "Saved",
    prof_state: "State", prof_qual: "Qualification", prof_any: "Any", prof_all_india: "All India",
    prof_save: "Save Profile", prof_clear: "Clear",
    prof_hint: "Save your eligibility once — only jobs matching your profile stay highlighted on every visit.",
    strip_today: "Today's updates", strip_yest: "Yesterday's updates",
    dl_none: "Date to be announced",
    lastdate: "Last Date", benefit: "Benefit / Pay", category: "Category", status: "Status",
    st_open_l: "Open", st_closing_l: "Closing Soon", st_closed_l: "Closed",
    overview: "Overview", dates: "Important Dates", fee: "Application Fee", vacancy: "Vacancy Details",
    age: "Age Limit", pay: "Pay Scale", howto: "How to Apply", ulinks: "Useful Links",
    cta_h: "Ready to apply?", cta_trust: "Verified official government portal — direct apply link",
    apply_btn: "Official Portal", copy: "Copy Link", copied: "Copied!",
    rel: "More in this category",
    note_t: "Disclaimer:", note_b: " This is an independent information service — not a government portal. Always verify details and last date on the official website before applying.",
    ft_blurb: "Har roz sarkari portals se opportunities check, verify aur publish karte hain — taaki aap kuch miss na karo.",
    ft_t1: "Har entry cross-checked", ft_t2: "Updated twice daily", ft_t3: "Built-in deadline tracking",
    ft_cats: "Categories", ft_res: "Resources", sitemap: "Sitemap", rssfeed: "RSS Feed",
    legal: "Independent information service — not a government website.",
    about: "About", privacy: "Privacy", terms: "Terms", contact: "Contact",
    empty_list: "Nothing found. Try another keyword or clear the filters.", empty_cat: "Nothing here yet. Updates coming soon.",
    sub_state: "— updated twice daily by our team.",
    dl_today: "Apply today!", dl_left: "days left to apply", dl_left1: "day left to apply", dl_past: "Application window has closed",
    chip_today: "Last date TODAY", chip_tmw: "Last date tomorrow", chip_days: "days left", chip_past: "date passed",
  },
  hi: {
    home: "होम", cat_scholarship: "छात्रवृत्तियाँ", cat_exam: "परीक्षाएँ", cat_job: "नौकरियाँ", cat_scheme: "योजनाएँ",
    "cat_admit-card": "एडमिट कार्ड", cat_result: "परिणाम",
    pill: "रोज़ाना हमारी टीम वेरिफ़ाई करती है · 100% मुफ़्त", t1: "नौकरी, छात्रवृत्ति, परीक्षा, योजना", t2: "सब एक जगह।",
    sub: "सरकारी पोर्टल से रोज़ाना अवसर इकट्ठा और सत्यापित होते हैं। कोई स्पैम नहीं — सीधी जानकारी।",
    search_ph: "खोजें: scholarship, SSC, योजना...", st_total: "कुल tracked", st_open: "सक्रिय अभी", st_closing: "जल्द बंद होंगे",
    trust: "डेटा रोज़ाना 2 बार अपडेट होता है",
    latest: "ताज़ा अवसर", f_all: "सभी", seg_all: "सभी", seg_open: "खुले", seg_closing: "बंद होने वाले",
    sel_state: "सभी राज्य", sel_qual: "सभी योग्यता", sort_new: "नए पहले", sort_dl: "डेडलाइन नज़दीक",
    profile: "मेरी योग्यता", saved: "सेव किए गए",
    prof_state: "राज्य", prof_qual: "योग्यता", prof_any: "कोई भी", prof_all_india: "अखिल भारत",
    prof_save: "प्रोफ़ाइल सेव करें", prof_clear: "हटाएँ",
    prof_hint: "योग्यता एक बार सेव करें — हर विज़िट पर सिर्फ़ आपके लिए सही नौकरियाँ हाइलाइट रहेंगी।",
    strip_today: "आज के अपडेट", strip_yest: "कल के अपडेट",
    dl_none: "अंतिम तिथि — पोर्टल देखें",
    lastdate: "अंतिम तिथि", benefit: "लाभ / वेतन", category: "श्रेणी", status: "स्थिति",
    st_open_l: "खुला", st_closing_l: "जल्द बंद", st_closed_l: "बंद",
    overview: "संक्षिप्त जानकारी", dates: "महत्वपूर्ण तिथियाँ", fee: "आवेदन शुल्क", vacancy: "रिक्ति विवरण",
    age: "आयु सीमा", pay: "वेतन", howto: "आवेदन कैसे करें", ulinks: "उपयोगी लिंक",
    cta_h: "आवेदन करना है?", cta_trust: "सत्यापित सरकारी पोर्टल — सीधा आवेदन लिंक",
    apply_btn: "ऑफ़िशियल पोर्टल", copy: "लिंक कॉपी करें", copied: "कॉपी हो गया!",
    rel: "इसी श्रेणी में और",
    note_t: "अस्वीकरण:", note_b: " यह एक स्वतंत्र सूचना सेवा है — सरकारी पोर्टल नहीं। आवेदन से पहले आधिकारिक वेबसाइट पर विवरण और अंतिम तिथि ज़रूर देखें।",
    ft_blurb: "हर रोज़ सरकारी पोर्टल से अवसर चेक, सत्यापित और प्रकाशित करते हैं — ताकि आप कुछ भी मिस न करें।",
    ft_t1: "हर एंट्री क्रॉस-चेक्ड", ft_t2: "रोज़ाना 2 बार अपडेट", ft_t3: "डेडलाइन ट्रैकिंग",
    ft_cats: "श्रेणियाँ", ft_res: "संसाधन", sitemap: "साइटमैप", rssfeed: "RSS फ़ीड",
    legal: "स्वतंत्र सूचना सेवा — सरकारी वेबसाइट नहीं।",
    about: "हमारे बारे में", privacy: "गोपनीयता", terms: "शर्तें", contact: "संपर्क",
    empty_list: "कुछ नहीं मिला। दूसरा कीवर्ड आज़माएँ या फ़िल्टर हटाएँ।", empty_cat: "अभी कुछ नहीं है। जल्द अपडेट आएगा।",
    sub_state: "— रोज़ाना 2 बार हमारी टीम अपडेट करती है।",
    dl_today: "आज ही आवेदन करें!", dl_left: "दिन बाकी हैं", dl_left1: "दिन बाकी है", dl_past: "आवेदन अवधि समाप्त",
    chip_today: "आज अंतिम तिथि", chip_tmw: "कल अंतिम तिथि", chip_days: "दिन बचे", chip_past: "तिथि निकल गई",
  },
  hg: {
    home: "Home", cat_scholarship: "Scholarships", cat_exam: "Exams", cat_job: "Jobs", cat_scheme: "Schemes",
    "cat_admit-card": "Admit Cards", cat_result: "Results",
    pill: "Rozana team verify karti hai · 100% free", t1: "Naukri, Scholarship, Exam, Yojana", t2: "sab ek jagah.",
    sub: "Sarkari portals se rozana opportunities check hoti hain, verify hokar yahan publish. Koi spam nahi — seedha jaankari.",
    search_ph: "Search karo: scholarship, SSC, yojana...", st_total: "Total tracked", st_open: "Active abhi", st_closing: "Jald band honge",
    trust: "Data rozana 2 baar update hota hai",
    latest: "Aaj ke mauke", f_all: "All", seg_all: "Sabhi", seg_open: "Open", seg_closing: "Closing",
    sel_state: "Sabhi States", sel_qual: "Sabhi Qualification", sort_new: "Naya pehle", sort_dl: "Deadline nazdeek",
    profile: "Meri Eligibility", saved: "Saved",
    prof_state: "State", prof_qual: "Qualification", prof_any: "Koi bhi", prof_all_india: "All India",
    prof_save: "Save Profile", prof_clear: "Clear",
    prof_hint: "Profile save karne ke baad sirf tumhare eligible jobs highlight honge — har visit pe auto-filter.",
    strip_today: "Aaj ke updates", strip_yest: "Kal ke updates",
    dl_none: "Last date — portal check karo",
    lastdate: "Last Date", benefit: "Benefit / Pay", category: "Category", status: "Status",
    st_open_l: "Open", st_closing_l: "Closing Soon", st_closed_l: "Closed",
    overview: "Overview", dates: "Important Dates", fee: "Application Fee", vacancy: "Vacancy Details",
    age: "Age Limit", pay: "Pay Scale", howto: "How to Apply", ulinks: "Useful Links",
    cta_h: "Apply karna hai?", cta_trust: "Verified official government portal — direct apply link",
    apply_btn: "Official Portal", copy: "Copy Link", copied: "Copy ho gaya!",
    rel: "Isi category me aur bhi",
    note_t: "Disclaimer:", note_b: " Yeh independent information service hai — sarkari portal nahi. Apply karne se pehle official website par details aur last date zaroor verify karein.",
    ft_blurb: "Har roz sarkari portals se opportunities check, verify aur publish karte hain — taaki tum kuch miss na karo.",
    ft_t1: "Har entry cross-checked", ft_t2: "Rozana 2 baar update", ft_t3: "Deadline tracking built-in",
    ft_cats: "Categories", ft_res: "Resources", sitemap: "Sitemap", rssfeed: "RSS Feed",
    legal: "Independent information service — koi sarkari website nahi hai.",
    about: "About", privacy: "Privacy", terms: "Terms", contact: "Contact",
    empty_list: "Kuch nahi mila. Doosra keyword try karo ya filter hata do.", empty_cat: "Abhi kuch nahi hai. Jald update hoga.",
    sub_state: "— rozana 2 baar team update karti hai.",
    dl_today: "Aaj hi apply karo!", dl_left: "din baaki hain", dl_left1: "din baaki hai", dl_past: "Window close ho chuki hai",
    chip_today: "AAJ last date", chip_tmw: "Kal last date", chip_days: "din bache", chip_past: "date nikal gayi",
  },
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
  heart: '<path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6.3a5 5 0 1 1 7.5 6.3z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
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
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${p}"/></svg>`;
}

function hue(s = "") {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) % 360;
  return h;
}
function initials(org = "") {
  const w = String(org).trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "BN";
  return w.length === 1 ? w[0].slice(0, 2).toUpperCase() : ((w[0][0] + w[1][0]).toUpperCase());
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
.mark{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--brand-2),var(--brand));color:#fff;display:grid;place-items:center;box-shadow:0 4px 12px -4px rgba(232,89,12,.55);flex-shrink:0}
.mark .logo-bell{width:20px;height:20px;stroke:#fff;stroke-width:1.8}
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
.cc-scholarship{background:#efe9ff;color:#6d28d9}.cc-exam{background:#e3edff;color:#1d4ed8}.cc-job{background:#e2f6ea;color:#047857}.cc-scheme{background:#ffedd8;color:#c2410c}.cc-admit-card{background:#dcf5f2;color:#0f766e}.cc-answer-key{background:#fef3c7;color:#92400e}.cc-result{background:#ffe4ea;color:#be123c}
[data-theme=dark] .cc-scholarship{background:#241a3d;color:#c4b5fd}[data-theme=dark] .cc-exam{background:#16233f;color:#93b4ff}[data-theme=dark] .cc-job{background:#12291c;color:#6ee7a0}[data-theme=dark] .cc-scheme{background:#2a1a0e;color:#fdba74}[data-theme=dark] .cc-admit-card{background:#0f2b28;color:#5eead4}[data-theme=dark] .cc-answer-key{background:#2a2008;color:#fcd34d}[data-theme=dark] .cc-result{background:#2b1219;color:#fda4af}
.op-t{font-family:var(--disp);font-size:15.5px;font-weight:700;line-height:1.42;letter-spacing:-.2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:44px}
.op-s{font-size:12.5px;color:var(--mut);line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:-4px}
.op-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:10px;border-top:1px dashed var(--line)}
.dl-chip,.amt-chip{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;padding:5px 10px;border-radius:999px}
.dl-chip svg,.amt-chip svg{width:12px;height:12px;flex-shrink:0}
.amt-chip{background:var(--brand-soft);color:var(--brand)}
.state-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:5px 10px;border-radius:999px;border:1px solid var(--line);color:var(--mut);background:var(--card)}
.state-chip svg{width:12px;height:12px;color:var(--brand)}
.dl-chip{background:var(--ok-bg);color:var(--ok)}
.dl-warn{background:var(--warn-bg)!important;color:var(--warn)!important}
.dl-bad{background:var(--bad-bg)!important;color:var(--bad)!important}
.dl-off{background:transparent!important;border:1px solid var(--line);color:var(--mut)!important}
.posts-chip,.fee-chip{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:5px 10px;border-radius:999px;border:1px solid var(--line);color:var(--brand);background:var(--card)}
.posts-chip svg,.fee-chip svg{width:12px;height:12px;flex-shrink:0}
.fee-chip{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 30%,var(--line))}
.editor-note{background:linear-gradient(135deg,color-mix(in srgb,var(--brand) 8%,var(--card)),var(--card));border:1px solid color-mix(in srgb,var(--brand) 22%,var(--line));border-radius:14px;padding:16px 18px;margin:14px 0}
.editor-note p{font-size:13.5px;line-height:1.7;color:color-mix(in srgb,var(--ink) 90%,var(--mut))}
.editor-note b{color:var(--brand)}
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

const CSS_D = `
/* language button */
.lang-btn{width:auto;min-width:44px;padding:0 11px;font-weight:800;font-size:12px;font-family:var(--disp);letter-spacing:.5px}

/* notification badge */
.notif-btn svg{width:18px;height:18px}
.notif-badge{position:absolute;top:2px;right:2px;min-width:16px;height:16px;border-radius:8px;background:#e8590c;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;line-height:1}
.notif-badge:empty{display:none}

/* stretched-link cards + save button */
.op-card{position:relative}
.op-card .stretch{position:absolute;inset:0;z-index:1;border-radius:16px}
.save-btn{position:absolute;top:12px;right:12px;z-index:3;width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--mut);display:none;place-items:center;cursor:pointer;transition:.15s}
.save-btn svg{width:16px;height:16px}
@media(hover:hover){.op-card:hover .save-btn{display:grid}}
@media(hover:none){.op-card .save-btn{display:grid}}
.save-btn:hover{color:#e11d48;border-color:#fda4af}
.save-btn.on{display:grid;color:#fff;background:#e11d48;border-color:#e11d48}
.op-t,.op-top{position:relative}

/* applied button */
[data-apply].on{color:#fff;background:#059669;border-color:#059669}

/* rich detail sections */
.d-sec{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin:14px 0}
.d-sec h3{font-family:var(--disp);font-size:15.5px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.twrap{overflow-x:auto}
.d-table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:340px}
.d-table th,.d-table td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}
.d-table th{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--mut);background:var(--bg)}
.d-table tr:last-child td{border-bottom:0}
.d-table tbody tr:hover td{background:color-mix(in srgb,var(--brand) 4%,transparent)}
.steps{margin:0;padding-left:20px;display:grid;gap:8px;font-size:13.5px}
.kv{font-size:14px}
.ulinks-row{display:flex;flex-wrap:wrap;gap:8px}
.ulinks-row .btn-ghost{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;padding:8px 14px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);transition:.15s}
.ulinks-row .btn-ghost:hover{border-color:var(--brand);color:var(--brand)}
.ulinks-row .btn-ghost svg{width:13px;height:13px}
.trust-line{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--ok);font-weight:600}
.trust-line svg{width:14px;height:14px}

/* footer social + links row */
.social-row{display:flex;gap:9px;margin-top:14px}
.soc-btn{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;color:#fff;transition:.18s;box-shadow:0 6px 16px -8px rgba(0,0,0,.35)}
.soc-btn svg{width:18px;height:18px}
.soc-btn.tg{background:linear-gradient(135deg,#37aee2,#1e96c8)}
.soc-btn.wa{background:linear-gradient(135deg,#47c75f,#25d366)}
.soc-btn:hover{transform:translateY(-2px) scale(1.04)}

/* homepage date separators */
.date-sep{display:flex;align-items:center;gap:10px;margin:22px 0 12px;font-family:var(--disp);font-weight:700;font-size:13.5px;color:var(--mut);text-transform:uppercase;letter-spacing:.8px;grid-column:1/-1}
.date-sep::after{content:"";flex:1;height:1px;background:var(--line)}

/* profile + saved toolbar */
.tbtn-wide{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-family:var(--body);font-size:12.5px;font-weight:600;padding:8px 13px;border-radius:11px;cursor:pointer;transition:.15s}
.tbtn-wide svg{width:15px;height:15px;color:var(--brand)}
.tbtn-wide:hover{border-color:var(--brand);color:var(--brand)}
.prof-panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:-6px 0 14px;display:flex;gap:12px;flex-wrap:wrap;align-items:end}
.prof-panel label{display:block;font-size:11.5px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}
.prof-panel select{width:100%;min-width:170px}
.prof-hint{flex-basis:100%;font-size:12.5px;color:var(--mut)}
.chip.saved-chip{border-color:#fda4af;color:#e11d48}
.chip.saved-chip.on{background:#e11d48;border-color:#e11d48;color:#fff}
#profileBtn.active{border-color:var(--brand);color:var(--brand);background:var(--brand-soft)}

/* ad slot (AdSense ke liye provision — abhi hidden) */
.ad-slot{display:none;min-height:90px;margin:18px 0}

/* static pages */
.page-wrap{max-width:760px;margin:auto;padding:40px 20px 30px}
.page-wrap h1{font-family:var(--disp);font-size:clamp(24px,4vw,34px);font-weight:800;letter-spacing:-.5px;margin-bottom:16px}
.page-wrap h2{font-family:var(--disp);font-size:17px;font-weight:700;margin:22px 0 8px}
.page-wrap p,.page-wrap li{font-size:14.5px;color:color-mix(in srgb,var(--ink) 85%,var(--mut));line-height:1.75}
.page-wrap ul{padding-left:20px}
`;
const CSS_C = `
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
.overview-table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:14px;margin:0 0 18px;font-size:14px}
.overview-table td{padding:11px 16px;border-bottom:1px solid var(--line)}
.overview-table tr:last-child td{border-bottom:0}
.overview-table td:first-child{font-weight:600;color:var(--mut);width:180px;white-space:nowrap}
.overview-table a{color:var(--brand);text-decoration:none;font-weight:600}
.overview-table a svg,.d-sec a svg{width:14px;height:14px;vertical-align:middle}
.overview-table a:hover{text-decoration:underline}
.countdown-badge{display:inline-block;font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:999px;background:color-mix(in srgb,var(--brand) 12%,transparent);color:var(--brand);margin-left:8px;vertical-align:middle}
.countdown-badge.cd-urgent{background:#fee2e2;color:#dc2626}
.verified-badge{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:999px;background:#ecfdf5;color:#059669;margin-left:8px;vertical-align:middle}
.verified-badge svg{width:13px;height:13px}
.last-updated{font-size:12px;color:var(--mut);margin-left:8px}
.d-sum{font-size:15px;margin:4px 0 10px}
.edu-row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 4px}
.edu-chip{font-size:12.5px;font-weight:500;background:var(--card);border:1px solid var(--line);padding:5px 13px;border-radius:999px;color:var(--mut)}
.edu-chip.state{color:var(--brand);border-color:color-mix(in srgb,var(--brand) 35%,transparent);background:var(--brand-soft)}
.edu-chip.state svg{width:12px;height:12px;margin-right:4px;vertical-align:-2px}

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
.ft-bar>div{max-width:1100px;margin:auto;padding:16px 20px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--mut);align-items:center}
.ft-legal{display:inline-flex;gap:14px}
.ft-legal a{color:var(--mut)}
.ft-legal a:hover{color:var(--brand)}

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
CSS += CSS_C + CSS_D;

// ---------- theme boot (no FOUC), favicon ----------
const THEME_BOOT = "(function(){try{var t=localStorage.getItem('bna-theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();";

const FAVICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAl0SURBVFhH7Zd5UBR3Fsd/3c3McA3nMMPAcM0MMA7DcCMgIIcoEIiiQQqjJmLk9EKDisYQjDGaC3fjkoqJuB6brCRZE2MUNZFFDCo50I0SQ3QNpUnJxmAS1yNIv+9WjyEVJ/em9r/9VHV1/fp9f++9369fv/o1Y//ndzA2t0gXEZueGR6ZFGlv+5/j4x82Y3xh8YGy6jpEj8mFKsD8SkrKnUp73X8NrQkdLa5Tb7hRH2Syt7mqAtLuLJl1uWze8g/T8krIEJUK7yALVAGmFnstGhp4WqWpp1W+iwFw9vYfZbhRswwPyoAHFaAabZG9XRsSsTmjYDoCItLhrI2E4BUKB68QuKn111NTc32+r0VrsSDOVfbjEQFivWsXPZwc9H37DxBXaZqwVgBVO5/GfYFx9nYbMv0uV7UBeqMOVrMWYXo1lO4+YDJ/MJbvay9He4MjzfJ4EvUOoCWOF9AQqbfX2Bh6SDsP6wSIVU7tAHjP7LJkc0LGaWNEfPWIBu1xpl0bo858tDsIV/7uCzrkhaG9ClxoYXh1iaN4+vHA2SPatAlFWmNkUr/GnPS4NKYZXvegToC4yLmXdtQ6jehs3FgfHUoN8mFxruITFBcLpuwpBUbrGGj0kaLWEDlR0gz3pNTSp1lElzJ76Oq6DrryJOFcIXAqATimBQ7wwA4B4rNub1xpzlEzn2JXdVDEMbU+GrrwuFabj5neS7FCgLjQ+w+3JSCu8HgFDwig2bpEllXrb4hMGvYNtgzoTfEWyU7vJTdiMB50cfrrROfnELWcw2eloJOJoJ4w0DFP0EEeeIEDNnIQn1D24sA4d2muLixqi09IFPzD41fZYpU5vYdaOdAQf+tVoGl0MFbIIM5xflMaG6PGHPLVW2E0xSZJ45vvj8vHR4EQzxSQOPT+WVyoxtW94RA/CAVOaUBH5KAOBtrHg3byoGYeWMMgPuz+6sgCfQLNRzT6KLCIkgAqUyej1gHiXNVam5FWquZLVU+1/pny0bNHBY5KhF+w+TlbcmgVhg+benFcCxp4APj8Pgx1KtEzmqFvqhwX1siAbh7ULoD2CKBWHrSRB1ZwsBXd+rBsyY85KiXaO9AClSFms20X7nUcECuc+m0JiHUuu8UauSgVnq8ltcnPGIOEMZkRttUfzcrEYTXQkw7qywN6AjDczXB2OodeI8PF1RzwjgA6IIB2CaC/SDvAAQ0cMJ9heKXHK9/tQlDEMVVAxHXbomcpn8M8OZjUHMRFTufECqczksEvLPaUr97y2cikmwdNj6HDB3QqF/RuMKjbCXScYWAeh8FMDl81ccARDtTGA68JwHYeaGaghzignGFogeMA3i13lnwFmWLrfUKsYIbZRqpSzcaiWwkI4gL5IFU6tUsirTH6uq/e0jaSgLjHvw0HdaCTY0FdDqBOBjzDA7MFoIIBVQxocwAOMWA7A7YwXKl3w8VS2bWhmRzEGjlok9ks+TJEJk5Uh0SBBWTl0HyXHCySgaG1VaCFistUrehiDeA1eiu0+sjXv0tgp+oE3goBnYgBHWZAhxHi5nlPDy7WFG6pmfD8lnvzW04vTpzx7/05rYMbYj/94umczrPPrM35utLlLM2SEnQAPaXPknwZrckFaqkQVYl3UL3XZNQ5wBZkuMr1OM1xPckATh1iOednsOyRngNwGH7Jqx9vhdo+NRxS4Mr+wi7bTmU2jM8rbezJLW08HpH36BTp2cXmccuvvZhx/vRjFS1Uy8OWQIUAesR/smTXj4rL1+itQ8x/fBTVqKeJFa43bQlcLYrUXZ9265tMGDvWd6SfU2+Nt/hXzy/Rbga9Ewy8LcOFnZO3f/7CwqySe1fPnVq6dOCukqWDJTNWLpL0A+usTdjuDqz3A+oZhmdJdSAAq7Tlkr24uFiIT822xaHcXAVNSjHYEvgp6ERmuPiiknAoBnTEH/QWAzo5DB68ozswbWvI1LuXNE+ZVtfMjPcbvlgTej+2OgHPM6CJgRp4iJU8UMlDfNC70d73r4LaIwqwSwk6NgbUqQLtZ7Zia9voBlYknObv5vv4Iv7jJeWyPvxNDrzEQC08aAMPWsODFnLAHA5DK9xetvf9qxD3BKzDfm/QyTxQuytoH7P1+y92MuhmcmBTGAorGbCbs130stQHBFsjoid4YBkHzGIYWuTcD7Q72Pv/RYZfUvbikBnUN8m2etrLQG0c0MFj2UoeLJ1D1QIe6BBAb/C3GpHUCTfzoD/yoFUcqJyD1HaHng1Ltff/s9w8bMnHXjfQmWqgLxc47AwcUQGdLsDbAj5sZfCewNDVwoCjDNTOQPs50Os8aAcP2iTtAgdawgFzOQyvdttpH+MnAapdaZ97H45GAP+qA/WEfkMnRl+mf2R9Tu/HXqVuww3q0tGlnVqgywfodAc6nIE3ZUAbA3YxWz1gMwPWM2ApAx4SgK26SfaxfhTar90mblXgg7V6dDUGfNO22O/8jmpTX0tFZP8zlWO+airPvPl42Vg8UZaOxtIUrJgSi2WFZizN12N5nhar7/DG+jvdsbnIBa/dpcDRUhnOz5Tas/xr6ggMsY93G/v27XNZXhxzKTshCTU1K8TF9U/1Ty174ExuyfxLGZMqv0mYcI9ozSyFKfUuhCZPQnB8AbTW8fA2ZcLNkAqFLhG8JhZMFQnmbgJTGiFzC4HKKxhTrEHYMCe9zD7mbcysqlugMqXBnDYRpVX1KJhWhbjMiTBEp8HflADf0Fj4GKLhHGiFo78ZCr9RkH97OWnD4aoxwEWth5MqBHKvQDh46MDc/ME8AsFcg2CMyz4udVj7uN+Rnjd1myo4Ep66cHhoQ+GiCoaLKgjOXgFw8vSHo4cfXN00yPJ0RqHaBbk+rkj3UiLJ0x1+bt5QKDVQuGuhcPeDo4c/HD11UHx7lym1CLEkYdOmHbednG8jJjU/N9ic8Jmb2gBHr0DIPHQQlFpwzmowR28w5oE8tQMuN43C9Q0KfDmX4aNsht2hDDXeDIxXgim8wDn52OYpPAPh7KOHUmOEOtgiRsRnbGxtbRXs495GcflSd2vyhAnmhIzF4THpzcao1NeCRiV2ao0xx1001rOPZnt8jQ+jgW4F8Gdm63YfJzJss8jgqjb8U6239gaYErsN1pQD4XEZ2yxJOaujUnKnjx0/+Qc/Ob8Z6fxwcYkpB3/igQ0M4v0cBgsYruVyeCfHc9PPvt/fg/1v1WCZdvn1OYobmO6Aa8VyfDJRuffAuFun4N/CfwBMTCnKVfdX6QAAAABJRU5ErkJggg==";

function layout({ title, desc, canonical, body, jsonld }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="google-site-verification" content="${esc(process.env.GSC_VERIFICATION || "PYPOQDYayyc8R6ydjv_w6DGeaFuT1T0fOToXTTbgvEk")}">
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="Bharat Naukri Alert">
<meta property="og:image" content="${SITE_URL}/og-logo.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE_URL}/og-logo.png">
<meta name="theme-color" content="#e8590c">
<link rel="icon" href="${FAVICON}">
<link rel="apple-touch-icon" href="${SITE_URL}/icon-192.png">
<link rel="manifest" href="/manifest.json">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="BNA">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap" rel="stylesheet">
<script>${THEME_BOOT}</script>
<style>${CSS}</style>
<script type="application/ld+json">${jsonld || "{}"}</script>
</head>
<body>
<div class="ad-slot" id="ad-top"></div>
${body}
</body>
</html>`;
}

function header(prefix = "") {
  const cats = Object.entries(CAT_LABELS)
    .map(([k, v]) => `<a href="${prefix}category/${k}.html" data-i18n="cat_${k}">${v.en}</a>`)
    .join("");
  return `<header class="hdr"><div class="hdr-in">
<a class="logo" href="${prefix}index.html"><span class="mark">${strokeIcon("bell", "logo-bell")}</span><span class="wordmark">Bharat <em>Naukri Alert</em></span></a>
<nav class="hnav"><a href="${prefix}index.html" data-i18n="home">Home</a>${cats}</nav>
<button id="langBtn" class="tbtn lang-btn" aria-label="Language">EN</button>
<button id="themeBtn" class="tbtn" aria-label="Toggle theme">${strokeIcon("sun", "ic-sun")}${strokeIcon("moon", "ic-moon")}</button>
<button id="notifBtn" class="tbtn notif-btn" aria-label="Notifications" style="position:relative;display:none">${strokeIcon("bell")}<span class="notif-badge" id="notifBadge"></span></button>
</div></header>`;
}

function footerHTML(prefix = "") {
  const cats = Object.entries(CAT_LABELS)
    .map(([k, v]) => `<a href="${prefix}category/${k}.html" data-i18n="cat_${k}">${v.en}</a>`)
    .join("");
  return `<footer class="ft"><div class="ft-in">
<div class="ft-brand">
<a class="logo" href="${prefix}index.html"><span class="mark">${strokeIcon("bell", "logo-bell")}</span><span class="wordmark">Bharat <em>Naukri Alert</em></span></a>
<p data-i18n="ft_blurb">Har roz sarkari portals se opportunities check, verify aur publish karte hain — taaki aap kuch miss na karo.</p>
<ul class="trust"><li>${strokeIcon("shield")}<span data-i18n="ft_t1">Har entry cross-checked</span></li><li>${strokeIcon("zap")}<span data-i18n="ft_t2">Updated twice daily</span></li><li>${strokeIcon("clock")}<span data-i18n="ft_t3">Built-in deadline tracking</span></li></ul>
<div class="social-row">
${SITE_CONFIG.telegramUrl ? `<a class="soc-btn tg" href="${esc(SITE_CONFIG.telegramUrl)}" target="_blank" rel="noopener" aria-label="Telegram channel">${fillIcon("tg")}</a>` : ""}
${SITE_CONFIG.whatsappUrl ? `<a class="soc-btn wa" href="${esc(SITE_CONFIG.whatsappUrl)}" target="_blank" rel="noopener" aria-label="WhatsApp channel">${fillIcon("wa")}</a>` : ""}
</div>
</div>
<div class="ft-col"><h4 data-i18n="ft_cats">Categories</h4><div class="ft-links">${cats}</div></div>
<div class="ft-col"><h4 data-i18n="ft_res">Resources</h4><div class="ft-links">
<a href="${prefix}sitemap.xml" data-i18n="sitemap">Sitemap</a>
<a href="${prefix}rss.xml" data-i18n="rssfeed">RSS Feed</a>
</div></div>
</div>
<div class="ft-bar"><div>
<span>&copy; ${new Date().getFullYear()} Bharat Naukri Alert &middot; <span data-i18n="legal">Independent information service — not a government website.</span></span>
<span class="ft-legal">
<a href="${prefix}about.html" data-i18n="about">About</a><a href="${prefix}privacy.html" data-i18n="privacy">Privacy</a><a href="${prefix}terms.html" data-i18n="terms">Terms</a><a href="${prefix}contact.html" data-i18n="contact">Contact</a>
</span>
</div></div></footer>
<button id="toTop" aria-label="Back to top">${strokeIcon("up")}</button>`;
}

function note() {
  return `<div class="note" data-reveal>${strokeIcon("alert")}<p><b data-i18n="note_t">Disclaimer:</b><span data-i18n="note_b"> This is an independent information service &mdash; not a government portal. Always verify details and last date on the official website before applying.</span></p></div>`;
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
  return `<span class="dl-chip">${strokeIcon("clock")}<span data-i18n="dl_none">Last date — check portal</span></span>`;
}

function cardHTML(e, rel = "") {
  const stList = (e.eligibility?.states || []).filter((s) => s && s !== "ALL");
  const stChip = stList.length ? `<span class="state-chip">${strokeIcon("landmark")}${esc(stList.slice(0, 2).join(", "))}</span>` : "";
  const posts = postsFromDetails(e.details);
  const postsChip = posts ? `<span class="posts-chip">${posts.toLocaleString()} Posts</span>` : "";
  const fee = feeFromDetails(e.details);
  const feeChip = fee ? `<span class="fee-chip">${fee.symbol}${esc(fee.text)}</span>` : "";
  const href = `${rel}o/${encodeURIComponent(e.id)}.html`;
  const rawSum = e.editor_note || e.summary || "";
  const sumOK = rawSum.length > 45 && !PORTAL_NAME_RE.test(rawSum);
  return `<article class="op-card" data-reveal data-id="${esc(e.id)}">
<a class="stretch" href="${href}" aria-label="${esc(e.title.slice(0, 60))}"></a>
<button type="button" class="save-btn" data-save="${esc(e.id)}" aria-label="Job save karo">${strokeIcon("heart")}</button>
<div class="op-top"><span class="avatar" style="--h:${hue(e.org)}">${initials(e.org)}</span>
<span class="op-org">${esc(e.org || "Government of India")}</span><span class="op-sp"></span>${catChip(e.category)}</div>
<h3 class="op-t">${esc(e.title)}</h3>
${sumOK ? `<p class="op-s">${esc(rawSum)}</p>` : ""}
<div class="op-foot">${dlChip(e)}${stChip}${postsChip}${feeChip}${e.amount ? `<span class="amt-chip">${strokeIcon("wallet")}${esc(String(e.amount)).slice(0, 26)}</span>` : ""}<span class="go">${strokeIcon("ext")}</span></div>
</article>`;
}

function renderDetails(d) {
  if (!d) return "";
  let h = "";
  const table = (titleKey, titleDef, rows, headers) =>
    rows?.length
      ? `<section class="d-sec" data-reveal><h3 data-i18n="${titleKey}">${titleDef}</h3>
<div class="twrap"><table class="d-table">
${headers ? `<thead><tr>${headers.map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead>` : ""}
<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
</table></div></section>`
      : "";
  const pairs = (titleKey, titleDef, arr) =>
    arr?.length ? table(titleKey, titleDef, arr.map((x) => [x.k, x.v])) : "";
  if (d.summary && d.summary.length > 40) {
    h += `<section class="d-sec" data-reveal><h3 data-i18n="overview">Overview</h3><p class="d-sum">${esc(d.summary)}</p></section>`;
  }
  h += pairs("dates", "Important Dates", d.dates);
  h += pairs("fee", "Application Fee", d.fee);
  h += table("vacancy", "Vacancy Details", d.vacancy);
  if (d.ageLimit) {
    h += `<section class="d-sec" data-reveal><h3 data-i18n="age">Age Limit</h3><p class="kv"><b>${esc(d.ageLimit)}</b></p></section>`;
  }
  if (d.payScale) {
    h += `<section class="d-sec" data-reveal><h3 data-i18n="pay">Pay Scale</h3><p class="kv"><b>${esc(d.payScale)}</b></p></section>`;
  }
  if (d.steps?.length) {
    h += `<section class="d-sec" data-reveal><h3 data-i18n="howto">How to Apply</h3><ol class="steps">${d.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>`;
  }
  if (d.extras?.length) {
    const useful = d.extras.filter((x) => {
      const k = (x.k || "").toLowerCase();
      return !/(facebook|twitter|instagram|youtube|social|helpline|email|phone|contact|website)/i.test(k) && !/^(https?:)/i.test(x.v || "");
    });
    if (useful.length) {
      h += pairs("extras", "Additional Information", useful.slice(0, 6));
    }
  }
  return h;
}

function detailBody(e, related, allEntries) {
  const L = CAT_LABELS[e.category] || { en: e.category, hi: "", icon: "file" };
  const url = `${SITE_URL}/o/${encodeURIComponent(e.id)}.html`;
  const shareTxt = encodeURIComponent(`${e.title} — ${url}`);
  const shareUrl = encodeURIComponent(url);
  const edu = (e.eligibility?.education || []).map((x) => `<span class="edu-chip">${esc(x)}</span>`).join("");
  const stList = (e.eligibility?.states || []).filter((s) => s && s !== "ALL");
  const relCards = (related || []).map((r) => cardHTML(r, "../")).join("");
  const posts = postsFromDetails(e.details);
  const fee = feeFromDetails(e.details);
  const deadlineText = e.deadline ? fmtDate(e.deadline) : "Date to be announced";
  const daysLeft = e.deadline ? Math.ceil((new Date(e.deadline + "T23:59:59+05:30") - Date.now()) / 86400000) : null;
  const countdownBadge = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30
    ? `<span class="countdown-badge${daysLeft <= 7 ? " cd-urgent" : ""}">${daysLeft === 0 ? "Last day today!" : daysLeft === 1 ? "1 day left" : daysLeft + " days left"}</span>`
    : "";
  return `${header("../")}
<main class="wrap page-top">
<nav class="crumb"><a href="../index.html">Home</a>${strokeIcon("chev")}<a href="../category/${e.category}.html">${L.en}</a>${strokeIcon("chev")}<span>${esc(e.title.slice(0, 60))}</span></nav>
<div class="d-head">
<div class="d-meta">${catChip(e.category)}<span class="status-pill sp-${e.status}">${statusLabel(e.status)}</span>${e.last_verified ? `<span class="verified-badge">${strokeIcon("shield")} Verified</span>` : ""}</div>
<h1>${esc(e.title)}</h1>
<div class="d-meta"><span class="avatar" style="--h:${hue(e.org)}">${initials(e.org)}</span><span class="op-org">${esc(e.org || "Government of India")}</span>${e.last_verified ? `<span class="last-updated">Last verified: ${fmtDate(e.last_verified.slice(0, 10))}</span>` : ""}</div>
</div>
${(posts || fee || e.deadline || e.amount) ? `<table class="overview-table" data-reveal>
<tbody>
${e.org ? `<tr><td>Organization</td><td><b>${esc(e.org)}</b></td></tr>` : ""}
${posts ? `<tr><td>Total Posts</td><td><b>${posts.toLocaleString()} Vacancies</b></td></tr>` : ""}
${e.deadline ? `<tr><td>Last Date to Apply</td><td><b>${fmtDate(e.deadline)}</b> ${countdownBadge}</td></tr>` : ""}
${fee ? `<tr><td>Application Fee</td><td>${fee.symbol}${esc(fee.text)}</td></tr>` : ""}
${e.amount ? `<tr><td>Pay / Benefit</td><td>${esc(String(e.amount))}</td></tr>` : ""}
${e.details?.ageLimit ? `<tr><td>Age Limit</td><td>${esc(e.details.ageLimit)}</td></tr>` : ""}
${e.details?.payScale ? `<tr><td>Pay Scale</td><td>${esc(e.details.payScale)}</td></tr>` : ""}
${e.official_link ? `<tr><td>Official Website</td><td><a href="${esc(e.official_link)}" target="_blank" rel="nofollow noopener">Apply Now ${strokeIcon("ext")}</a></td></tr>` : ""}
</tbody></table>` : ""}
<div class="info-grid">
<div class="tile"><small data-i18n="lastdate">Last Date</small><b>${deadlineText}</b>${countdownBadge}${e.deadline ? '<span class="tile-sub" id="dl-sub"></span>' : ""}</div>
${e.amount ? `<div class="tile"><small data-i18n="benefit">Benefit / Pay</small><b>${esc(String(e.amount))}</b></div>` : ""}
<div class="tile"><small data-i18n="category">Category</small><b>${L.hi || L.en}</b></div>
<div class="tile"><small data-i18n="status">Status</small><b data-i18n="${e.status === "closing_soon" ? "st_closing_l" : e.status === "closed" ? "st_closed_l" : "st_open_l"}">${statusLabel(e.status)}</b></div>
</div>
${(() => { const ds = e.details?.summary || e.summary || ""; return ds.length > 60 && !PORTAL_NAME_RE.test(ds) && !e.editor_note ? `<p class="d-sum" data-reveal>${esc(ds)}</p>` : ""; })()}
${edu || stList.length ? `<div class="edu-row" data-reveal>${stList.map((s) => `<span class="edu-chip state">${strokeIcon("landmark")}${esc(s)}</span>`).join("")}${edu}</div>` : ""}
${e.editor_note ? `<div class="editor-note" data-reveal><p><b>TL;DR —</b> ${esc(e.editor_note)}</p></div>` : ""}
${renderDetails(e.details)}
${e.details?.links?.length ? `<section class="d-sec" data-reveal><h3 data-i18n="ulinks">Useful Links</h3><div class="ulinks-row">${e.details.links.map((l) => `<a class="btn btn-ghost" href="${esc(l.h)}" target="_blank" rel="nofollow noopener">${strokeIcon("ext")}${esc(l.t)}</a>`).join("")}</div></section>` : ""}
<section class="cta-panel" data-reveal>
<div><h3 data-i18n="cta_h">Ready to apply?</h3><p class="trust-line">${strokeIcon("shield")}<span data-i18n="cta_trust">Verified official government portal — direct apply link</span></p></div>
<div class="cta-actions">
<a class="btn btn-pri" href="${esc(e.official_link)}" target="_blank" rel="nofollow noopener"><span data-i18n="apply_btn">Official Portal</span> ${strokeIcon("ext")}</a>
<button class="btn btn-ghost" type="button" data-apply="${esc(e.id)}" aria-label="Mark as applied"><span class="al-txt">Mark Applied</span></button>
<button class="btn btn-ghost" type="button" data-copy="${esc(url)}">${strokeIcon("link")}<span class="cp-l" data-i18n="copy">Copy Link</span></button>
<a class="btn btn-ghost wa" href="https://wa.me/?text=${shareTxt}" target="_blank" rel="noopener" aria-label="WhatsApp par share karo">${fillIcon("wa")}WhatsApp</a>
<a class="btn btn-ghost tg" href="https://t.me/share/url?url=${shareUrl}&amp;text=${shareTxt}" target="_blank" rel="noopener" aria-label="Telegram par share karo">${fillIcon("tg")}Telegram</a>
</div>
</section>
${note()}
${relCards ? `<section class="rel-sec"><h2 data-i18n="rel">More in this category</h2><div class="grid">${relCards}</div></section>` : ""}
${(() => {
  if (!allEntries || !e.eligibility?.states?.length) return "";
  const myStates = e.eligibility.states.filter(s => s && s !== "ALL");
  if (!myStates.length) return "";
  const stateJobs = allEntries.filter(x => x.id !== e.id && x.eligibility?.states?.some(s => myStates.includes(s))).slice(0, 3);
  if (!stateJobs.length) return "";
  return `<section class="rel-sec"><h2>Jobs in ${myStates.slice(0, 2).join(" & ")}</h2><div class="grid">${stateJobs.map(r => cardHTML(r, "../")).join("")}</div></section>`;
})()}
</main>
${footerHTML("../")}
<script>${RUNTIME_JS}</script>`;
}

// ---------- shared runtime JS (all pages; no template literals inside) ----------
const RUNTIME_JS = `
var LANGS_DATA=${JSON.stringify(LANGS)};
(function(){
var d=document;
function $$all(s,r){return Array.prototype.slice.call((r||d).querySelectorAll(s));}
var LANG=(localStorage.getItem('bna-lang')||'en');
function D(){return LANGS_DATA[LANG]||LANGS_DATA.en;}
function T(k){var s=D()[k];return s==null?(LANGS_DATA.en[k]||k):s;}
function applyLang(){
$$all('[data-i18n]').forEach(function(el){el.textContent=T(el.getAttribute('data-i18n'));});
$$all('[data-i18n-ph]').forEach(function(el){el.setAttribute('placeholder',T(el.getAttribute('data-i18n-ph')));});
d.documentElement.setAttribute('lang',LANG==='hi'?'hi':'en');
var lb=d.getElementById('langBtn');
if(lb)lb.textContent=LANG==='hi'?'हिं':(LANG==='hg'?'HIN':'EN');}
window.BNA_LANG={get:function(){return LANG;},set:function(l){LANG=LANGS_DATA[l]?l:'en';try{localStorage.setItem('bna-lang',LANG);}catch(e){}applyLang();if(window.BNA_APP&&BNA_APP.reapply)BNA_APP.reapply();}};
applyLang();
var lb=d.getElementById('langBtn');
if(lb){lb.addEventListener('click',function(){BNA_LANG.set(LANG==='en'?'hi':(LANG==='hi'?'hg':'en'));});}
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
if(days<0){txt=T('chip_past');tone='dl-off';}
else if(days===0){txt=T('chip_today');tone='dl-bad';}
else if(days<=3){txt=(days===1?T('chip_tmw'):days+' '+T('chip_days'));tone='dl-bad';}
else if(days<=10){txt=days+' '+T('chip_days');tone='dl-warn';}
else{txt=days+' '+T('chip_days');tone='';}
if(tone)el.classList.add(tone);
var s=el.querySelector('.dl-txt');if(s)s.textContent=txt;
if(el.hasAttribute('data-main')){
var sub=d.getElementById('dl-sub');
if(sub)sub.textContent=days<0?T('dl_past'):(days===0?T('dl_today'):days+' '+(days===1?T('dl_left1'):T('dl_left')));}});
reveal(root);}
window.BNA={enhance:enhance};
enhance();
$$all('[data-copy]').forEach(function(b){
b.addEventListener('click',function(){var l=b.querySelector('.cp-l'),o=T('copy');
function ok(){if(l){l.textContent=T('copied');setTimeout(function(){l.textContent=o;},1600);}}
try{navigator.clipboard.writeText(b.getAttribute('data-copy')).then(ok,ok);}catch(e){ok();}});});
var tt=d.getElementById('toTop');
if(tt){window.addEventListener('scroll',function(){tt.classList.toggle('show',window.scrollY>420);},{passive:true});
tt.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});}
window.addEventListener('keydown',function(e){
var q=d.getElementById('q');
if(e.key==='/'&&q&&d.activeElement!==q&&!/INPUT|TEXTAREA|SELECT/.test((d.activeElement&&d.activeElement.tagName)||'')){e.preventDefault();q.focus();}});
function savedIds(){try{return JSON.parse(localStorage.getItem('bna-saved')||'[]');}catch(e){return [];}}
function refreshSaved(){
var ids=savedIds();
var chip=d.getElementById('savedChip');
if(chip)chip.textContent='Saved ('+ids.length+')';
$$all('[data-save]').forEach(function(b){
b.classList.toggle('on',ids.indexOf(b.getAttribute('data-save'))>-1);});}
d.addEventListener('click',function(ev){
var b=ev.target.closest('[data-save]');if(!b)return;ev.preventDefault();
var id=b.getAttribute('data-save');var ids=savedIds();
var i=ids.indexOf(id);
if(i>-1){ids.splice(i,1);}else{ids.unshift(id);}
if(ids.length>200)ids=ids.slice(0,200);
try{localStorage.setItem('bna-saved',JSON.stringify(ids));}catch(e){}
refreshSaved();});
refreshSaved();
var pb=d.getElementById('profileBtn'),pp=d.getElementById('profPanel');
if(pb&&pp){
function prof(){try{return JSON.parse(localStorage.getItem('bna-profile')||'{}');}catch(e){return {};}}
function applyProfUI(){var p=prof();pb.classList.toggle('active',Boolean(p.v||p.q));
var ps=d.getElementById('profState'),pe=d.getElementById('profEdu');
if(ps)ps.value=p.v||'';if(pe)pe.value=p.q||'';}
pb.addEventListener('click',function(){pp.hidden=!pp.hidden;if(!pp.hidden)applyProfUI();});
var sv=d.getElementById('profSave'),cl=d.getElementById('profClear');
if(sv)sv.addEventListener('click',function(){
var v=(d.getElementById('profState')||{}).value||'',q=(d.getElementById('profEdu')||{}).value||'';
try{localStorage.setItem('bna-profile',JSON.stringify({v:v,q:q}));}catch(e){}
applyProfUI();pp.hidden=true;
if(window.BNA_APP&&BNA_APP.reapply)BNA_APP.reapply();});
if(cl)cl.addEventListener('click',function(){
try{localStorage.removeItem('bna-profile');}catch(e){}
applyProfUI();if(window.BNA_APP&&BNA_APP.reapply)BNA_APP.reapply();});
applyProfUI();}

// application tracker
function apps(){try{return JSON.parse(localStorage.getItem('bna-apps')||'[]');}catch(e){return [];}}
function refreshApps(){
var a=apps();var chip=d.getElementById('appsChip');if(chip)chip.textContent='Applied ('+a.length+')';
$$all('[data-apply]').forEach(function(b){
var id=b.getAttribute('data-apply');var found=a.find(function(x){return x.id===id;});
b.classList.toggle('on',Boolean(found));if(found){var al=b.querySelector('.al-txt');if(al)al.textContent=found.status;}
});}
d.addEventListener('click',function(ev){
var b=ev.target.closest('[data-apply]');if(!b)return;ev.preventDefault();
var id=b.getAttribute('data-apply');var a=apps();var idx=a.findIndex(function(x){return x.id===id;});
if(idx>-1){a.splice(idx,1);}
else{a.unshift({id:id,applied:new Date().toISOString().slice(0,10),status:'Applied'});}
if(a.length>100)a=a.slice(0,100);
try{localStorage.setItem('bna-apps',JSON.stringify(a));}catch(e){}
refreshApps();});
refreshApps();

// profile export/import
var expBtn=d.getElementById('profExport'),impBtn=d.getElementById('profImport');
if(expBtn)expBtn.addEventListener('click',function(){
var data={profile:prof(),saved:savedIds(),applications:apps()};
var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
var url=URL.createObjectURL(blob);var a2=d.createElement('a');
a2.href=url;a2.download='bna-profile-backup.json';a2.click();URL.revokeObjectURL(url);});
if(impBtn)impBtn.addEventListener('click',function(){
var input=d.createElement('input');input.type='file';input.accept='.json';
input.addEventListener('change',function(){
var file=input.files[0];if(!file)return;
var reader=new FileReader();
reader.addEventListener('load',function(){
try{var data=JSON.parse(reader.result);
if(data.profile)try{localStorage.setItem('bna-profile',JSON.stringify(data.profile));}catch(e){}
if(data.saved)try{localStorage.setItem('bna-saved',JSON.stringify(data.saved));}catch(e){}
if(data.applications)try{localStorage.setItem('bna-apps',JSON.stringify(data.applications));}catch(e){}
applyProfUI();refreshSaved();refreshApps();alert('Profile imported!');
}catch(e){alert('Invalid file.');}});
reader.readAsText(file);});
input.click();});

(function(){
var nb=d.getElementById('notifBtn'),nbadge=d.getElementById('notifBadge');
if(!nb)return;
var lastSeen=parseInt(localStorage.getItem('bna-notif-ts')||'0',10);
var seenIds=JSON.parse(localStorage.getItem('bna-notif-seen')||'[]');
fetch('/search-index.json').then(function(r){return r.json();}).then(function(idx){
if(!idx||!idx.length)return;
var fresh=idx.filter(function(e){return !seenIds.includes(e.id);});
if(fresh.length>0){
nb.style.display='';
nbadge.textContent=fresh.length>99?'99+':fresh.length;
nb.addEventListener('click',function(){
var msg='Naye '+fresh.length+' updates mil gaye hain!';
if(fresh.length<=5){
msg+='\\n\\n'+fresh.slice(0,5).map(function(e){return e.title;}).join('\\n');
}
alert(msg);
localStorage.setItem('bna-notif-ts',String(Date.now()));
localStorage.setItem('bna-notif-seen',JSON.stringify(idx.map(function(e){return e.id;})));
nbadge.textContent='';
nb.style.display='none';
});
}
}).catch(function(){});
localStorage.setItem('bna-notif-ts',String(Date.now()));
})();
if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){});}
})();
`;

// ---------- index page app JS ----------
const APP_JS = `
(function(){
var IDX=null,st={q:'',f:'all',x:'all',s:'new',v:'',qf:'',saved:false};
var d=document,list=d.getElementById('list'),skels=d.getElementById('skels'),
cnt=d.getElementById('resCount'),empty=d.getElementById('empty'),
q=d.getElementById('q'),filters=d.getElementById('filters'),
seg=d.getElementById('seg'),sortSel=d.getElementById('sortSel'),stateSel=d.getElementById('stateSel'),
qualSel=d.getElementById('qualSel');
function low(x){return (x||'').toLowerCase();}
function savedIds(){try{return JSON.parse(localStorage.getItem('bna-saved')||'[]');}catch(e){return [];}}
function prof(){try{return JSON.parse(localStorage.getItem('bna-profile')||'{}');}catch(e){return {};}}
function matchState(e,v){if(!v)return true;var arr=e.sv||[];return arr.indexOf('ALL')>-1||arr.indexOf(v)>-1;}
function matchQual(e,qf){if(!qf)return true;var arr=e.q||[];return arr.length===0||arr.indexOf(qf)>-1;}
function apply(){
if(!IDX)return;
var term=low(st.q.trim());
var p=prof();
var ids=st.saved?savedIds():[];
var out=IDX.filter(function(e){
if(st.f==='__saved'){if(ids.indexOf(e.id)<0)return false;}
else if(st.f!=='all'&&e.c!==st.f)return false;
if(st.x==='closing'&&e.st!=='closing_soon')return false;
if(st.x==='open'&&e.st!=='open')return false;
if(!matchState(e,st.v))return false;
if(!matchQual(e,st.qf))return false;
if(p.v&&!matchState(e,p.v))return false;
if(p.q&&e.q&&e.q.length&&!matchQual(e,p.q))return false;
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
b.classList.add('on');st.f=b.getAttribute('data-f');st.saved=st.f==='__saved';apply();});
seg.addEventListener('click',function(ev){
var b=ev.target.closest('button');if(!b)return;
seg.querySelectorAll('button').forEach(function(c){c.classList.remove('on');});
b.classList.add('on');st.x=b.getAttribute('data-x');apply();});
sortSel.addEventListener('change',function(){st.s=sortSel.value;apply();});
if(stateSel){stateSel.addEventListener('change',function(){st.v=stateSel.value;apply();});}
if(qualSel){qualSel.addEventListener('change',function(){st.qf=qualSel.value;apply();});}
window.BNA_APP={reapply:function(){apply();}};
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

function dateGroupedCards(list) {
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let out = "";
  let last = "";
  for (const e of list) {
    const d = (e.first_seen || "").slice(0, 10);
    if (d !== last) {
      last = d;
      const label = d === today ? `<span data-i18n="strip_today">Today's updates</span>` : d === yest ? `<span data-i18n="strip_yest">Yesterday's updates</span>` : fmtDate(d);
      out += `<div class="date-sep">${label}</div>`;
    }
    out += cardHTML(e);
  }
  return out;
}

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
<span class="hero-pill">${strokeIcon("shield")}<span data-i18n="pill">Auto-verified daily &middot; 100% free</span></span>
<h1><span data-i18n="t1">Jobs, Scholarships, Exams, Yojanas</span><br><em data-i18n="t2">all in one place.</em></h1>
<p class="hero-sub" data-i18n="sub">Government opportunities collected and verified daily from official portals. No spam — straight information.</p>
<div class="search-wrap">${strokeIcon("search")}<input id="q" type="search" placeholder="Search: scholarship, SSC, vacancy..." data-i18n-ph="search_ph" autocomplete="off" aria-label="Search opportunities"><span class="search-kbd">/</span></div>
<div class="stats-row">
<div class="stat"><b data-n="${stats.total}">0</b><small data-i18n="st_total">Total tracked</small></div>
<div class="stat"><b data-n="${stats.open}">0</b><small data-i18n="st_open">Active now</small></div>
<div class="stat stat-warn"><b data-n="${stats.closing}">0</b><small data-i18n="st_closing">Closing soon</small></div>
</div>
<p class="hero-trust">${strokeIcon("zap")}<span data-i18n="trust">Data updated twice daily, every day</span></p>
</div></section>
<main class="wrap page-top">
<div class="sec-head"><h2 data-i18n="latest">Latest opportunities</h2><span id="resCount" class="res-count">${entries.length} opportunities</span></div>
<div class="toolbar">
<div class="chips" id="filters"><button class="chip on" data-f="all" data-i18n="f_all">All</button>${Object.entries(CAT_LABELS).map(([k, v]) => `<button class="chip" data-f="${k}" data-i18n="cat_${k}">${v.en}</button>`).join("")}<button class="chip saved-chip" id="savedChip" data-f="__saved"><span data-i18n="saved">Saved</span> (<span id="savedCount">0</span>)</button></div>
<div class="toolbar-right">
<button id="profileBtn" class="tbtn-wide" aria-label="Meri eligibility set karo">${strokeIcon("target")}<span>Meri Eligibility</span></button>
<div class="seg" id="seg"><button class="on" data-x="all" data-i18n="seg_all">All</button><button data-x="open" data-i18n="seg_open">Open</button><button data-x="closing" data-i18n="seg_closing">Closing</button></div>
<select id="stateSel" aria-label="State filter"><option value="" data-i18n="sel_state">All States</option>${STATES.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select>
<select id="qualSel" aria-label="Qualification filter"><option value="" data-i18n="sel_qual">All Qualifications</option><option value="8th Pass">8th Pass</option><option value="10th Pass">10th Pass</option><option value="12th Pass">12th Pass</option><option value="ITI">ITI</option><option value="Diploma">Diploma</option><option value="Graduate">Graduate</option><option value="B.Tech/BE">B.Tech/BE</option><option value="Post Graduate">Post Graduate</option></select>
<select id="sortSel" aria-label="Sort opportunities"><option value="new" data-i18n="sort_new">Newest first</option><option value="deadline" data-i18n="sort_dl">Deadline soonest</option></select>
</div></div>
<div id="profPanel" class="prof-panel" hidden>
<div><label for="profState" data-i18n="prof_state">State</label><select id="profState"><option value="" data-i18n="prof_any">Any</option><option value="ALL" data-i18n="prof_all_india">All India</option>${STATES.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select></div>
<div><label for="profEdu" data-i18n="prof_qual">Qualification</label><select id="profEdu"><option value="" data-i18n="prof_any">Any</option><option value="8th Pass">8th Pass</option><option value="10th Pass">10th Pass</option><option value="12th Pass">12th Pass</option><option value="ITI">ITI</option><option value="Diploma">Diploma</option><option value="Graduate">Graduate</option><option value="B.Tech/BE">B.Tech/BE</option><option value="Post Graduate">Post Graduate</option></select></div>
<div style="display:flex;gap:8px;align-self:end;flex-wrap:wrap">
<button id="profSave" class="btn btn-pri" data-i18n="prof_save">Save Profile</button>
<button id="profClear" class="btn btn-ghost" data-i18n="prof_clear">Clear</button>
<button id="profExport" class="btn btn-ghost">Export</button>
<button id="profImport" class="btn btn-ghost">Import</button>
</div>
<p class="prof-hint" data-i18n="prof_hint">Save your eligibility once — only jobs matching your profile stay highlighted on every visit.</p>
</div>
<div class="grid" id="list">${dateGroupedCards([...entries].sort((a, b) => (b.first_seen || "").localeCompare(a.first_seen || "")).slice(0, 60))}</div>
<div class="grid" id="skels" hidden>${SKEL_CARDS}</div>
<div class="empty" id="empty" hidden>${strokeIcon("search")}<p data-i18n="empty_list">Nothing found. Try another keyword or clear the filters.</p></div>
${note()}
</main>
${footerHTML("")}
<script>${RUNTIME_JS}</script>
<script>${APP_JS}</script>`;
  await writeFile("index.html", layout({
    title: "Bharat Naukri Alert — Sarkari Scholarships, Exams, Jobs & Schemes Tracker",
    desc: "Naukri, scholarship, exam aur sarkari yojana ke updates — rozana auto-collect aur verify. Deadline kabhi miss mat karo.",
    canonical: `${SITE_URL}/`,
    body: idxBody,
    jsonld: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Bharat Naukri Alert",
      description: "Verified daily updates of Indian government scholarships, exams, jobs and schemes",
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
${list.length ? `<div class="grid">${list.map((e) => cardHTML(e, "../")).join("")}</div>` : `<div class="empty">${strokeIcon("search")}<p data-i18n="empty_cat">Nothing here yet. Updates coming soon.</p></div>`}
${note()}
</main>
${footerHTML("../")}
<script>${RUNTIME_JS}</script>`;
    await writeFile(`category/${cat}.html`, layout({
      title: `${labels.en} `,
      desc: `Latest government ${labels.en.toLowerCase()} with deadlines, auto-updated daily.`,
      canonical: `${SITE_URL}/category/${cat}`,
      body,
    }));
    pages++;
  }

  // ---- state pages (SEO) ----
  const slug = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  for (const st of STATES) {
    const tagged = entries.filter((e) => {
      const arr = e.eligibility?.states || [];
      return arr.includes(st) || arr.includes("ALL");
    });
    if (!tagged.length) continue;
    const body = `${header("../")}
<main class="wrap page-top">
<nav class="crumb"><a href="../index.html">Home</a>${strokeIcon("chev")}<span>${st}</span></nav>
<h1 class="page-h">${st} Sarkari Jobs <span class="cnt-badge">${tagged.length}</span></h1>
<p class="page-sub">${st} government jobs &amp; updates <span data-i18n="sub_state">— updated twice daily, automatically.</span></p>
<div class="grid">${tagged.map((e) => cardHTML(e, "../")).join("")}</div>
${note()}
</main>
${footerHTML("../")}
<script>${RUNTIME_JS}</script>`;
    await writeFile(`state/${slug(st)}.html`, layout({
      title: `${st} Sarkari Naukri 2026 — Latest Govt Jobs & Updates`,
      desc: `${st} government job alerts: ${tagged.length} active opportunities with official links and deadlines. Rozana update hota hai.`,
      canonical: `${SITE_URL}/state/${slug(st)}`,
      body,
    }));
    pages++;
  }

  // ---- static pages ----
  const staticPages = {
    "about.html": {
      title: "About ",
      h: "About",
      html: `<p><b>Bharat Naukri Alert</b> ek chhoti team chalati hai. Har din subah aur shaam hum India ki badi sarkari websites khole hain — SSC, UPSC, IBPS, Railway, state PSCs, banks, universities — taaki aapko ek bhi opportunity miss na ho.</p>
<p>Naya notification aate hi usko padhte hain, verify karte hain, aur yahan simple language me publish kar dete hain. Har listing me <b>official government portal ka direct link</b> hota hai — koi beech ka agent nahi, koi misleading ad nahi.</p>
<h2>Hum kaise kaam karte hain?</h2>
<ul><li>Har notification sirf official portal se hi link hota hai</li><li>Last date, fee aur vacancy numbers source page se dobara cross-check kiye jaate hain</li><li>Jo cheez confirm nahi hoti, wo publish nahi hoti</li><li>Site rozana 2 baar update hoti hai — subah aur shaam</li></ul>
<p>Sab kuch bilkul <b>free</b> hai. Aapka time bachana hi hamara kaam hai.</p>
<h2>Contact</h2><p>Koi sawaal ya galat listing? Telegram channel par message karo — seedha team tak pahunchta hai.</p>`,
    },
    "privacy.html": {
      title: "Privacy Policy ",
      h: "Privacy Policy",
      html: `<p>Yeh website aapka koi personal data collect nahi karti. Sab features (saved jobs, eligibility profile, theme preference) <b>aapke browser ke localStorage</b> me hi rehte hain — server par kuch bhi upload nahi hota.</p>
<h2>Cookies/Tracking</h2><p>No tracking cookies. If analytics or ads are added in the future, this page will be updated.</p>
<h2>Third-party links</h2><p>Job listings link out to official government portals. Their privacy policies apply on those sites.</p>`,
    },
    "terms.html": {
      title: "Terms of Use ",
      h: "Terms of Use",
      html: `<p>Bharat Naukri Alert ek independent information service hai — Government of India ka official portal nahi hai.</p>
<h2>Accuracy</h2><p>Information is carefully checked against official portals before publishing, but always confirm details on the official website before applying. Deadlines and details may change.</p>
<h2>Liability</h2><p>We are not liable for decisions made solely based on content from this website. Use at your own discretion.</p>`,
    },
    "contact.html": {
      title: "Contact ",
      h: "Contact",
      html: `<p>Questions, suggestions or a wrong listing? Let us know:</p>
<ul><li>Message on the Telegram channel${SITE_CONFIG.telegramUrl ? `: <a href="${esc(SITE_CONFIG.telegramUrl)}" target="_blank" rel="noopener">${esc(SITE_CONFIG.telegramUrl)}</a>` : ""}</li>
${SITE_CONFIG.contactEmail ? `<li>Email: ${esc(SITE_CONFIG.contactEmail)}</li>` : ""}</ul>
<p>Feedback is welcome!</p>`,
    },
  };
  for (const [file, p] of Object.entries(staticPages)) {
    const body = `${header("")}
<main class="wrap"><div class="page-wrap">
<nav class="crumb"><a href="index.html">Home</a>${strokeIcon("chev")}<span>${p.h}</span></nav>
<h1>${p.h}</h1>
${p.html}
${note()}
</div></main>
${footerHTML("")}
<script>${RUNTIME_JS}</script>`;
    await writeFile(file, layout({ title: `${p.title}`, desc: `${p.h} `, canonical: `${SITE_URL}/${file.replace(/\.html$/, "")}`, body }));
    pages++;
  }

  // ---- quiz pages ----
  const quizDir = path.join(process.cwd(), "data", "quizzes");
  let quizFiles = [];
  try { quizFiles = (await fs.readdir(quizDir)).filter(f => f.endsWith(".json")); } catch {}
  const QUIZ_JS = `
(function(){
var qIdx=0,score=0,answered=false,data=null,timer=null,timeLeft=0,mode='practice';
var el=document.getElementById('quizBox');
if(!el)return;
function fmt(s){var m=Math.floor(s/60);return m+':'+(s%60<10?'0':'')+(s%60);}
function startTimer(){clearInterval(timer);timer=setInterval(function(){
timeLeft--;var tc=el.querySelector('.quiz-timer');if(tc)tc.textContent=fmt(timeLeft);
if(timeLeft<=0){clearInterval(timer);showResults();}
},1000);}
function showResults(){clearInterval(timer);var pct=data.questions.length?Math.round(score/data.questions.length*100):0;
var grade=pct>=80?'Excellent!':pct>=60?'Good Job!':pct>=40?'Keep Practicing!':'Needs Improvement';
el.innerHTML='<div class="quiz-final"><h3>Quiz Complete!</h3><p class="quiz-grade">'+grade+'</p><p class="quiz-final-score">Score: '+score+' / '+data.questions.length+' ('+pct+'%)</p>'+(mode==='mock'?'<p class="quiz-time-taken">Time: '+fmt(Math.round((data.questions.length*60)-timeLeft))+'</p>':'')+'<button class="btn btn-pri" id="qRestart">Try Again</button></div>';
var rb=el.querySelector('#qRestart');if(rb)rb.addEventListener('click',function(){startQuiz(mode);});}
function render(){
if(!data||!data.questions.length){el.innerHTML='<p>No questions available.</p>';return;}
var q=data.questions[qIdx];
var pct=Math.round((qIdx/data.questions.length)*100);
var h='<div class="quiz-hud"><span class="quiz-prog">'+(qIdx+1)+' / '+data.questions.length+'</span><span class="quiz-score">Score: '+score+'</span>'+(mode==='mock'?'<span class="quiz-timer">'+fmt(timeLeft)+'</span>':'')+'</div>';
h+='<div class="quiz-bar"><div class="quiz-fill" style="width:'+pct+'%"></div></div>';
h+='<div class="quiz-q" data-reveal>'+q.q+'</div>';
h+='<div class="quiz-opts">';
q.options.forEach(function(o,i){h+='<button class="quiz-opt" data-idx="'+i+'">'+o+'</button>';});
h+='</div>';
if(answered){
var correct=q.correct===parseInt(el.querySelector('.quiz-opt.active')?.dataset.idx);
h+='<div class="quiz-explain '+(correct?'q-correct':'q-wrong')+'">'+(correct?'✓ Correct!':'✗ Wrong!')+' '+q.explain+'</div>';
if(qIdx<data.questions.length-1){h+='<button class="btn btn-pri quiz-next" id="qNext">Next Question →</button>';}
else{showResults();return;}
}
el.innerHTML=h;
el.querySelectorAll('.quiz-opt').forEach(function(b){b.addEventListener('click',function(){
if(answered)return;answered=true;var idx=parseInt(b.dataset.idx);
if(idx===q.correct)score++;b.classList.add('active');render();});});
var nextBtn=el.querySelector('#qNext');
if(nextBtn)nextBtn.addEventListener('click',function(){qIdx++;answered=false;render();});
}
function startQuiz(m){clearInterval(timer);mode=m||'practice';qIdx=0;score=0;answered=false;
if(mode==='mock'){timeLeft=data.questions.length*60;startTimer();}
render();}
window.BNA_Quiz=function(d){data=d;qIdx=0;score=0;answered=false;
var sel=document.getElementById('quizSel');
if(sel){sel.innerHTML='<button class="btn btn-pri" data-mode="practice">Practice Mode</button> <button class="btn btn-ghost" data-mode="mock">Mock Test (Timed)</button>';
sel.querySelectorAll('[data-mode]').forEach(function(b){b.addEventListener('click',function(){startQuiz(b.dataset.mode);});});}
startQuiz('practice');};
})();
`;
  const quizStyle = `
.quiz-hud{display:flex;justify-content:space-between;margin-bottom:8px;font-weight:600}
.quiz-prog{color:var(--mut)}
.quiz-score{color:var(--pri)}
.quiz-bar{height:6px;background:var(--line);border-radius:3px;margin-bottom:20px;overflow:hidden}
.quiz-fill{height:100%;background:var(--pri);border-radius:3px;transition:width .3s}
.quiz-q{font-size:18px;font-weight:600;margin-bottom:16px;line-height:1.5}
.quiz-opts{display:grid;gap:10px}
.quiz-opt{padding:14px 18px;border:2px solid var(--line);border-radius:12px;background:var(--card);font-size:15px;text-align:left;cursor:pointer;transition:.15s;font-weight:500}
.quiz-opt:hover{border-color:var(--pri);background:var(--bg2)}
.quiz-opt.active{border-color:var(--pri);background:var(--pri);color:#fff}
.quiz-opt.active.q-correct{background:#059669;border-color:#059669}
.quiz-opt.active.q-wrong{background:#dc2626;border-color:#dc2626}
.quiz-explain{margin-top:16px;padding:14px;border-radius:12px;font-size:14px;line-height:1.5}
.q-correct{background:#d1fae5;color:#065f46}
.q-wrong{background:#fee2e2;color:#991b1b}
.quiz-next{margin-top:16px}
.quiz-final{text-align:center;margin-top:20px}
.quiz-final h3{margin-bottom:8px}
.quiz-final p{font-size:18px;margin-bottom:16px}
[data-theme=dark] .q-correct{background:#064e3b;color:#a7f3d0}
[data-theme=dark] .q-wrong{background:#7f1d1d;color:#fecaca}
`;
  for (const qf of quizFiles) {
    const qData = JSON.parse(await fs.readFile(path.join(quizDir, qf), "utf8"));
    const cat = qf.replace(".json", "");
    const quizBody = `${header("../")}
<main class="wrap page-top">
<nav class="crumb"><a href="../index.html">Home</a>${strokeIcon("chev")}<a href="../category/quiz.html">Quizzes</a>${strokeIcon("chev")}<span>${esc(qData.title)}</span></nav>
<h1 class="page-h">${esc(qData.title)}</h1>
<p class="page-sub">${esc(qData.titleHi)} — ${qData.questions.length} questions</p>
<div id="quizSel" class="quiz-sel"></div>
<div class="quiz-wrap" id="quizBox"></div>
${note()}
</main>
${footerHTML("../")}
<style>${quizStyle}
.quiz-sel{display:flex;gap:10px;margin-bottom:16px}
.quiz-timer{color:var(--pri);font-weight:700;font-family:var(--disp)}
.quiz-grade{font-size:22px;font-weight:700;margin-bottom:8px}
.quiz-final-score{font-size:18px;margin-bottom:8px}
.quiz-time-taken{color:var(--mut);margin-bottom:12px}
.quiz-final{text-align:center;padding:30px 20px}
.quiz-final h3{font-size:24px;margin-bottom:12px}
</style>
<script>${RUNTIME_JS}</script>
<script>BNA_Quiz(${JSON.stringify(qData)});</script>`;
    await writeFile(`quiz/${cat}.html`, layout({
      title: `${qData.title} Quiz — Bharat Naukri Alert`,
      desc: `Practice ${qData.questions.length} ${qData.title} questions for government exam preparation.`,
      canonical: `${SITE_URL}/quiz/${cat}`,
      body: quizBody,
    }));
    pages++;
  }
  // quiz index page
  if (quizFiles.length) {
    const quizIndexCards = [];
    for (const qf of quizFiles) {
      const qData = JSON.parse(await fs.readFile(path.join(quizDir, qf), "utf8"));
      const cat = qf.replace(".json", "");
      quizIndexCards.push(`<article class="op-card" data-reveal><a class="stretch" href="quiz/${cat}.html"></a><div class="op-top"><span class="avatar" style="--h:0"><svg class="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/></svg></span><span class="op-org">Quiz</span></div><h3 class="op-t">${esc(qData.title)}</h3><p class="op-s">${qData.questions.length} questions — ${esc(qData.titleHi)}</p></article>`);
    }
    const quizIndexBody = `${header("")}
<main class="wrap page-top">
<nav class="crumb"><a href="index.html">Home</a>${strokeIcon("chev")}<span>Quizzes</span></nav>
<h1 class="page-h">Quizzes <span class="cnt-badge">${quizFiles.length}</span></h1>
<p class="page-sub">Government exam practice questions — SSC, Railway, GK</p>
<div class="grid">${quizIndexCards.join("")}</div>
${note()}
</main>
${footerHTML("")}
<script>${RUNTIME_JS}</script>`;
    await writeFile("quiz/index.html", layout({
      title: "Quizzes — Bharat Naukri Alert",
      desc: "Practice government exam MCQs — SSC, Railway, GK quizzes for free.",
      canonical: `${SITE_URL}/quiz`,
      body: quizIndexBody,
    }));
    pages++;
  }

  // ---- detail pages ----
  // ---- syllabus pages ----
  const syllabusDir = path.join(process.cwd(), "data", "syllabus");
  let syllabusFiles = [];
  try { syllabusFiles = (await fs.readdir(syllabusDir)).filter(f => f.endsWith(".json")); } catch {}
  for (const sf of syllabusFiles) {
    const sData = JSON.parse(await fs.readFile(path.join(syllabusDir, sf), "utf8"));
    const slug = sf.replace(".json", "");
    let syllabusHtml = "";
    if (sData.pattern) {
      syllabusHtml += `<section class="d-sec" data-reveal><h3>Exam Pattern</h3>`;
      for (const tier of sData.pattern) {
        syllabusHtml += `<div class="syl-tier"><h4>${esc(tier.tier)}</h4><p><b>Marks:</b> ${tier.marks} | <b>Time:</b> ${esc(tier.time)} | <b>Questions:</b> ${tier.questions}</p><ul>${tier.subjects.map(s => `<li>${esc(s)}</li>`).join("")}</ul></div>`;
      }
      syllabusHtml += `</section>`;
    }
    if (sData.syllabus) {
      syllabusHtml += `<section class="d-sec" data-reveal><h3>Detailed Syllabus</h3>`;
      for (const [subj, topics] of Object.entries(sData.syllabus)) {
        syllabusHtml += `<div class="syl-subj"><h4>${esc(subj)}</h4><ul>${topics.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>`;
      }
      syllabusHtml += `</section>`;
    }
    if (sData.resources?.length) {
      syllabusHtml += `<section class="d-sec" data-reveal><h3>Free Resources</h3><div class="syl-res">${sData.resources.map(r => `<a class="btn btn-ghost" href="${esc(r.url || '#')}" target="_blank" rel="nofollow noopener">${strokeIcon("ext")}${esc(r.name)} <small>(${esc(r.type)})</small></a>`).join("")}</div></section>`;
    }
    if (sData.officialWebsite) {
      syllabusHtml += `<section class="d-sec" data-reveal><h3>Official Website</h3><a class="btn btn-pri" href="${esc(sData.officialWebsite)}" target="_blank" rel="nofollow noopener">${strokeIcon("ext")}Visit Official Site</a></section>`;
    }
    const syllabusBody = `${header("../")}
<main class="wrap page-top">
<nav class="crumb"><a href="../index.html">Home</a>${strokeIcon("chev")}<a href="../syllabus/index.html">Syllabus</a>${strokeIcon("chev")}<span>${esc(sData.title)}</span></nav>
<div class="d-head">
<div class="d-meta"><span class="cat-chip cc-exam">Syllabus</span></div>
<h1>${esc(sData.fullName || sData.title)}</h1>
<p class="page-sub">${esc(sData.titleHi)}</p>
</div>
<p class="d-sum" data-reveal>${esc(sData.overview)}</p>
${syllabusHtml}
${note()}
</main>
${footerHTML("../")}
<script>${RUNTIME_JS}</script>`;
    await writeFile(`syllabus/${slug}.html`, layout({
      title: `${sData.title} Syllabus — Bharat Naukri Alert`,
      desc: `${sData.fullName} exam pattern, detailed syllabus and free preparation resources.`,
      canonical: `${SITE_URL}/syllabus/${slug}`,
      body: syllabusBody,
    }));
    pages++;
  }
  // syllabus index page
  if (syllabusFiles.length) {
    const syllabusCards = [];
    for (const sf of syllabusFiles) {
      const sData = JSON.parse(await fs.readFile(path.join(syllabusDir, sf), "utf8"));
      const slug = sf.replace(".json", "");
      const tierText = sData.pattern ? sData.pattern.map(t => t.tier).join(" → ") : "";
      syllabusCards.push(`<article class="op-card" data-reveal><a class="stretch" href="syllabus/${slug}.html"></a><div class="op-top"><span class="avatar" style="--h:200"><svg class="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9.5 12 4.5l10 5-10 5z"/><path d="M6 11.8V16c0 1.5 2.7 2.8 6 2.8s6-1.3 6-2.8v-4.2"/><path d="M22 9.5V15"/></svg></span><span class="op-org">Syllabus</span></div><h3 class="op-t">${esc(sData.title)}</h3><p class="op-s">${esc(sData.fullName)}</p><div class="op-foot"><span class="cat-chip cc-exam">${tierText}</span></div></article>`);
    }
    const syllabusIndexBody = `${header("")}
<main class="wrap page-top">
<nav class="crumb"><a href="index.html">Home</a>${strokeIcon("chev")}<span>Syllabus</span></nav>
<h1 class="page-h">Exam Syllabus & Pattern <span class="cnt-badge">${syllabusFiles.length}</span></h1>
<p class="page-sub">Detailed exam patterns, syllabus breakdown and free preparation resources.</p>
<div class="grid">${syllabusCards.join("")}</div>
${note()}
</main>
${footerHTML("")}
<script>${RUNTIME_JS}</script>`;
    await writeFile("syllabus/index.html", layout({
      title: "Exam Syllabus & Pattern — Bharat Naukri Alert",
      desc: "SSC CGL, RRB NTPC, UPSC CSE exam patterns, detailed syllabus and free preparation resources.",
      canonical: `${SITE_URL}/syllabus`,
      body: syllabusIndexBody,
    }));
    pages++;
  }

  // ---- detail pages ----
  for (const e of entries) {
    const related = entries.filter((x) => x.category === e.category && x.id !== e.id).slice(0, 3);
    const detailDesc = e.editor_note || e.summary || `${e.title} by ${e.org}. Check deadline and apply.`;
    const detailJsonDesc = e.editor_note || e.details?.summary || e.summary || `${e.title} — ${e.org}. Official notification, eligibility aur last date check karke apply karo.`;
    await writeFile(`o/${encodeURIComponent(e.id)}.html`, layout({
      title: `${e.title.slice(0, 60)} — Last date ${e.deadline ? fmtDate(e.deadline) : "to be announced"}`,
      desc: detailDesc.slice(0, 155),
      canonical: `${SITE_URL}/o/${encodeURIComponent(e.id)}`,
      body: detailBody(e, related, entries),
      jsonld: JSON.stringify([
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          title: e.title.slice(0, 110),
          description: detailJsonDesc.slice(0, 1200),
          datePosted: e.first_seen,
          validThrough: e.deadline ? `${e.deadline}T23:59:59+05:30` : undefined,
          employmentType: "FULL_TIME",
          hiringOrganization: { "@type": "Organization", name: e.org || "Government of India" },
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: { "@type": "Country", name: "India" },
          directApply: true,
          url: `${SITE_URL}/o/${encodeURIComponent(e.id)}`,
          baseSalary: e.details?.payScale ? { "@type": "MonetaryAmount", value: { "@type": "QuantitativeValue", value: e.details.payScale } } : undefined,
          qualifications: e.eligibility?.education?.length ? e.eligibility.education.join(", ") : undefined,
          eligibleRegion: (e.eligibility?.states || []).includes("ALL") ? "India" : e.eligibility?.states?.join(", "),
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: (CAT_LABELS[e.category] || { en: e.category }).en, item: `${SITE_URL}/category/${e.category}` },
            { "@type": "ListItem", position: 3, name: e.title.slice(0, 80) },
          ],
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Who can apply for this opportunity?",
              acceptedAnswer: {
                "@type": "Answer",
                text: e.eligibility?.education?.length ? `Eligibility: ${e.eligibility.education.join(", ")}. ${e.eligibility?.states?.includes("ALL") ? "Open to all India candidates." : `Open to candidates from: ${(e.eligibility?.states || []).join(", ")}.`}` : "Check the official notification for detailed eligibility criteria."
              }
            },
            {
              "@type": "Question",
              name: "What is the last date to apply?",
              acceptedAnswer: {
                "@type": "Answer",
                text: e.deadline ? `The last date to apply is ${fmtDate(e.deadline)}.` : "The last date has not been announced yet. Keep checking for updates."
              }
            },
            {
              "@type": "Question",
              name: "How to apply?",
              acceptedAnswer: {
                "@type": "Answer",
                text: e.details?.steps?.length ? `Steps to apply: ${e.details.steps.slice(0, 3).join(" → ")}. Visit the official portal for complete instructions.` : "Visit the official portal linked on this page to complete the application process."
              }
            },
            ...(e.details?.fee?.length ? [{
              "@type": "Question",
              name: "What is the application fee?",
              acceptedAnswer: {
                "@type": "Answer",
                text: `Application fee: ${e.details.fee.map(f => `${f.k}: ₹${f.v}`).join(", ")}.`
              }
            }] : [])
          ]
        },
        ...(e.details?.steps?.length ? [{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: `How to apply for ${e.title.slice(0, 60)}`,
          step: e.details.steps.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: `Step ${i + 1}`,
            text: s
          }))
        }] : []),
      ]),
    }));
    pages++;
  }

  // ---- search index ----
  const searchIndex = entries.map((e) => ({
    id: e.id,
    t: e.title,
    o: e.org,
    c: e.category,
    d: e.deadline,
    s: (e.summary || "").slice(0, 140),
    a: e.amount || "",
    st: e.status,
    sv: e.eligibility?.states || ["ALL"],
    q: e.eligibility?.education || [],
    f: e.first_seen,
    h: cardHTML(e),
  }));
  await writeFile("search-index.json", JSON.stringify(searchIndex));

  // ---- RSS feed ----
  const esc2 = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rssItems = [...entries]
    .sort((a, b) => (b.first_seen || "").localeCompare(a.first_seen || ""))
    .slice(0, 50)
    .map(
      (e) => `\t<item>
\t\t<title>${esc2(e.title)}</title>
\t\t<link>${SITE_URL}/o/${encodeURIComponent(e.id)}.html</link>
\t\t<guid isPermaLink="true">${SITE_URL}/o/${encodeURIComponent(e.id)}.html</guid>
\t\t<pubDate>${new Date(e.first_seen || Date.now()).toUTCString()}</pubDate>
\t\t<description>${esc2((e.summary || e.title).slice(0, 300))}</description>
\t\t<category>${esc2(e.category)}</category>
\t</item>`
    )
    .join("\n");
  await writeFile("rss.xml", `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Bharat Naukri Alert — Latest Sarkari Updates</title>
<link>${SITE_URL}</link>
<description>Scholarships, exams, jobs aur sarkari schemes ke rozana updates with official links.</description>
<language>en-in</language>
${rssItems}
</channel></rss>`);

  // ---- sitemap / robots / llms.txt ----
  const stateUrls = [];
  for (const st of STATES) {
    const has = entries.some((e) => {
      const arr = e.eligibility?.states || [];
      return arr.includes(st) || arr.includes("ALL");
    });
    if (has) stateUrls.push(`state/${slug(st)}.html`);
  }
  const urls = [
    "",
    ...Object.keys(CAT_LABELS).map((c) => `category/${c}`),
    ...stateUrls.map((u) => u.replace(/\.html$/, "")),
    "about",
    "privacy",
    "terms",
    "contact",
    ...entries.map((e) => `o/${encodeURIComponent(e.id)}`),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `\t<url><loc>${SITE_URL}/${u}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>`).join("\n")}
</urlset>`;
  await writeFile("sitemap.xml", sitemap);
  await writeFile("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml`);

  let redirects = {};
  try {
    redirects = JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "redirects.json"), "utf8"));
  } catch {}
  const writtenDetails = new Set(entries.map((e) => `o/${e.id}.html`));
  const redLines = Object.entries(redirects)
    .filter(([o]) => !o.endsWith(".html"))
    .filter(([, n]) => writtenDetails.has(`o/${n}.html`))
    .map(([o, n]) => `/o/${o} /o/${n}.html 301`)
    .join("\n");
  let staticRewrites = "";
  try {
    staticRewrites = (await fs.readdir(path.join(process.cwd(), "site", "static")))
      .filter((f) => f.endsWith(".html"))
      .map((f) => `/${f} /${f} 200`)
      .join("\n");
  } catch {}
  const out = [redLines, staticRewrites].filter(Boolean).join("\n");
  if (out) await writeFile("_redirects", `${out}\n`);

  const staticDir = path.join(process.cwd(), "site", "static");
  try {
    for (const f of await fs.readdir(staticDir)) {
      await fs.copyFile(path.join(staticDir, f), path.join(DIST(), f));
    }
  } catch {}

  return { pages: pages + 3, entries: entries.length, stats };
}

if (process.argv[1] && process.argv[1].endsWith("build.js")) {
  console.log(JSON.stringify(await buildSite(), null, 2));
}
