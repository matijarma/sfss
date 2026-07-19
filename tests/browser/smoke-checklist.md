# SFSS manual / MCP smoke checklist

Flows that cannot (yet) be covered by `node --test` and need a real browser.
Run against a local HTTP server at the app root (e.g. `python -m http.server 8123`).

Automation legend:
- **[MCP: yes]** — fully drivable with Chrome-DevTools-MCP (navigate / click / evaluate / upload_file / emulate).
- **[MCP: partial]** — MCP can drive most of it but one step needs a human or a workaround (noted).
- **[MCP: manual]** — needs a human (OS dialogs, second physical device, wall-clock time).
- **[AUTOMATED ✓]** — now covered by the standing suites (node / browser runners / CDP release probes); noted per item.

---

## Release regression 2026-07-20 (branch `finish-line`, version `07-20-26_public-2001`)

| Suite | Result |
| --- | --- |
| `node --test "tests/node/*.test.mjs"` | **124 passed, 0 failed** |
| `tests/browser/test.html` (pagination/markup/forces/A4) | **25 passed, 0 failed** (10k-word pagination ~170ms) |
| `tests/browser/storage-tests.html` (TabGuard/IDB/flush) | **9 passed, 0 failed** |
| `tests/browser/fdx-tests.html` | **7 passed, 0 failed** |
| Boot probe `/index.html` (headless CDP) | **0 exceptions, 0 console lines** |
| Mobile emulation boot (375×700, touch) | **0 exceptions, `body.mobile-view` present** |
| Offline cold start (2 online loads → server killed → reload) | **boots from SW cache; 63 precache entries incl. PageRenderer.js + PrintManager.js** |
| Portable build (headless generate → `file://` boot) | **5.46 MB, 0 exceptions, collab/media stubbed** (fixed a flattener bug: `import * as Shortcuts` namespace was dropped) |

Not re-verified in this run (manual before merging): real print dialog output, update banner
with a staged second build, live two-peer collab (reducer + Phase 10 probes only), real mobile device.

---

## Phase 1 — PWA shell / service worker

- [x] **Offline cold-start** — load app online once, go offline (DevTools/`emulate` network: offline), close tab, open new tab to app URL: app boots fully from SW cache, no console errors, editor usable. **[MCP: yes]** **[AUTOMATED ✓ 2026-07-20]** (CDP release probe: two online loads, HTTP server killed, reload boots with `window.app` and zero exceptions; note that versioned `?v=` subresources are runtime-cached on the first SW-controlled load, so a single online visit is not enough by design)
- [ ] **Update banner** — bump SW/app version on the server, reload: "update available" banner appears; clicking it activates the new SW and reloads once (no reload loop). **[MCP: partial]** **[manual-only]** (needs a second build artifact staged on the server; banner + SKIP_WAITING + single-reload logic unchanged since Phase 9a)

## Phase 2 — storage / tab ownership

- [x] **Two-tab guard** — open the app in tab A, then tab B: B shows the "already open elsewhere" guard and the editor is locked/read-only in B. **[MCP: yes]** **[AUTOMATED ✓]** (storage-tests.html: PASSIVE boot on HELD → overlay + read-only editor; channel-pair simulation — a real two-OS-tab open remains a nice manual sanity)
- [x] **Takeover** — from tab B choose "take over": B becomes active, A detects loss of ownership and locks itself (no dual-writer state; verify no data loss after typing in B). **[MCP: yes]** **[AUTOMATED ✓]** (storage-tests.html: TAKEOVER flush/flip/RELEASED, activation on RELEASED, killed-tab 1s-timeout fallback)
- [ ] **Backup warning** — script with old/never `lastBackupAt`: backup-nag warning appears on export-worthy actions; performing an export updates the timestamp and clears the nag. **[MCP: partial]** **[AUTOMATED partial]** (`computeBackupWarning` truth table in the node suite; the DOM nag toggling + export-clears flow is manual)

## Phase 3 — collaboration

