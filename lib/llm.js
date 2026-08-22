import { fetchText } from "./http.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GEMINI_URL = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export function providerStatus() {
  return {
    groq: Boolean(process.env.GROQ_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    any: Boolean(
      process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY
    ),
  };
}

async function callGroq(messages) {
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
      authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`groq HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json.choices[0].message.content;
}

async function callGemini(messages) {
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const system = messages.find((m) => m.role === "system")?.content || "";
  const user = messages.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");
  const res = await fetch(`${GEMINI_URL(model)}?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1200, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json.candidates[0].content.parts[0].text;
}

async function callOpenRouter(messages) {
  const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 1200 }),
  });
  if (!res.ok) throw new Error(`openrouter HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json.choices[0].message.content;
}

export async function chatJSON(systemPrompt, userPrompt) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
  const chain = [];
  if (process.env.GROQ_API_KEY) chain.push(["groq", callGroq]);
  if (process.env.GEMINI_API_KEY) chain.push(["gemini", callGemini]);
  if (process.env.OPENROUTER_API_KEY) chain.push(["openrouter", callOpenRouter]);

  const errors = [];
  for (const [name, fn] of chain) {
    try {
      const raw = await fn(messages);
      return { text: raw, provider: name };
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
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
