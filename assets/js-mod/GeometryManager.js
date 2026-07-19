// GeometryManager — owns THE shared PageRenderer and is the single source of
// truth for every page/eighths number in the app (R1). Consumers either call
// getScenePagination() (sync, self-invalidating content-signature cache) or
// listen for the debounced 'sfss-geometry' CustomEvent on document.
//
// Import-safe under Node (no DOM access at module scope).

import * as constants from './Constants.js';
import { PageRenderer } from './PageRenderer.js';

// documentElement custom-property suffixes per element type.
const CSS_VAR_NAMES = {
    [constants.ELEMENT_TYPES.SLUG]: 'slug',
    [constants.ELEMENT_TYPES.ACTION]: 'action',
    [constants.ELEMENT_TYPES.CHARACTER]: 'character',
    [constants.ELEMENT_TYPES.DIALOGUE]: 'dialogue',
    [constants.ELEMENT_TYPES.PARENTHETICAL]: 'parenthetical',
    [constants.ELEMENT_TYPES.TRANSITION]: 'transition'
};

export class GeometryManager {
    constructor(app) {
        this.app = app;
        this.renderer = new PageRenderer();

        this._cacheKey = null;
        this._cacheResult = null;
        this._updateTimer = null;

        this.applyGeometryCssVariables();
    }

    // Cache key: paper size + per-block signature over the canonical model.
    // Any change to type/flags/text (or the paper) invalidates the cache.
    _signature(blocks) {
        const parts = [this.renderer.paperConfig.name];
        for (const b of blocks) {
            parts.push(`${b.type}|${b.centered ? 1 : 0}|${b.tight ? 1 : 0}|${b.pageBreak ? 1 : 0}|${b.text || ''}`);
        }
        return parts.join('');
    }

    // Synchronous scene pagination for the CURRENT script content:
    //   { pageCount, totalEighths, scenes, byId }
    // scenes = [{ id, number, startPage, endPage, heightPx, eighths }],
    // byId = Map(slug lineId -> scene entry). Cached until content changes.
    getScenePagination({ fresh = false } = {}) {
        const data = this.app.exportToJSONStructure();
        const blocks = (data && data.blocks) ? data.blocks : [];
        const key = this._signature(blocks);
        if (!fresh && this._cacheResult && this._cacheKey === key) {
            return this._cacheResult;
        }

        const sceneNumberMap = {};
        const sceneMeta = this.app.sceneMeta || {};
        Object.keys(sceneMeta).forEach(id => {
            if (sceneMeta[id].number) sceneNumberMap[id] = sceneMeta[id].number;
        });

        const res = this.renderer.paginate(blocks, {
            showPageNumbers: false,
            sceneNumberMap
        });

        const result = {
            pageCount: res.pageCount,
            totalEighths: res.totalEighths,
            scenes: res.scenes,
            byId: new Map(res.scenes.map(s => [s.id, s]))
        };
        this._cacheKey = key;
        this._cacheResult = result;
        return result;
    }

    invalidate() {
        this._cacheKey = null;
        this._cacheResult = null;
    }

    // Debounced recompute + broadcast. Cheap to call from every edit path
    // (saveState / importJSON / treatment mutations) — the actual pagination
    // runs at most once per 300ms and only when the content signature moved.
    requestUpdate() {
        clearTimeout(this._updateTimer);
        this._updateTimer = setTimeout(() => {
            this._updateTimer = null;
            let result;
            try {
                result = this.getScenePagination();
            } catch (e) {
                console.error('GeometryManager update failed:', e);
                return;
            }
            document.dispatchEvent(new CustomEvent('sfss-geometry', { detail: result }));
        }, 300);
    }

    // Switches the shared renderer's paper, rewrites the --page-* CSS
    // variables and rebroadcasts geometry. No-op when the paper is unchanged
    // (applySettings calls this on every load/import).
    setPaperSize(name) {
        const config = constants.PAPER_CONFIGS[name];
        if (!config || config === this.renderer.paperConfig) return;
        this.renderer.setPaperSize(name);
        this.invalidate();
        this.applyGeometryCssVariables();
        let result;
        try {
            result = this.getScenePagination();
        } catch (e) {
            console.error('GeometryManager paper-size update failed:', e);
            return;
        }
        document.dispatchEvent(new CustomEvent('sfss-geometry', { detail: result }));
    }

    // Writes the authoritative geometry (Constants.ELEMENT_INDENTS + line
    // height) as --sc-* custom properties on :root. print.css and editor.css
    // consume them via var(--sc-*, <fallback>) — the fallbacks equal today's
    // literals, so there is no FOUC before this runs at boot (R13-R17).
    applyGeometryCssVariables() {
        const style = document.documentElement.style;
        const toCss = (v) => (typeof v === 'number') ? (v === 0 ? '0in' : `${v}in`) : v;
        Object.entries(constants.ELEMENT_INDENTS).forEach(([type, indent]) => {
            const name = CSS_VAR_NAMES[type];
            if (!name) return;
            // Right-aligned elements (transition) keep margin-left:auto in the
            // sheets — no indent variable is written for them.
            if (indent.align !== 'right') {
                style.setProperty(`--sc-indent-${name}`, toCss(indent.left));
            }
            style.setProperty(`--sc-width-${name}`, toCss(indent.width));
        });
        style.setProperty('--sc-line', `${this.renderer.lineHeightPx}px`);

        // Physical page box for the ACTIVE paper (A4 end-to-end): print.css
        // .page consumes these via var(--page-*, <US Letter fallback>), so
        // Page View, print preview and the renderer's offscreen layout root
        // all switch papers together. The live area stays 6.0in x 9.0in on
        // every paper (parity margins in Constants.PAPER_CONFIGS).
        const paper = this.renderer.paperConfig;
        style.setProperty('--page-width', `${paper.dimensions.width}in`);
        style.setProperty('--page-height', `${paper.dimensions.height}in`);
        style.setProperty('--page-pad-top', `${paper.margins.top}in`);
        style.setProperty('--page-pad-right', `${paper.margins.right}in`);
        style.setProperty('--page-pad-bottom', `${paper.margins.bottom}in`);
        style.setProperty('--page-pad-left', `${paper.margins.left}in`);
    }
}
