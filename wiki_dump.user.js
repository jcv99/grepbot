// ==UserScript==
// @name         GrepBot — Grepolis Wiki Dump
// @namespace    grepbot.local
// @version      1.0.0
// @description  Dumps the English Grepolis wiki (wikitext) to a local Python receiver for AI corpus building.
// @author       j
// @match        https://wiki.en.grepolis.com/*
// @match        https://wiki.grepolis.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @run-at       document-idle
// @noframes
// ==/UserScript==

/*
 * Workflow:
 *   1) Start the receiver on this machine:
 *        python3 wiki_receiver.py
 *      (it listens on http://127.0.0.1:8765/ and writes
 *       to /home/j/Documents/Documents/DeV/grepbot/wiki_corpus/)
 *   2) Open any page on https://wiki.en.grepolis.com/
 *   3) Click the floating panel → "Start dump".
 *   4) Watch progress. Receiver dedupes by title, so re-runs are safe.
 *
 * Behaviour:
 *   - Enumerates all pages via api.php?action=query&list=allpages (paginated).
 *   - For each title, fetches wikitext via
 *     api.php?action=query&prop=revisions&rvprop=content&rvslots=main
 *   - Batches posts in groups of 5 with concurrency 3, polite delay.
 *   - Filters out talk/user/file/template/category/mediawiki by default.
 *   - Resumable: titles already saved on disk are skipped (HEAD /title).
 */