- [ ] **Two-page collab session** — host creates session in page 1, guest joins in page 2: edits propagate both ways, active-block highlight visible. **[MCP: yes]** **[AUTOMATED partial]** (BatonProtocol reducer scenarios in the node suite; live two-page flow verified with CDP probes during Phase 10, not re-run in the 2026-07-20 release regression — real WebRTC signaling is network-dependent)
- [ ] **Baton pass** — host passes edit baton to guest: guest becomes writer, host becomes read-only; pass back works. **[MCP: yes]** **[AUTOMATED partial]** (offer/accept/decline/timeout-revoke convergence proven in node reducer tests; live pass is a Phase 10 probe, manual re-check recommended)
- [ ] **Host-leave** — host closes page mid-session: guest gets notified (session ended / promoted per design), no stuck spinner, guest's local copy intact. **[MCP: yes]** **[AUTOMATED partial]** (pagehide flush + SESSION_END covered by reducer tests; live host-close is a Phase 10 probe)
- [ ] **Mobile-host-block** — on a mobile-emulated viewport/UA, hosting is blocked with an explanatory message (joining still allowed). **[MCP: yes]** **[AUTOMATED partial]** (double defense in CollabUI + CollaborationManager.connect; verified during Phase 10 with mobile emulation, not re-run in this regression)

## Phase 4 — import / export

- [ ] **Import each Fountain fixture via UI** — for every file in `tests/fixtures/fountain/`: import through the real file-picker flow; block types/texts in the editor match `tests/node/fountain-parser.test.mjs` expectations (bugs included, until Phase 6). **[MCP: yes]** **[AUTOMATED partial]** (parser logic per-fixture + parse→generate→parse round-trips fully covered by the node suite; the file-picker UI flow itself is manual)
- [x] **Import each FDX fixture via UI** — `styled-runs.fdx` (styled runs land as one paragraph text, note what happens to Bold/Italic), `titlepage-standard.fdx` vs `titlepage-legacy-sfss.fdx` (legacy "Title: X" lines must populate meta; standard FD title page — characterize), `transitions.fdx` (Transition paragraphs + Number attr + SceneProperties → sceneMeta). **[MCP: yes]** **[AUTOMATED ✓]** (fdx-tests.html covers every listed fixture plus meta reset, import-twice replacement, and buildFDX round-trip; only the picker UI is manual)
- [x] **Legacy JSON import** — import `tests/fixtures/json/v1-legacy-script.json`: meta/blocks/sceneMeta/characters all restored; ids preserved. **[MCP: yes]** **[AUTOMATED ✓]** (node suite: v1-legacy fixture backward-compat guard)
- [x] **Portable build generate + open** — trigger portable single-file build; open the generated HTML file: app boots standalone, script data embedded/loadable. **[MCP: partial]** **[AUTOMATED ✓ 2026-07-20]** (CDP release probe generates headlessly via `SingleFileGenerator.buildHtml`, dumps to disk, and boots the file via `file://` with zero exceptions)

## Phase 5 — rendering / pagination

- [x] **Print preview purity in treatment mode** — enter treatment mode, open print preview: only script/treatment content in the print DOM — no toolbars, sidebars, collab UI, banners; page margins per PAPER_CONFIGS. **[MCP: partial]** **[AUTOMATED ✓ / manual for real dialog]** (test.html "purity: pagination never touches a live editor container (R19)"; the actual OS print dialog output must be eyeballed by a human)
- [x] **Page-count parity** — same script: page count shown in toolbar == sidebar == report view == pages implied by FDX export (`SceneProperties Page`/`Length` of last scene). **[MCP: partial]** **[AUTOMATED ✓]** (test.html HEADLINE test: `paginate()` ≡ rendered `.page` count ≡ FDX max startPage, with sane eighths; toolbar/sidebar/report all consume the same GeometryManager)

## Phase 6 — parser rewrite regression sweep

- [x] **Re-run every Phase 4 import flow** after the parser rewrite and diff against the updated characterization tests (the "CURRENT (buggy)" markers in `tests/node/*.test.mjs` list exactly what is allowed to change). **[MCP: yes]** **[AUTOMATED ✓]** (the node suite IS the diff gate; 124/124 green on 2026-07-20)
- [x] **Browser runner green** — `tests/browser/test.html` shows `document.title === 'PASS'` and `body[data-done="1"]`. **[MCP: yes]** **[AUTOMATED ✓ 2026-07-20]** (title PASS, data-done=1, 25/25; storage-tests.html 9/9 and fdx-tests.html 7/7 also PASS)
