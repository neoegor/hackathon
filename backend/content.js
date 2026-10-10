(() => {
  if (window.__markDefineLoaded) return;
  window.__markDefineLoaded = true;

  const MAX_LEN = 300;
  const cache = new Map();
  let state = null; // { text, range, markId, anchor: {left, top, bottom, width} (page coords) }
  let mode = "define";
  let requestId = 0;

  /* ---------- UI shell (shadow DOM keeps page styles out) ---------- */

  const STYLES = `
    :host {
      all: initial;
      /* Change fonts here. Only fonts installed on the user's computer will show. */
      --font-display: Helvetica, "Helvetica Neue", Arial, sans-serif;
      --font-ui: Helvetica, "Helvetica Neue", Arial, sans-serif;
    }
    * { box-sizing: border-box; font-family: var(--font-ui); }
    [hidden] { display: none !important; }

    .bar {
      position: absolute; display: flex; padding: 3px; gap: 1px;
      background: #16202e; border-radius: 8px;
      box-shadow: 0 4px 16px rgba(10, 20, 40, .3);
    }
    .bar button {
      all: unset; cursor: pointer; display: flex; align-items: center; gap: 7px;
      padding: 8px 11px; border-radius: 5px;
      color: #f2f5fa; font: 13px/1 var(--font-ui);
    }
    .bar button:hover { background: #2a3a52; }
    .bar button:focus-visible { outline: 2px solid #ffd84d; outline-offset: -2px; }
    .swatch { width: 10px; height: 10px; border-radius: 2px; background: #ffd84d; }

    .panel {
      position: absolute; width: 340px; max-width: calc(100vw - 16px);
      background: #fbfbfd; color: #16202e;
      border: 1px solid #d3d9e3; border-radius: 10px;
      box-shadow: 0 10px 30px rgba(10, 20, 40, .22);
      overflow: hidden;
    }
    .head { display: flex; align-items: flex-start; gap: 8px; padding: 14px 14px 0 16px; }
    .term {
      flex: 1; margin: 0; font: 600 22px/1.2 var(--font-display);
      overflow-wrap: anywhere;
    }
    .close {
      all: unset; cursor: pointer; width: 26px; height: 26px; border-radius: 6px;
      display: grid; place-items: center; color: #5b6778; font-size: 18px; line-height: 1;
    }
    .close:hover { background: #e9edf4; }
    .close:focus-visible, .tab:focus-visible, .link:focus-visible { outline: 2px solid #1b6b7a; outline-offset: 2px; }

    .tabs { display: flex; gap: 18px; padding: 10px 16px 0; border-bottom: 1px solid #e1e6ee; }
    .tab {
      all: unset; cursor: pointer; padding: 6px 0 8px; font: 500 13px/1 var(--font-ui);
      color: #5b6778; border-bottom: 2px solid transparent; margin-bottom: -1px;
    }
    .tab[aria-selected="true"] { color: #16202e; border-bottom-color: #1b6b7a; }

    .body { padding: 14px 16px 6px; max-height: 380px; overflow-y: auto; font-size: 14px; line-height: 1.55; }
    .phonetic { margin: 0 0 10px; color: #5b6778; font-size: 13px; }
    .pos { margin: 12px 0 4px; font: italic 600 14px/1.3 var(--font-display); color: #1b6b7a; }
    .pos:first-child { margin-top: 0; }
    .defs { margin: 0; padding-left: 18px; }
    .defs li { margin: 0 0 6px; }
    .example { display: block; margin-top: 2px; color: #5b6778; font-style: italic; }
    .desc { margin: 0 0 8px; color: #5b6778; font-size: 13px; }
    .extract { margin: 0 0 10px; }
    .status { margin: 0; color: #5b6778; }
    .hint { margin: 6px 0 0; color: #5b6778; font-size: 13px; }

    .foot {
      display: flex; justify-content: space-between; gap: 12px;
      padding: 8px 16px 12px; font-size: 12px; color: #6b7686;
    }
    .link { color: #1b6b7a; text-decoration: underline; }
  `;

  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:absolute;top:0;left:0;z-index:2147483647;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>${STYLES}</style>
    <div class="bar" role="toolbar" aria-label="Selection tools" hidden>
      <button type="button" data-act="highlight"><span class="swatch"></span><span class="hl-label">Highlight</span></button>
      <button type="button" data-act="define">Define</button>
      <button type="button" data-act="explain">Explain</button>
    </div>
    <section class="panel" role="dialog" aria-label="Lookup" hidden>
      <div class="head">
        <h2 class="term"></h2>
        <button type="button" class="close" aria-label="Close">×</button>
      </div>
      <div class="tabs" role="tablist">
        <button type="button" class="tab" role="tab" data-mode="define">Define</button>
        <button type="button" class="tab" role="tab" data-mode="explain">Explain</button>
      </div>
      <div class="body" aria-live="polite"></div>
      <div class="foot"><span class="source"></span><a class="link" target="_blank" rel="noopener noreferrer" hidden>Read more</a></div>
    </section>`;
  document.documentElement.appendChild(host);

  const bar = root.querySelector(".bar");
  const hlLabel = root.querySelector(".hl-label");
  const panel = root.querySelector(".panel");
  const termEl = root.querySelector(".term");
  const bodyEl = root.querySelector(".body");
  const sourceEl = root.querySelector(".source");
  const linkEl = root.querySelector(".link");
  const tabs = [...root.querySelectorAll(".tab")];

  /* ---------- helpers ---------- */

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function toPageRect(r) {
    return {
      left: r.left + window.scrollX,
      top: r.top + window.scrollY,
      bottom: r.bottom + window.scrollY,
      width: r.width,
    };
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(n, max));
  }

  function hideAll() {
    bar.hidden = true;
    panel.hidden = true;
    requestId++; // drop any in-flight lookup
  }

  // "word", "phrase" or "sentence": lets the backend decide how much to say.
  function classify(text) {
    const words = text.split(/\s+/).length;
    if (words === 1) return "word";
    if (words <= 4 && !/[.!?;:]/.test(text)) return "phrase";
    return "sentence";
  }

  // Surrounding paragraph, sent to the backend as optional context.
  function getContext(node) {
    const startEl = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const block = startEl && startEl.closest("p, li, blockquote, td, h1, h2, h3, h4, h5, h6, div");
    const text = block ? block.textContent.replace(/\s+/g, " ").trim() : "";
    return text.slice(0, 600);
  }

  /* ---------- toolbar ---------- */

  function showBar() {
    panel.hidden = true;
    hlLabel.textContent = state.markId ? "Remove" : "Highlight";
    bar.hidden = false;

    const a = state.anchor;
    const w = bar.offsetWidth;
    const h = bar.offsetHeight;
    const minX = window.scrollX + 6;
    const maxX = window.scrollX + document.documentElement.clientWidth - w - 6;
    const left = clamp(a.left + a.width / 2 - w / 2, minX, Math.max(minX, maxX));
    let top = a.top - h - 8;
    if (top < window.scrollY + 4) top = a.bottom + 8; // not enough room above
    bar.style.left = left + "px";
    bar.style.top = top + "px";
  }

  bar.addEventListener("mousedown", (e) => e.preventDefault()); // keep the page selection alive

  bar.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn || !state) return;
    const act = btn.dataset.act;

    if (act === "highlight") {
      if (state.markId) removeHighlight(state.markId);
      else highlightRange(state.range, "dh" + Date.now().toString(36));
      window.getSelection().removeAllRanges();
      hideAll();
    } else {
      openPanel(act);
    }
  });

  /* ---------- highlighting ---------- */

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"]);

  function highlightRange(range, id) {
    const container =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentNode
        : range.commonAncestorContainer;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(node.parentNode.tagName)) return NodeFilter.FILTER_REJECT;
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.length;
      if (start >= end) continue;

      let target = node;
      if (end < target.length) target.splitText(end);
      if (start > 0) target = target.splitText(start);

      const mark = document.createElement("mark");
      mark.className = "dh-mark";
      mark.dataset.dhId = id;
      target.parentNode.insertBefore(mark, target);
      mark.appendChild(target);
    }
  }

  function marksFor(id) {
    return [...document.querySelectorAll("mark.dh-mark")].filter((m) => m.dataset.dhId === id);
  }

  function removeHighlight(id) {
    for (const mark of marksFor(id)) {
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    }
  }

  /* ---------- panel + lookups ---------- */

  function openPanel(nextMode) {
    mode = nextMode;
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.mode === mode)));

    termEl.textContent = state.text;
    bar.hidden = true;
    panel.hidden = false;

    const a = state.anchor;
    const w = panel.offsetWidth;
    const minX = window.scrollX + 8;
    const maxX = window.scrollX + document.documentElement.clientWidth - w - 8;
    panel.style.left = clamp(a.left, minX, Math.max(minX, maxX)) + "px";
    panel.style.top = a.bottom + 10 + "px";

    runLookup();
  }

  async function runLookup() {
    const token = ++requestId;
    const text = state.text;
    const key = mode + ":" + text.toLowerCase();

    sourceEl.textContent = "";
    linkEl.hidden = true;
    bodyEl.replaceChildren(el("p", "status", "Looking up…"));

    let data = cache.get(key);
    if (!data) {
      try {
        data = await chrome.runtime.sendMessage({
          type: "lookup",
          mode,
          text,
          kind: classify(text),
          context: state.context,
          page: { url: location.href, title: document.title },
        });
      } catch {
        data = { ok: false, reason: "network" };
      }
      if (data && data.ok) cache.set(key, data); // don't cache failures
    }
    if (token !== requestId) return; // a newer lookup replaced this one

    render(data || { ok: false, reason: "network" }, text);
  }

  function render(data, text) {
    bodyEl.replaceChildren();

    if (!data.ok) {
      if (data.reason === "none") {
        bodyEl.append(el("p", "status", `No ${mode === "define" ? "definition" : "explanation"} found for “${text}”.`));
        bodyEl.append(
          el("p", "hint", mode === "define" ? "Try Explain for phrases and topics." : "Try selecting a shorter or more specific term.")
        );
      } else if (data.reason === "server") {
        bodyEl.append(el("p", "status", "The lookup service returned an error. Try again in a moment."));
      } else {
        bodyEl.append(el("p", "status", "Couldn’t reach the lookup service. Check your connection and select the text again."));
      }
      return;
    }

    sourceEl.textContent = data.source || "";

    if (mode === "define") {
      if (data.phonetic) bodyEl.append(el("p", "phonetic", data.phonetic));
      for (const m of data.meanings) {
        if (m.partOfSpeech) bodyEl.append(el("p", "pos", m.partOfSpeech));
        const list = el("ol", "defs");
        for (const d of m.definitions) {
          const li = el("li", null, d.definition);
          if (d.example) li.append(el("span", "example", `“${d.example}”`));
          list.append(li);
        }
        bodyEl.append(list);
      }
    } else {
      if (data.title && data.title.toLowerCase() !== text.toLowerCase()) {
        bodyEl.append(el("p", "pos", data.title));
      }
      if (data.description) bodyEl.append(el("p", "desc", data.description));
      for (const para of data.explanation.split(/\n{2,}/)) {
        if (para.trim()) bodyEl.append(el("p", "extract", para.trim()));
      }
      if (data.url) {
        linkEl.href = data.url;
        linkEl.hidden = false;
      }
    }
  }

  tabs.forEach((t) =>
    t.addEventListener("click", () => {
      mode = t.dataset.mode;
      openPanel(mode);
    })
  );
  root.querySelector(".close").addEventListener("click", hideAll);

  /* ---------- page events ---------- */

  document.addEventListener("mouseup", (e) => {
    if (e.composedPath().includes(host)) return;

    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().replace(/\s+/g, " ").trim() : "";

      if (text && text.length <= MAX_LEN && sel.rangeCount) {
        const range = sel.getRangeAt(0).cloneRange();
        state = {
          text,
          range,
          markId: null,
          context: getContext(range.commonAncestorContainer),
          anchor: toPageRect(range.getBoundingClientRect()),
        };
        showBar();
        return;
      }

      // Clicking an existing highlight offers Define / Explain / Remove for it.
      const mark = e.target.closest && e.target.closest("mark.dh-mark");
      if (mark) {
        const id = mark.dataset.dhId;
        const group = marksFor(id);
        const label = group.map((m) => m.textContent).join(" ").replace(/\s+/g, " ").trim();
        state = {
          text: label,
          range: null,
          markId: id,
          context: getContext(mark),
          anchor: toPageRect(mark.getBoundingClientRect()),
        };
        showBar();
        return;
      }

      hideAll();
    }, 0);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideAll();
  });
})();
