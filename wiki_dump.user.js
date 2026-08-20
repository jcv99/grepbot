// ==UserScript==
// @name         GrepBot — Grepolis Wiki Dump
// @namespace    grepbot.local
// @version      2.0.0
// @description  Dumps the English Grepolis wiki (wikitext) to a ZIP file the user saves themselves. Browser-only — no local server.
// @author       j
// @match        https://wiki.en.grepolis.com/*
// @match        https://wiki.grepolis.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @run-at       document-idle
// @noframes
// ==/UserScript==

/*
 * Workflow:
 *   1) Open any page on https://wiki.en.grepolis.com/
 *   2) Click the floating panel → "Start dump"
 *   3) Click "Download ZIP" when satisfied (one ZIP per click; partial ok)
 *   4) Already-dumped titles persist via localStorage; next run only fetches net-new.
 *
 * Behaviour:
 *   - Enumerates via api.php?action=query&list=allpages (paginated).
 *   - Fetches wikitext via api.php?action=query&prop=revisions&rvprop=content&rvslots=main.
 *   - Concurrency 3, batches of 5, polite 400ms group delay.
 *   - Filters Talk / User / File / Template / Category / etc. namespace.
 *   - One ZIP per "Download ZIP" click. SAVE_FILTER list of namespaces is the same
 *     as the receiver used.
 *
 * Why no receiver:
 *   CLAUDE.md forbids a local server (paste-only mode). Browser-side download
 *   keeps the dump off the host's listeners entirely.
 */

