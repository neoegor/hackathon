// Service worker: the only part of the extension that talks to the backend.
// The content script sends it a "lookup" message; it POSTs JSON to the API
// and returns the (validated) JSON back. See API.md for the contract.

import { CONFIG } from "./config.js";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "lookup") return;
  lookup(msg)
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false, reason: "network" }));
  return true; // keep the channel open for the async response
});

async function lookup({ mode, text, context, page }) {
  if (CONFIG.USE_MOCK) return mockLookup(mode, text);

  const endpoint = mode === "define" ? CONFIG.ENDPOINTS.define : CONFIG.ENDPOINTS.explain;

  const body = { text };
  if (CONFIG.SEND_PAGE_CONTEXT) {
    if (context) body.context = context;
    if (page) body.page = page;
  }

  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (CONFIG.AUTH_TOKEN) headers.Authorization = "Bearer " + CONFIG.AUTH_TOKEN;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

  try {
    const res = await fetch(CONFIG.API_BASE_URL + endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (res.status === 404) return { ok: false, reason: "none" };
    if (!res.ok) return { ok: false, reason: "server" };

    const data = await res.json();
    if (data.ok === false) {
      return { ok: false, reason: data.error === "not_found" ? "none" : "server" };
    }
    if (!isValid(mode, data)) return { ok: false, reason: "server" };
    return { ...data, ok: true };
  } catch {
    return { ok: false, reason: "network" }; // offline, timeout, bad JSON, etc.
  } finally {
    clearTimeout(timer);
  }
}

// Reject responses that don't match API.md so the UI never renders garbage.
function isValid(mode, data) {
  if (mode === "define") {
    return (
      Array.isArray(data.meanings) &&
      data.meanings.every((m) => Array.isArray(m.definitions))
    );
  }
  return typeof data.explanation === "string" && data.explanation.length > 0;
}

// Fake responses for building the UI before the backend is ready.
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
