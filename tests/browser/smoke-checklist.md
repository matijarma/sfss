# SFSS manual / MCP smoke checklist

Flows that cannot (yet) be covered by `node --test` and need a real browser.
Run against a local HTTP server at the app root (e.g. `python -m http.server 8123`).

Automation legend:
- **[MCP: yes]** — fully drivable with Chrome-DevTools-MCP (navigate / click / evaluate / upload_file / emulate).
- **[MCP: partial]** — MCP can drive most of it but one step needs a human or a workaround (noted).
- **[MCP: manual]** — needs a human (OS dialogs, second physical device, wall-clock time).

---

## Phase 1 — PWA shell / service worker

- [ ] **Offline cold-start** — load app online once, go offline (DevTools/`emulate` network: offline), close tab, open new tab to app URL: app boots fully from SW cache, no console errors, editor usable. **[MCP: yes]** (network emulation + new_page + console check)
- [ ] **Update banner** — bump SW/app version on the server, reload: "update available" banner appears; clicking it activates the new SW and reloads once (no reload loop). **[MCP: partial]** (needs a second build artifact to serve; banner click + reload count checkable via MCP)

## Phase 2 — storage / tab ownership

- [ ] **Two-tab guard** — open the app in tab A, then tab B: B shows the "already open elsewhere" guard and the editor is locked/read-only in B. **[MCP: yes]** (two pages via new_page, assert guard DOM in B)
- [ ] **Takeover** — from tab B choose "take over": B becomes active, A detects loss of ownership and locks itself (no dual-writer state; verify no data loss after typing in B). **[MCP: yes]**
- [ ] **Backup warning** — script with old/never `lastBackupAt`: backup-nag warning appears on export-worthy actions; performing an export updates the timestamp and clears the nag. **[MCP: partial]** (timestamp can be forced by evaluate_script writing to IDB/localStorage; then assert warning DOM)

## Phase 3 — collaboration

- [ ] **Two-page collab session** — host creates session in page 1, guest joins in page 2: edits propagate both ways, active-block highlight visible. **[MCP: yes]** (two pages in one browser; assert block text convergence)
- [ ] **Baton pass** — host passes edit baton to guest: guest becomes writer, host becomes read-only; pass back works. **[MCP: yes]**
- [ ] **Host-leave** — host closes page mid-session: guest gets notified (session ended / promoted per design), no stuck spinner, guest's local copy intact. **[MCP: yes]** (close_page on host, assert guest UI)
- [ ] **Mobile-host-block** — on a mobile-emulated viewport/UA, hosting is blocked with an explanatory message (joining still allowed). **[MCP: yes]** (emulate mobile device, assert blocked host button)

## Phase 4 — import / export

- [ ] **Import each Fountain fixture via UI** — for every file in `tests/fixtures/fountain/`: import through the real file-picker flow; block types/texts in the editor match `tests/node/fountain-parser.test.mjs` expectations (bugs included, until Phase 6). **[MCP: yes]** (upload_file into the input; assert editor DOM)
- [ ] **Import each FDX fixture via UI** — `styled-runs.fdx` (styled runs land as one paragraph text, note what happens to Bold/Italic), `titlepage-standard.fdx` vs `titlepage-legacy-sfss.fdx` (legacy "Title: X" lines must populate meta; standard FD title page — characterize), `transitions.fdx` (Transition paragraphs + Number attr + SceneProperties → sceneMeta). **[MCP: yes]**
- [ ] **Legacy JSON import** — import `tests/fixtures/json/v1-legacy-script.json`: meta/blocks/sceneMeta/characters all restored; ids preserved. **[MCP: yes]**
- [ ] **Portable build generate + open** — trigger portable single-file build; open the generated HTML file: app boots standalone, script data embedded/loadable. **[MCP: partial]** (generation drivable; opening the downloaded file needs a `file://` navigate or re-serve step)

## Phase 5 — rendering / pagination

- [ ] **Print preview purity in treatment mode** — enter treatment mode, open print preview: only script/treatment content in the print DOM — no toolbars, sidebars, collab UI, banners; page margins per PAPER_CONFIGS. **[MCP: partial]** (print-media DOM checkable via emulate print media + snapshot; real print dialog is manual)
- [ ] **Page-count parity** — same script: page count shown in toolbar == sidebar == report view == pages implied by FDX export (`SceneProperties Page`/`Length` of last scene). **[MCP: partial]** (toolbar/sidebar/report via DOM; FDX value requires intercepting the download blob via evaluate_script)

## Phase 6 — parser rewrite regression sweep

- [ ] **Re-run every Phase 4 import flow** after the parser rewrite and diff against the updated characterization tests (the "CURRENT (buggy)" markers in `tests/node/*.test.mjs` list exactly what is allowed to change). **[MCP: yes]**
- [ ] **Browser runner green** — `tests/browser/test.html` shows `document.title === 'PASS'` and `body[data-done="1"]`. **[MCP: yes]** (this is the standing smoke gate for every phase)
