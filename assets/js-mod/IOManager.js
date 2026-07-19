import * as constants from './Constants.js';
import { formatEighths } from './Utils.js';
import { plainText } from './InlineMarkup.js';
import { buildFDX, mapFDXParagraphs } from './FDXSerializer.js';
import { toast } from './Toast.js';

export class IOManager {
    constructor(sfss) {
        this.sfss = sfss;
    }

    async downloadJSON() {
        await this.sfss.storageManager.updateBackupTimestamp(this.sfss.activeScriptId);
        await this.sfss.checkBackupStatus();
        const data = this.sfss.exportToJSONStructure();
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.sfss.meta.title || 'script'}.json`;
        a.click();
        toast('Exported JSON backup', { type: 'success' });
    }

    uploadFile(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                await this.importIntoNewScript(file.name, e.target.result);
            } catch (err) {
                console.error(err);
                toast('Invalid file format or error importing.', { type: 'error' });
            }
        };
        reader.readAsText(file);
        input.value = '';
    }

    // Creates + persists a fresh script and imports the file into it. Shared
    // by uploadFile and the PWA launchQueue file handler — the latter used to
    // import straight into the ACTIVE script, orphaning its sceneMeta (#5).
    async importIntoNewScript(fileName, text) {
        const newScript = this.sfss.storageManager.createNewScript();
        await this.sfss.storageManager.saveScript(newScript.id, newScript.content);
        await this.sfss.loadScript(newScript.id, newScript);
        if (fileName.endsWith('.fdx')) {
            const ok = await this.importFDX(text);
            if (ok === false) return; // importFDX already reported the error
        } else if (fileName.endsWith('.json')) {
            await this.sfss.importJSON(JSON.parse(text));
        } else {
            // .fountain, .txt and anything else: the fountain parser handles
            // plain text well.
            const parsed = this.sfss.fountainParser.parse(text);
            await this.sfss.importJSON({
                blocks: parsed.blocks,
                meta: { ...this.sfss.meta, ...parsed.meta },
                sceneMeta: parsed.sceneMeta,
                boneyard: parsed.boneyard || []
            });
        }
        toast(`Imported "${this.sfss.meta.title || fileName}"`, { type: 'success' });
    }

    // FDX import (#15): full meta reset (no cross-script bleed), real
    // <TitlePage> parsing (standard positional layout AND the legacy SFSS
    // "Title: X" label format), and <Text Style> runs preserved as canonical
    // markers via FDXSerializer.mapFDXParagraphs. DOMParser stays here —
    // the serializer only ever sees plain objects.
    async importFDX(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const mainContent = xmlDoc.querySelector('FinalDraft > Content');
        if (!mainContent) { toast('No script content found in FDX.', { type: 'error' }); return false; }

        // FULL reset before reading: title/author/contact AND display flags —
        // nothing from the previously open script may survive the import.
        this.sfss.meta = {
            title: '', author: '', contact: '',
            showTitlePage: true, showSceneNumbers: false, showDate: false
        };
        this.sfss.characters.clear();
        this.sfss.sceneMeta = {};
        this.sfss.boneyard = [];
        Object.assign(this.sfss.meta, this.readFDXTitlePage(xmlDoc));

        // Only DIRECT Content children are script paragraphs — Summary
        // paragraphs nested inside SceneProperties must not become blocks.
        const paras = Array.from(mainContent.children)
            .filter(el => el.tagName === 'Paragraph')
            .map(p => this.fdxParagraphToPlain(p));
        const mapped = mapFDXParagraphs(paras);
        mapped.characters.forEach(c => this.sfss.characters.add(c));
        this.sfss.sceneMeta = mapped.sceneMeta;

        // importJSON applies flags/classes, refreshes the sidebar, saves and
        // snapshots history — the same path every other import takes.
        await this.sfss.importJSON({
            blocks: mapped.blocks,
            meta: this.sfss.meta,
            sceneMeta: mapped.sceneMeta,
            characters: Array.from(this.sfss.characters),
            boneyard: []
        });
    }

    // One <Paragraph> element -> the plain object mapFDXParagraphs consumes.
    // Only DIRECT <Text> children are runs (SceneProperties/Summary nest
    // their own <Text> elements which must not leak into the slug text).
    fdxParagraphToPlain(p) {
        const textRuns = Array.from(p.getElementsByTagName('Text'))
            .filter(t => t.parentNode === p)
            .map(t => {
                const style = t.getAttribute('Style') || '';
                return {
                    text: t.textContent,
                    bold: /Bold/i.test(style),
                    italic: /Italic/i.test(style),
                    underline: /Underline/i.test(style)
                };
            });
        if (!textRuns.length) {
            // Degenerate FDX with bare paragraph text (no <Text> children).
            const direct = Array.from(p.childNodes)
                .filter(n => n.nodeType === Node.TEXT_NODE)
                .map(n => n.nodeValue).join('').trim();
            if (direct) textRuns.push({ text: direct, bold: false, italic: false, underline: false });
        }

        const plain = {
            type: p.getAttribute('Type'),
            number: p.getAttribute('Number'),
            alignment: p.getAttribute('Alignment'),
            textRuns
        };

        const props = Array.from(p.children).find(el => el.tagName === 'SceneProperties');
        if (props) {
            const summary = Array.from(props.querySelectorAll('Paragraph')).map(para =>
                Array.from(para.querySelectorAll('Text')).map(t => t.textContent).join('')
            ).join('\n').trim();
            const description = summary || props.getAttribute('Title') || '';
            if (description) plain.sceneProps = { description };
        }
        return plain;
    }

    // <TitlePage> -> { title?, author?, contact? }. Standard positional
    // layout: title = first non-empty centered paragraph, author = first
    // non-empty paragraph after a "Written by"/"by" line (fallback: second
    // non-empty centered), contact = trailing run of non-centered paragraphs.
    // Legacy SFSS exports wrote literal "Title:/Author:/Contact:" labels —
    // those are recognized and stripped instead.
    readFDXTitlePage(xmlDoc) {
        const out = {};
        const content = xmlDoc.querySelector('FinalDraft > TitlePage > Content');
        if (!content) return out;
        const paras = Array.from(content.children)
            .filter(el => el.tagName === 'Paragraph')
            .map(p => ({
                centered: (p.getAttribute('Alignment') || 'Left') === 'Center',
                text: Array.from(p.getElementsByTagName('Text')).map(t => t.textContent).join('')
            }));

        let legacy = false;
        paras.forEach(p => {
            const m = p.text.match(/^(Title|Author|Contact):\s*(.*)$/i);
            if (!m) return;
            legacy = true;
            const key = m[1].toLowerCase();
            out[key] = out[key] ? out[key] + '\n' + m[2] : m[2];
        });
        if (legacy) return out;

        const centered = paras.filter(p => p.centered && p.text.trim() !== '');
        if (centered.length) out.title = centered[0].text.trim();

        const byIdx = paras.findIndex(p => /^(written\s+)?by$/i.test(p.text.trim()));
        if (byIdx !== -1) {
            const after = paras.slice(byIdx + 1).find(p => p.text.trim() !== '');
            if (after) out.author = after.text.trim();
        } else if (centered.length > 1) {
            out.author = centered[1].text.trim();
        }

        const contactLines = [];
        for (let i = paras.length - 1; i >= 0; i--) {
            if (paras[i].centered) break;
            if (paras[i].text.trim() !== '') contactLines.unshift(paras[i].text.trim());
        }
        if (contactLines.length) out.contact = contactLines.join('\n');
        return out;
    }

    async downloadFDX() {
        await this.sfss.storageManager.updateBackupTimestamp(this.sfss.activeScriptId);
        await this.sfss.checkBackupStatus();

        const blocks = this.sfss.exportToJSONStructure().blocks || [];

        // 1. Scene stats from the shared geometry engine (R1). Length is
        // normalized ("1 3/8", never "16/8" — R28), Page is the start page.
        // sceneMeta numbers/descriptions ride along in the same map so
        // buildFDX stays a pure function of its input.
        const sceneStats = {};
        this.sfss.geometry.getScenePagination().scenes.forEach(scene => {
            sceneStats[scene.id] = {
                page: scene.startPage,
                length: formatEighths(scene.eighths, 'fdx')
            };
        });
        Object.keys(this.sfss.sceneMeta).forEach(id => {
            const m = this.sfss.sceneMeta[id];
            if (!m || (!m.number && !m.description)) return;
            if (!sceneStats[id]) sceneStats[id] = { page: 1, length: '1/8' };
            if (m.number) sceneStats[id].number = m.number;
            if (m.description) sceneStats[id].description = m.description;
        });

        // 2. SmartType lists. Location parsing fixed (#16): strip the
        // INT./EXT./EST./I/E prefix from the slug, split the remainder on
        // " - " — the LAST segment is the time of day, the rest joined back
        // together is the location. Marker/note text never leaks in.
        const characters = new Set();
        const locations = new Set();
        const times = new Set();
        const extensions = new Set();

        blocks.forEach(block => {
            const text = plainText(block.text || '').trim();
            if (block.type === constants.ELEMENT_TYPES.CHARACTER) {
                const clean = this.sfss.editorHandler.getCleanCharacterName(text);
                if (clean.length > 1) characters.add(clean);
                const extMatch = text.match(/\((.*?)\)/);
                if (extMatch) extensions.add(extMatch[1]);
            } else if (block.type === constants.ELEMENT_TYPES.SLUG) {
                const stripped = text.replace(/^(INT\.?\/EXT|I\/E|INT|EXT|EST)[. ]+/i, '').trim();
                if (!stripped) return;
                const parts = stripped.split(' - ');
                if (parts.length > 1) {
                    times.add(parts[parts.length - 1].trim());
                    locations.add(parts.slice(0, -1).join(' - ').trim());
                } else {
                    locations.add(stripped);
                }
            }
        });

        // 3. All XML construction is delegated to the pure serializer
        // (proper positional title page — no literal "Title:" labels).
        const xml = buildFDX({
            meta: this.sfss.meta,
            blocks,
            sceneStats,
            smartType: {
                characters: Array.from(characters),
                locations: Array.from(locations),
                times: Array.from(times),
                extensions: Array.from(extensions)
            }
        });

        const blob = new Blob([xml], {type: 'text/xml'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.sfss.meta.title || 'script'}.fdx`;
        a.click();
        toast('Exported Final Draft (.fdx)', { type: 'success' });
    }

    async downloadFountain() {
        try {
            await this.sfss.storageManager.updateBackupTimestamp(this.sfss.activeScriptId);
            await this.sfss.checkBackupStatus();
            const data = this.sfss.exportToJSONStructure();
            if (!this.sfss.fountainParser) {
                console.error("FountainParser not initialized");
                toast('Internal Error: Fountain Parser not loaded.', { type: 'error' });
                return;
            }
            const fountainText = this.sfss.fountainParser.generate(data);
            const blob = new Blob([fountainText], {type: 'text/plain;charset=utf-8'});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${this.sfss.meta.title || 'script'}.fountain`;
            a.click();
            toast('Exported Fountain (.fountain)', { type: 'success' });
        } catch (e) {
            console.error("Download Fountain Error:", e);
            toast('Failed to generate Fountain file.', { type: 'error' });
        }
    }

    async downloadText() {
        await this.sfss.storageManager.updateBackupTimestamp(this.sfss.activeScriptId);
        await this.sfss.checkBackupStatus();
        const data = this.sfss.exportToJSONStructure();
        const textData = this.sfss.fountainParser.generate(data);
        const blob = new Blob([textData], {type: 'text/plain;charset=utf-8'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.sfss.meta.title || 'script'}.txt`;
        a.click();
        toast('Exported plain text (.txt)', { type: 'success' });
    }

}
