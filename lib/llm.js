import { fetchText } from "./http.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GEMINI_URL = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// Keys per provider: PROVIDER_API_KEY (single) + PROVIDER_API_KEY_1..10 (pool).
// e.g. GEMINI_API_KEY_1 ... GEMINI_API_KEY_5 -> 5-key rotation pool for Gemini.
export function providerKeys(name) {
  const prefix = `${String(name).toUpperCase()}_API_KEY`;
  const keys = [process.env[prefix]];
  for (let i = 1; i <= 10; i++) keys.push(process.env[`${prefix}_${i}`]);
  return [...new Set(keys.filter(Boolean))];
}

export function providerStatus() {
  const counts = Object.fromEntries(
    ["gemini", "groq", "openrouter"].map((p) => [p, providerKeys(p).length])
  );
  return {
    gemini: counts.gemini > 0,
    groq: counts.groq > 0,
    openrouter: counts.openrouter > 0,
    any: counts.gemini + counts.groq + counts.openrouter > 0,
    counts,
  };
}

// Round-robin cursor per provider — har call agli key pe jaati hai.
const rrIndex = new Map();

async function withKeyPool(name, callFn, messages) {
  const keys = providerKeys(name);
  if (!keys.length) throw new Error(`${name}: no api key`);
  const errors = [];
  const start = rrIndex.get(name) || 0;
  for (let i = 0; i < keys.length; i++) {
    const idx = (start + i) % keys.length;
    try {
      const out = await callFn(messages, keys[idx]);
      rrIndex.set(name, (idx + 1) % keys.length);
      return out;
    } catch (err) {
      errors.push(`${name}[key#${idx + 1}] ${err.message}`);
    }
  }
  throw new Error(errors.join(" | "));
}

async function callGroq(messages, key) {
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const body = {
    model,
    messages,
    temperature: 0.1,
    max_tokens: 1200,
    response_format: { type: "json_object" },
  };
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json.choices[0].message.content;
}

async function callGemini(messages, key) {
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const system = messages.find((m) => m.role === "system")?.content || "";
  const user = messages.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");
  const res = await fetch(`${GEMINI_URL(model)}?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1200, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json.candidates[0].content.parts[0].text;
}

async function callOpenRouter(messages, key) {
  const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 1200 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json.choices[0].message.content;
}

export async function chatJSON(systemPrompt, userPrompt) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
  // Chain: Gemini primary (5-key pool), Groq fallback, OpenRouter last resort.
  const chain = [];
  if (providerKeys("gemini").length) chain.push(["gemini", callGemini]);
  if (providerKeys("groq").length) chain.push(["groq", callGroq]);
  if (providerKeys("openrouter").length) chain.push(["openrouter", callOpenRouter]);

  const errors = [];
  for (const [name, fn] of chain) {
    try {
      const raw = await withKeyPool(name, fn, messages);
      return { text: raw, provider: name };
    } catch (err) {
      errors.push(err.message);
    }
  }
  throw new Error(`all providers failed -> ${errors.join(" | ")}`);
}

export function parseJSONSafe(text) {
  try {
    return JSON.parse(text);
  } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {}
  }
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) {
    try {
      return JSON.parse(brace[0]);
    } catch {}
  }
  return null;
}