(function () {
  "use strict";

  const WIKI_API = "https://wiki.en.grepolis.com/api.php";

  // ---- tunables ----------------------------------------------------------
  const BATCH = 5;
  const CONCURRENCY = 3;
  const GROUP_DELAY_MS = 400;
  const TIMEOUT_MS = 20000;
  const TITLE_LIMIT = 500;
  const LS_DONE_KEY = "gbw_titles_done_v2";

  const SAVE_FILTER = (t) =>
    !/^(Talk|User|User_talk|File|File_talk|MediaWiki|MediaWiki_talk|Template|Template_talk|Help|Help_talk|Category|Category_talk|Project|Project_talk|Module|Module_talk|Gadget|Gadget_talk|Gadget_definition|Gadget_definition_talk):/i.test(
      t
    );

  // ---- styles ------------------------------------------------------------
  GM_addStyle(`
    #gbw-panel {
      position: fixed; bottom: 14px; right: 14px; z-index: 2147483646;
      width: 300px; background: #1f2230; color: #e8eaf0;
      border: 1px solid #3a3f55; border-radius: 8px;
      font: 12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      box-shadow: 0 6px 24px rgba(0,0,0,.35);
    }
    #gbw-panel header {
      padding: 8px 10px; background: #2a2f44; border-radius: 8px 0 0 0;
      font-weight: 600; display: flex; justify-content: space-between; align-items: center;
    }
    #gbw-panel header .gbw-min { cursor: pointer; opacity: .8; padding: 0 4px; }
    #gbw-panel .gbw-body { padding: 10px; }
    #gbw-panel .gbw-row { margin: 6px 0; }
    #gbw-panel button {
      width: 100%; padding: 6px 8px; border: 1px solid #4a5072;
      background: #353a55; color: #e8eaf0; border-radius: 4px;
      cursor: pointer; font-size: 12px;
    }
    #gbw-panel button:hover:not(:disabled) { background: #404668; }
    #gbw-panel button:disabled { opacity: .5; cursor: not-allowed; }
    #gbw-panel button.alt { background: #2c3046; }
    #gbw-panel button.danger { background: #4a2a2a; border-color: #6b3a3a; }
    #gbw-panel button.tiny { font-size: 11px; opacity: .75; }
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
    #gbw-panel.gbw-minimized .gbw-body { display: none; }
    #gbw-panel.gbw-minimized header { border-radius: 8px; }
  `);

  // ---- DOM ---------------------------------------------------------------
  const $panel = document.createElement("div");
  $panel.id = "gbw-panel";
  $panel.innerHTML = `
    <header>
      <span>GrepBot — Wiki Dump</span>
      <span class="gbw-min" title="minimize">_</span>
    </header>
    <div class="gbw-body">
      <div class="gbw-row">archive: <span id="gbw-conn-state">—</span></div>
      <div class="gbw-row">in memory: <span id="gbw-arch-state">0 pages · 0 KB</span></div>
      <div class="gbw-row gbw-bar"><div id="gbw-bar"></div></div>
      <div class="gbw-row">
        <div>progress: <span id="gbw-count">0</span> / <span id="gbw-total">?</span></div>
        <div>ok: <span id="gbw-ok">0</span> · err: <span id="gbw-err">0</span></div>
        <div>state: <span id="gbw-state">idle</span></div>
      </div>
      <div class="gbw-row"><button id="gbw-start">Start dump</button></div>
      <div class="gbw-row" style="display:flex; gap:6px">
        <button id="gbw-pause" disabled>Pause</button>
        <button id="gbw-stop" disabled>Stop</button>
      </div>
      <div class="gbw-row" style="display:flex; gap:6px">
        <button id="gbw-dl" class="alt" disabled>Download ZIP</button>
        <button id="gbw-clear" class="alt" disabled>Clear</button>
      </div>
      <div class="gbw-row"><button id="gbw-reset" class="tiny danger">reset done-set (re-fetch all)</button></div>
      <div class="gbw-row"><div class="gbw-status" id="gbw-log"></div></div>
    </div>`;
  document.body.appendChild($panel);

  $panel.querySelector(".gbw-min").addEventListener("click", () => {
    $panel.classList.toggle("gbw-minimized");
  });

  const $ = (id) => document.getElementById(id);
  const $conn = $("gbw-conn-state");
  const $arch = $("gbw-arch-state");
  const $bar = $("gbw-bar");
  const $count = $("gbw-count");
  const $total = $("gbw-total");
  const $ok = $("gbw-ok");
  const $err = $("gbw-err");
  const $state = $("gbw-state");
  const $start = $("gbw-start");
  const $pause = $("gbw-pause");
  const $stop = $("gbw-stop");
  const $dl = $("gbw-dl");
  const $clear = $("gbw-clear");
  const $log = $("gbw-log");

  // ---- state -------------------------------------------------------------
  // Done set persists across sessions via localStorage; archive resets on
  // tab close. Marking a title done happens at ZIP download time — the user
  // confirms persistence by clicking "Download ZIP", not by every fetched page.
  const doneSet = new Set(GM_getValue(LS_DONE_KEY, []));
  /** @type {Map<string, {wikitext: string, pageid: number|null}>} */
  const archive = new Map();

  // ---- helpers -----------------------------------------------------------
  function log(line) {
    const t = new Date().toLocaleTimeString();
    $log.textContent += `[${t}] ${line}\n`;
    $log.scrollTop = $log.scrollHeight;
  }
  function setState(s) {
    $state.textContent = s;
  }
  function setConn(s, ok) {
    $conn.textContent = s;
    $conn.style.color = ok ? "#7fd49b" : "#ff8a8a";
  }
  function setProgress(done, total) {
    $count.textContent = String(done);
    $total.textContent = String(total);
    const pct = total ? Math.round((done / total) * 100) : 0;
    $bar.style.width = pct + "%";
  }
  function updateArchStat() {
    let bytes = 0;
    for (const { wikitext } of archive.values()) bytes += (wikitext || "").length;
    $arch.textContent = `${archive.size} pages · ${(bytes / 1024).toFixed(0)} KB`;
  }

  function gmFetch(method, url, body) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers: { "Api-User-Agent": "GrepBot-wiki-dump/2.0" },
        data: body ? JSON.stringify(body) : undefined,
        timeout: TIMEOUT_MS,
        onload: (r) => {
          try {
            const data = r.responseText ? JSON.parse(r.responseText) : null;
            if (r.status >= 200 && r.status < 300) resolve(data);
            else
              reject(
                new Error(
                  `HTTP ${r.status}: ${(data && data.error) || (r.responseText || "").slice(0, 200)}`
                )
              );
          } catch (_) {
            reject(new Error(`bad JSON (HTTP ${r.status})`));
          }
        },
        onerror: () => reject(new Error("network error")),
        ontimeout: () => reject(new Error("timeout")),
      });
    });
  }

  function safeName(title) {
    return (
      title
        .replace(/[\\/:*?"<>|]+/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200) + ".txt"
    );
  }

  // ---- wiki API ----------------------------------------------------------
  async function listAllPages() {
    const out = [];
    let cont = null;
    let safety = 500;
    while (safety-- > 0) {
      const params = new URLSearchParams({
        action: "query",
        list: "allpages",
        aplimit: String(TITLE_LIMIT),
        apnamespace: "0",
        format: "json",
      });
      if (cont) params.set("apcontinue", cont);
      const data = await gmFetch("GET", `${WIKI_API}?${params.toString()}`);
      const pages = (data.query && data.query.allpages) || [];
      for (const p of pages) {
        if (!SAVE_FILTER(p.title)) continue;
        if (doneSet.has(p.title)) continue;
        out.push({ title: p.title, pageid: p.pageid });
      }
      cont = data.continue && data.continue.apcontinue;
      if (!cont) break;
    }
    return out;
  }

  async function fetchWikitext(title) {
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      titles: title,
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
    return {
      wikitext: slot ? slot["*"] || "" : "",
      pageid: page.pageid,
    };
  }

  // ---- zip download ------------------------------------------------------
  async function downloadZip() {
    if (archive.size === 0) {
      log("archive empty — start a dump first");
      return;
    }
    setState("building zip…");
    $dl.disabled = true;
    log(`building zip: ${archive.size} pages`);
    try {
      const zip = new JSZip();
      for (const [title, { wikitext, pageid }] of archive) {
        const header =
          `# Grepolis Wiki — ${title}\n` +
          `# pageid: ${pageid != null ? pageid : "n/a"}\n` +
          `# fetched: ${new Date().toISOString()}\n` +
          `# source: https://wiki.en.grepolis.com/wiki/${title.replace(/ /g, "_")}\n` +
          `# ${"-".repeat(60)}\n\n`;
        const body = wikitext || "";
        zip.file(safeName(title), header + body + (body.endsWith("\n") ? "" : "\n"));
      }
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      const ts = new Date().toISOString().slice(0, 10);
      const filename = `wiki.grepolis.com-${ts}.zip`;
      const url = URL.createObjectURL(blob);

      if (typeof GM_download !== "undefined") {
        GM_download({ url, name: filename, saveAs: true });
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      // Only on user-confirmed save do we mark titles done.
      for (const t of archive.keys()) doneSet.add(t);
      GM_setValue(LS_DONE_KEY, [...doneSet]);
      log(`zip ready: ${filename} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
      setState("done — zip offered");
      setConn(`done: ${doneSet.size} titles saved · archive: ${archive.size}`, true);
    } catch (e) {
      log(`ERROR: ${e.message || e}`);
      setState("zip error");
    } finally {
      $dl.disabled = archive.size === 0;
    }
  }

  function clearArchive() {
    if (archive.size === 0) return;
    if (!confirm(`clear in-memory archive (${archive.size} pages)? done-set stays.`)) return;
    archive.clear();
    log("in-memory archive cleared");
    updateArchStat();
    $dl.disabled = true;
    $clear.disabled = true;
  }

  function resetDone() {
    if (doneSet.size === 0) {
      log("done-set already empty");
      return;
    }
    if (!confirm(`reset ${doneSet.size} titles from done-set? next dump re-fetches them all.`)) return;
    doneSet.clear();
    GM_setValue(LS_DONE_KEY, []);
    log("done-set reset");
    setConn(`done: 0 · archive: ${archive.size}`, true);
  }

  // ---- control flow ------------------------------------------------------
  const stats = { ok: 0, err: 0, done: 0 };
  let pauseRequested = false;
  let stopRequested = false;
  let planned = 0;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitIfPaused() {
    while (pauseRequested && !stopRequested) await sleep(300);
  }

  async function dumpOne(title, pageid) {
    await waitIfPaused();
    if (stopRequested) return;
    try {
      const r = await fetchWikitext(title);
      if (!r) {
        stats.err++;
        log(`! ${title}: no content`);
        return;
      }
      archive.set(title, { wikitext: r.wikitext, pageid });
      stats.ok++;
      log(`✓ ${title} (${r.wikitext.length}b)`);
      updateArchStat();
    } catch (e) {
      stats.err++;
      log(`! ${title}: ${e.message || e}`);
    } finally {
      stats.done++;
      $ok.textContent = String(stats.ok);
      $err.textContent = String(stats.err);
      setProgress(stats.done, planned);
    }
  }

  async function runDump() {
    setConn(`done: ${doneSet.size} · archive: ${archive.size}`, true);
    $start.disabled = true;
    $pause.disabled = false;
    $stop.disabled = false;
    $dl.disabled = archive.size === 0;
    $clear.disabled = archive.size === 0;
    pauseRequested = false;
    stopRequested = false;
    Object.assign(stats, { ok: 0, err: 0, done: 0 });
    $ok.textContent = $err.textContent = "0";
    setProgress(0, 0);

    try {
      setState("enumerating pages…");
      log("enumerating wiki pages…");
      const pages = await listAllPages();
      planned = pages.length;
      log(`found ${planned} new pages (${doneSet.size} already saved)`);
      setState("dumping…");
      setProgress(0, planned);

      for (let i = 0; i < pages.length && !stopRequested; i += BATCH * CONCURRENCY) {
        await waitIfPaused();
        const slice = pages.slice(i, i + BATCH * CONCURRENCY);
        const groups = [];
        for (let j = 0; j < slice.length; j += BATCH) groups.push(slice.slice(j, j + BATCH));
        for (const g of groups) {
          if (stopRequested) break;
          await Promise.all(g.map((p) => dumpOne(p.title, p.pageid)));
          await sleep(GROUP_DELAY_MS);
        }
      }
      setState(stopRequested ? "stopped" : "done");
      log(
        stopRequested
          ? "stopped"
          : `dump complete: ${stats.ok} saved, ${stats.err} err · click Download ZIP to save`
      );
      $dl.disabled = archive.size === 0;
      $clear.disabled = archive.size === 0;
    } catch (e) {
      setState("error");
      log(`ERROR: ${e.message || e}`);
    } finally {
      $start.disabled = false;
      $pause.disabled = true;
      $stop.disabled = true;
      $pause.textContent = "Pause";
    }
  }

  // ---- wire --------------------------------------------------------------
  $start.addEventListener("click", runDump);
  $pause.addEventListener("click", () => {
    if (planned === 0) return;
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
  $dl.addEventListener("click", downloadZip);
  $clear.addEventListener("click", clearArchive);
  $("gbw-reset").addEventListener("click", resetDone);

  // ---- boot --------------------------------------------------------------
  setConn(`done: ${doneSet.size} · archive: 0`, true);
  updateArchStat();
})();
