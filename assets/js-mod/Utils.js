// Shared helpers used across modules.
// Import-safe under Node (no DOM/window access at module scope) — the test
// harness imports this file directly via node:test.

export function generateLineId() {
    return `line-${Math.random().toString(36).substring(2, 11)}`;
}

export function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function escapeXML(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// Accepts watch?v=, youtu.be/, embed/, shorts/ and v/ URLs — the superset of
// the two historical implementations (MediaPlayer accepted only watch/youtu.be,
// the portable build accepted more; hosted and portable now agree).
export function extractYouTubeVideoId(url) {
    if (!url) return null;
    const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/|v\/))([\w-]{11})/i);
    return m ? m[1] : null;
}

// One-line printable label for a scene's music track (sceneMeta entry):
// "Title — Artist". With no real title stored (the oEmbed lookup failed, or a
// portable build saved the URL as the title) it falls back to a short
// youtu.be link, then to a generic label. '' when the scene has no track —
// removed tracks have their fields blanked to '', not deleted.
export function trackLabel(meta) {
    if (!meta) return '';
    const clean = (s) => String(s || '').trim();
    const names = [clean(meta.trackTitle), clean(meta.trackArtist)]
        .filter(s => s && !/^https?:\/\//i.test(s));
    if (names.length) return names.join(' — ');
    const id = extractYouTubeVideoId(meta.track);
    if (id) return `youtu.be/${id}`;
    return clean(meta.track) ? 'Track attached' : '';
}

// Preview of "Renumber Scenes". A scene shows its position in the script
// (1…N) unless sceneMeta[id].number holds a custom value; renumbering drops
// every custom value. `scenes` is [{ id, text }] in script order. Returns
// { total, pinned, changes } — `pinned` counts scenes with a custom number,
// `changes` lists the ones whose SHOWN number will differ ({ id, text,
// from, to }, numbers as strings).
export function planSceneRenumber(scenes, sceneMeta) {
    const list = scenes || [];
    const meta = sceneMeta || {};
    let pinned = 0;
    const changes = [];
    list.forEach((scene, i) => {
        const raw = meta[scene.id] ? meta[scene.id].number : null;
        const from = raw === null || raw === undefined ? '' : String(raw).trim();
        if (!from) return;
        pinned++;
        const to = String(i + 1);
        if (from !== to) changes.push({ id: scene.id, text: scene.text, from, to });
    });
    return { total: list.length, pinned, changes };
}

// Convention: DOM block text carries no outer parens for parentheticals (CSS
// ::before/::after supplies them); canonical JSON text carries them. This
// strips exactly one outer (...) pair for the DOM/render side of that seam.
export function normalizeParenText(text = '') {
    const t = String(text).trim();
    const m = t.match(/^\(([\s\S]*)\)$/);
    return m ? m[1] : t;
}

// 'label' → "3/8", "1pg", "1pg 3/8" (UI badges/cards/reports).
// 'fdx'   → "3/8", "1", "1 3/8" (FDX SceneProperties Length; never "16/8").
export function formatEighths(eighths, style = 'label') {
    const e = Math.max(0, Math.round(Number(eighths) || 0));
    const pages = Math.floor(e / 8);
    const rem = e % 8;
    if (pages === 0) return `${rem}/8`;
    const pageLabel = style === 'fdx' ? `${pages}` : `${pages}pg`;
    return rem === 0 ? pageLabel : `${pageLabel} ${rem}/8`;
}
