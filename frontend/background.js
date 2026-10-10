

import { CONFIG } from "./config.js";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "lookup") return;
  lookup(msg)
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false, reason: "network" }));
  return true; 
});

async function lookup({ mode, text }) {
  if (CONFIG.USE_MOCK) return mockLookup(mode, text);

  const headers = { "Content-Type": "application/json", Accept: "application/json" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

  try {
    const res = await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: mode, text }),
      signal: controller.signal,
    });

    if (!res.ok) return { ok: false, reason: "server" };

    const data = await res.json();
    if (!data.success || typeof data.result !== "string" || !data.result.trim()) {
      return { ok: false, reason: "server" };
    }

    if (mode === "define") {
      return {
        ok: true,
        meanings: [{ definitions: [{ definition: data.result.trim() }] }],
        source: "Gemma 3",
      };
    }

    return { ok: true, explanation: data.result.trim(), source: "Gemma 3" };
  } catch {
    return { ok: false, reason: "network" }; 
  } finally {
    clearTimeout(timer);
  }
}


async function mockLookup(mode, text) {
  await new Promise((r) => setTimeout(r, 400));
  if (mode === "define") {
    return {
      ok: true,
      term: text,
      phonetic: "/ˈmɒk/",
      meanings: [
        {
          partOfSpeech: "noun",
          definitions: [
            { definition: "A sample definition returned by the mock backend.", example: "This is an example sentence." },
            { definition: "A second sample definition." },
          ],
        },
        { partOfSpeech: "verb", definitions: [{ definition: "To imitate or simulate something." }] },
      ],
      source: "Mock data",
    };
  }
  return {
    ok: true,
    title: text,
    description: "Mock explanation",
    explanation:
      "This is placeholder text from the mock backend.\n\nSet USE_MOCK to false in config.js to call the real API.",
    url: "https://example.com",
    source: "Mock data",
  };
}