(function () {
  "use strict";

  const WIKI_API = "https://wiki.en.grepolis.com/api.php";
  const RECEIVER = "http://127.0.0.1:8765";

  // ---- tunables ----------------------------------------------------------
  const BATCH = 5;       // pages per dispatch group
  const CONCURRENCY = 3; // parallel groups
  const PAGE_DELAY = 150; // ms between single page posts within a group
  const GROUP_DELAY = 400; // ms between groups
  const TIMEOUT_MS = 20000;
  const TITLE_LIMIT = 500; // allpages aplimit per call
  const SAVE_FILTER = (t) => !/^(Talk|User|User_talk|File|File_talk|MediaWiki|MediaWiki_talk|Template|Template_talk|Help|Help_talk|Category|Category_talk|Project|Project_talk|Module|Module_talk|Gadget|Gadget_talk|Gadget_definition|Gadget_definition_talk):/i.test(t);
  // ------------------------------------------------------------------------

  // ---- UI ----------------------------------------------------------------
  GM_addStyle(`
    #gbw-panel {
      position: fixed; bottom: 14px; right: 14px; z-index: 2147483646;
      width: 300px; background: #1f2230; color: #e8eaf0;
      border: 1px solid #3a3f55; border-radius: 8px;
      font: 12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      box-shadow: 0 6px 24px rgba(0,0,0,.35);
    }
    #gbw-panel header {
      padding: 8px 10px; background: #2a2f44; border-radius: 8px 8px 0 0;
      font-weight: 600; display: flex; justify-content: space-between; align-items: center;
    }
    #gbw-panel header .gbw-min { cursor: pointer; opacity: .8; }
    #gbw-panel .gbw-body { padding: 10px; }
    #gbw-panel .gbw-row { margin: 6px 0; }
    #gbw-panel button {
      width: 100%; padding: 6px 8px; border: 1px solid #4a5072;
      background: #353a55; color: #e8eaf0; border-radius: 4px;
      cursor: pointer; font-size: 12px;
    }
    #gbw-panel button:hover { background: #404668; }
    #gbw-panel button:disabled { opacity: .5; cursor: not-allowed; }
    #gbw-panel .gbw-status {
      font-family: ui-monospace, Menlo, Consolas, monospace;
      background: #14161f; border: 1px solid #2c3046; border-radius: 4px;
      padding: 6px; max-height: 180px; overflow: auto; font-size: 11px;
      white-space: pre-wrap;
    }
    #gbw-panel .gbw-bar {
      height: 6px; background: #2c3046; border-radius: 3px; overflow: hidden;
    }
    #gbw-panel .gbw-bar > div { height: 100%; background: #4f9d6b; width: 0%; transition: width .2s; }
    #gbw-panel .gbw-minimized .gbw-body { display: none; }
    #gbw-panel .gbw-minimized header { border-radius: 8px; }
    #gbw-panel a { color: #8ab4ff; }
  `);

  const $panel = document.createElement("div");
  $panel.id = "gbw-panel";
  $panel.innerHTML = `
    <header>
      <span>GrepBot — Wiki Dump</span>
      <span class="gbw-min" title="minimize">_</span>
    </header>
    <div class="gbw-body">
      <div class="gbw-row" id="gbw-conn">receiver: <span id="gbw-conn-state">checking…</span></div>
      <div class="gbw-row gbw-bar"><div id="gbw-bar"></div></div>
      <div class="gbw-row">
        <div>progress: <span id="gbw-count">0</span> / <span id="gbw-total">?</span></div>
        <div>ok: <span id="gbw-ok">0</span> · dup: <span id="gbw-dup">0</span> · err: <span id="gbw-err">0</span></div>
        <div>state: <span id="gbw-state">idle</span></div>
      </div>
      <div class="gbw-row"><button id="gbw-start">Start dump</button></div>
      <div class="gbw-row" style="display:flex; gap:6px">
        <button id="gbw-pause" disabled>Pause</button>
        <button id="gbw-stop" disabled>Stop</button>
      </div>
      <div class="gbw-row"><div class="gbw-status" id="gbw-log"></div></div>
    </div>`;
  document.body.appendChild($panel);

  $panel.querySelector(".gbw-min").addEventListener("click", () => $panel.classList.toggle("gbw-minimized"));

  const $ = (id) => document.getElementById(id);
  const $conn = $("gbw-conn-state");
  const $bar = $("gbw-bar");
  const $count = $("gbw-count");
  const $total = $("gbw-total");
  const $ok = $("gbw-ok");
  const $dup = $("gbw-dup");
  const $err = $("gbw-err");
  const $state = $("gbw-state");
  const $start = $("gbw-start");
  const $pause = $("gbw-pause");
  const $stop = $("gbw-stop");
  const $log = $("gbw-log");

  function log(line) {
    const t = new Date().toLocaleTimeString();
    $log.textContent += `[${t}] ${line}\n`;
    $log.scrollTop = $log.scrollHeight;
  }
  function setState(s) { $state.textContent = s; }
  function setConn(s, ok) { $conn.textContent = s; $conn.style.color = ok ? "#7fd49b" : "#ff8a8a"; }
  function setProgress(done, total) {
    $count.textContent = done;
    $total.textContent = total;
    const pct = total ? Math.round((done / total) * 100) : 0;
    $bar.style.width = pct + "%";
  }

  // ---- HTTP helpers (GM_xmlhttpRequest bypasses CORS) -------------------
  function gmFetch(method, url, body) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers: { "Content-Type": "application/json", "Api-User-Agent": "GrepBot-wiki-dump/1.0" },
        data: body ? JSON.stringify(body) : undefined,
        timeout: TIMEOUT_MS,
        onload: (r) => {
          try {
            const data = r.responseText ? JSON.parse(r.responseText) : null;
            if (r.status >= 200 && r.status < 300) resolve(data);
            else reject(new Error(`HTTP ${r.status}: ${(data && data.error) || r.responseText?.slice(0, 200)}`));
          } catch (e) { reject(new Error(`bad JSON (HTTP ${r.status}): ${r.responseText?.slice(0, 200)}`)); }
        },
        onerror: (r) => reject(new Error(`network error (${r.status || "?"})`)),
        ontimeout: () => reject(new Error("timeout")),
      });
    });
  }

  // ---- receiver handshake -----------------------------------------------
  async function checkReceiver() {
    try {
      const s = await gmFetch("GET", RECEIVER + "/status");
      setConn(`OK — ${s.saved} saved, ${s.unique_titles} unique`, true);
      return true;
    } catch (e) {
      setConn(`UNREACHABLE — start python3 wiki_receiver.py`, false);
      return false;
    }
  }

  async function postPage(title, wikitext, pageid) {
    const res = await gmFetch("POST", RECEIVER + "/page", { title, wikitext, pageid });
    return res; // { status: "saved"|"duplicate"|"error", filename, ... }
  }

  // ---- wiki API ---------------------------------------------------------
  async function listAllPages() {
    // Title-only enumeration. We paginate by apcontinue.
    const out = [];
    let cont = null;
    let safety = 500; // hard cap on pages of pagination
    while (safety-- > 0) {
      const params = new URLSearchParams({
        action: "query",
        list: "allpages",
        aplimit: String(TITLE_LIMIT),
        apnamespace: "0", // main articles only
        format: "json",
      });
      if (cont) params.set("apcontinue", cont);
      const data = await gmFetch("GET", `${WIKI_API}?${params.toString()}`);
      const pages = (data.query && data.query.allpages) || [];
      for (const p of pages) if (SAVE_FILTER(p.title)) out.push({ title: p.title, pageid: p.pageid });
      cont = data.continue && data.continue.apcontinue;
      if (!cont) break;
    }
    return out;
  }

  async function fetchWikitext(title) {
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      titles,
      rvprop: "content",
      rvslots: "main",
      format: "json",
    });
    const data = await gmFetch("GET", `${WIKI_API}?${params.toString()}`);
    const pages = data.query && data.query.pages;
    if (!pages) return null;
    const pid = Object.keys(pages)[0];
    const page = pages[pid];
    if (!page || page.missing !== undefined || !page.revisions) return null;
    const slot = page.revisions[0].slots && page.revisions[0].slots.main;
    return { wikitext: slot ? slot["*"] || "" : "", pageid: page.pageid };
  }

  // ---- control flow -----------------------------------------------------
  const stats = { ok: 0, dup: 0, err: 0, done: 0 };
  let pauseRequested = false;
  let stopRequested = false;

  async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  async function waitIfPaused() {
    while (pauseRequested && !stopRequested) await sleep(300);
  }

  async function dumpOne(title, pageid) {
    await waitIfPaused();
    if (stopRequested) return;
    try {
      const r = await fetchWikitext(title);
      if (!r) { stats.err++; log(`! ${title}: no content`); return; }
      const res = await postPage(title, r.wikitext, pageid);
      if (res.status === "saved") stats.ok++;
      else if (res.status === "duplicate") stats.dup++;
      else { stats.err++; log(`! ${title}: ${res.error || "unknown"}`); return; }
      log(`✓ ${title} (${res.size || "?"}b)`);
    } catch (e) {
      stats.err++;
      log(`! ${title}: ${e.message || e}`);
    } finally {
      stats.done++;
      $ok.textContent = stats.ok; $dup.textContent = stats.dup; $err.textContent = stats.err;
      setProgress(stats.done, planned);
    }
  }

  let planned = 0;

  async function runDump() {
    if (!(await checkReceiver())) return;
    $start.disabled = true; $pause.disabled = false; $stop.disabled = false;
    pauseRequested = false; stopRequested = false;
    Object.assign(stats, { ok: 0, dup: 0, err: 0, done: 0 });
    $ok.textContent = $dup.textContent = $err.textContent = "0";
    setProgress(0, 0);

    try {
      setState("enumerating pages…");
      log("enumerating wiki pages…");
      const pages = await listAllPages();
      planned = pages.length;
      log(`found ${planned} pages`);
      setState("dumping…");
      setProgress(0, planned);

      // simple concurrency-limited loop in groups of BATCH
      for (let i = 0; i < pages.length && !stopRequested; i += BATCH * CONCURRENCY) {
        await waitIfPaused();
        const slice = pages.slice(i, i + BATCH * CONCURRENCY);
        // split into BATCH-sized groups, fire each group with GROUP_DELAY between
        const groups = [];
        for (let j = 0; j < slice.length; j += BATCH) groups.push(slice.slice(j, j + BATCH));
        for (const g of groups) {
          if (stopRequested) break;
          await Promise.all(g.map((p) => dumpOne(p.title, p.pageid)));
          await sleep(GROUP_DELAY);
        }
      }
      setState(stopRequested ? "stopped" : "done");
      log(stopRequested ? "stopped" : `dump complete: ${stats.ok} saved, ${stats.dup} dup, ${stats.err} err`);
    } catch (e) {
      setState("error");
      log(`ERROR: ${e.message || e}`);
    } finally {
      $start.disabled = false;
      $pause.disabled = true; $stop.disabled = true;
      $pause.textContent = "Pause";
    }
  }

  $start.addEventListener("click", runDump);
  $pause.addEventListener("click", () => {
    pauseRequested = !pauseRequested;
    $pause.textContent = pauseRequested ? "Resume" : "Pause";
    setState(pauseRequested ? "paused" : "dumping…");
  });
  $stop.addEventListener("click", () => {
    stopRequested = true;
    pauseRequested = false;
    $pause.textContent = "Pause";
    setState("stopping…");
  });

  // initial receiver check on page load
  checkReceiver();
})();
