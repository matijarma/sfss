import * as constants from './Constants.js';

export class IOManager {
    constructor(sfss) {
        this.sfss = sfss;
    }

    async downloadJSON() {
        await this.sfss.storageManager.updateBackupTimestamp(this.sfss.activeScriptId);
        const data = this.sfss.exportToJSONStructure();
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.sfss.meta.title || 'script'}.json`;
        a.click();
    }

    uploadFile(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const newScript = this.sfss.storageManager.createNewScript();
                await this.sfss.loadScript(newScript.id, newScript);
                if (file.name.endsWith('.fdx')) {
                    await this.importFDX(e.target.result);
                } else if (file.name.endsWith('.json')) {
                    await this.sfss.importJSON(JSON.parse(e.target.result)); 
                } else if (file.name.endsWith('.fountain')) {
                    const parsed = this.sfss.fountainParser.parse(e.target.result);
                    await this.sfss.importJSON({
                        blocks: parsed.blocks, 
                        meta: { ...this.sfss.meta, ...parsed.meta }, 
                        sceneMeta: parsed.sceneMeta 
                    });
                } else {
                    // Fallback for .txt or other: Use fountain parser anyway as it handles plain text well
                    const parsed = this.sfss.fountainParser.parse(e.target.result);
                    await this.sfss.importJSON({
                        blocks: parsed.blocks, 
                        meta: { ...this.sfss.meta, ...parsed.meta }, 
                        sceneMeta: parsed.sceneMeta 
                    });
                }
            } catch (err) { 
                console.error(err);
                alert('Invalid file format or error importing.'); 
            }
        };
        reader.readAsText(file);
        input.value = '';
    }

    async importFDX(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const mainContent = xmlDoc.querySelector('FinalDraft > Content');
        if (!mainContent) { alert("No script content found in FDX."); return; }
        
        const paragraphs = mainContent.querySelectorAll("Paragraph");
        this.sfss.editor.innerHTML = '';
        this.sfss.characters.clear();
        this.sfss.sceneMeta = {}; // Reset scene meta
        this.sfss.meta.title = xmlDoc.querySelector('Title') ? xmlDoc.querySelector('Title').textContent : ''; 
        
        // Try to get Author/Contact from TitlePage if possible (basic check)
        this.sfss.applySettings();
        
        paragraphs.forEach(p => {
            const type = p.getAttribute("Type");
            const number = p.getAttribute("Number"); // Read Scene Number
            let text = Array.from(p.getElementsByTagName("Text")).map(t => t.textContent).join('');
            if (!text && p.textContent) text = p.textContent;
            
            const dzType = constants.FDX_REVERSE_MAP[type] || constants.ELEMENT_TYPES.ACTION;
            const block = this.sfss.editorHandler.createBlock(dzType, text);
            
            if (dzType === constants.ELEMENT_TYPES.SLUG) {
                // Check Scene Properties
                const props = p.querySelector('SceneProperties');
                if (props || number) {
                     if (!this.sfss.sceneMeta[block.dataset.lineId]) this.sfss.sceneMeta[block.dataset.lineId] = {};
                     if (number) this.sfss.sceneMeta[block.dataset.lineId].number = number;
                     if (props) {
                         const summaryEl = props.querySelector('Summary');
                         let summary = '';
                         if (summaryEl) {
                             // Extract text from all Paragraphs within Summary
                             summary = Array.from(summaryEl.querySelectorAll('Paragraph')).map(para => {
                                 return Array.from(para.querySelectorAll('Text')).map(t => t.textContent).join('');
                             }).join('\n');
                         }
                         const title = props.getAttribute('Title');
                         if (summary) this.sfss.sceneMeta[block.dataset.lineId].description = summary;
                         else if (title) this.sfss.sceneMeta[block.dataset.lineId].description = title;
                     }
                }
            }
            if (dzType === constants.ELEMENT_TYPES.CHARACTER) {
                const clean = this.sfss.editorHandler.getCleanCharacterName(text);
                if (clean.length > 1) this.sfss.characters.add(clean);
            }
        });
        
        this.sfss.sidebarManager.updateSceneList();
        await this.sfss.save();
        this.sfss.saveState(true);
    }

    async downloadFDX() {
        await this.sfss.storageManager.updateBackupTimestamp(this.sfss.activeScriptId);
        
        // 1. Calculate Scene Stats (Headless Pagination)
        const hiddenContainer = document.createElement('div');
        hiddenContainer.style.position = 'absolute';
        hiddenContainer.style.visibility = 'hidden';
        hiddenContainer.style.width = '8.5in'; // US Letter standard
        document.body.appendChild(hiddenContainer);
        
        const sceneNumberMap = {};
        Object.keys(this.sfss.sceneMeta).forEach(id => {
            if (this.sfss.sceneMeta[id].number) sceneNumberMap[id] = this.sfss.sceneMeta[id].number;
        });
        
        this.sfss.pageRenderer.render(Array.from(this.sfss.editor.querySelectorAll('.script-line')), hiddenContainer, {
            showSceneNumbers: true,
            sceneNumberMap: sceneNumberMap
        });
        
        const sceneStats = {}; 
        const pages = hiddenContainer.querySelectorAll('.page');
        let currentSceneId = null;
        let currentSceneHeight = 0;
        let currentSceneStartPage = 1;
        
        pages.forEach((page, pageIndex) => {
            const pageNum = pageIndex + 1;
            const content = page.querySelector('.content-wrapper');
            if (!content) return;
            
            Array.from(content.children).forEach(node => {
                if (node.classList.contains(constants.ELEMENT_TYPES.SLUG)) {
                    if (currentSceneId) {
                         const eighths = Math.max(1, Math.round((currentSceneHeight / this.sfss.CONTENT_HEIGHT_PX) * 8));
                         if (!sceneStats[currentSceneId]) sceneStats[currentSceneId] = { page: currentSceneStartPage, length: `${eighths}/8` };
                    }
                    currentSceneId = node.dataset.lineId;
                    currentSceneHeight = 0;
                    currentSceneStartPage = pageNum;
                    currentSceneHeight += node.offsetHeight;
                } else {
                    if (currentSceneId) {
                        currentSceneHeight += node.offsetHeight;
                    }
                }
            });
        });
        
        if (currentSceneId) {
             const eighths = Math.max(1, Math.round((currentSceneHeight / this.sfss.CONTENT_HEIGHT_PX) * 8));
             sceneStats[currentSceneId] = { page: currentSceneStartPage, length: `${eighths}/8` };
        }
        document.body.removeChild(hiddenContainer);
        
        // 2. Build SmartType Lists
        const characters = new Set();
        const locations = new Set();
        const times = new Set();
        const extensions = new Set();
        
        this.sfss.editor.querySelectorAll('.script-line').forEach(block => {
            const type = this.sfss.editorHandler.getBlockType(block);
            const text = block.textContent.trim();
            if (type === constants.ELEMENT_TYPES.CHARACTER) {
                const clean = this.sfss.editorHandler.getCleanCharacterName(text);
                if (clean.length > 1) characters.add(clean);
                const extMatch = text.match(/\((.*?)\)/);
                if (extMatch) extensions.add(extMatch[1]);
            } else if (type === constants.ELEMENT_TYPES.SLUG) {
                const parts = text.split('-');
                if (parts.length > 0) locations.add(parts[0].trim());
                if (parts.length > 1) times.add(parts[parts.length - 1].trim());
            }
        });
        
        // 3. Generate XML
        let xml = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n<FinalDraft DocumentType="Script" Template="No" Version="1">\n<Content>\n`;
        let autoSceneIndex = 1;
        
        this.sfss.editor.querySelectorAll('.script-line').forEach(block => {
            const type = this.sfss.editorHandler.getBlockType(block);
            const fdxType = constants.FDX_MAP[type] || 'Action';
            const text = this.escapeXML(block.textContent);
            const id = block.dataset.lineId;
            let openTag = `<Paragraph Type="${fdxType}">`;
            
            if (type === constants.ELEMENT_TYPES.SLUG) {
                const stats = sceneStats[id] || { page: 1, length: "1/8" };
                const num = sceneNumberMap[id] || autoSceneIndex;
                const metaDesc = this.sfss.sceneMeta[id] && this.sfss.sceneMeta[id].description ? this.escapeXML(this.sfss.sceneMeta[id].description) : '';
                
                openTag = `<Paragraph Type="${fdxType}" Number="${num}">`;
                openTag += `<SceneProperties Length="${stats.length}" Page="${stats.page}" Title="">
`;
                if (metaDesc) {
                    openTag += `<Summary>
`;
                    const descLines = this.sfss.sceneMeta[id].description.split('\n');
                    descLines.forEach(line => {
                        openTag += `<Paragraph Alignment="Left" FirstIndent="0.00" Leading="Regular" LeftIndent="0.00" RightIndent="1.39" SpaceBefore="0" Spacing="1" StartsNewPage="No">
`;
                        openTag += `<Text AdornmentStyle="0" Background="#FFFFFFFFFFFF" Color="#000000000000" Font="Courier Final Draft" RevisionID="0" Size="12" Style="">${this.escapeXML(line)}</Text>
`;
                        openTag += `</Paragraph>
`;
                    });
                    openTag += `</Summary>
`;
                }
                openTag += `</SceneProperties>`;
                autoSceneIndex++;
            }
            xml += `${openTag}\n<Text>${text}</Text>\n</Paragraph>\n`;
        });
        
        xml += `</Content>\n`;
        
        // 4. Metadata Blocks
        xml += `<TitlePage>\n<Content>\n`;
        xml += `<Paragraph Alignment="Center"><Text>Title: ${this.escapeXML(this.sfss.meta.title)}</Text></Paragraph>\n`;
        xml += `<Paragraph Alignment="Center"><Text>Author: ${this.escapeXML(this.sfss.meta.author)}</Text></Paragraph>\n`;
        xml += `<Paragraph Alignment="Center"><Text>Contact: ${this.escapeXML(this.sfss.meta.contact)}</Text></Paragraph>\n`;
        xml += `</Content>\n</TitlePage>\n`;
        
        xml += `<SmartType>\n`;
        const addList = (name, set) => {
            xml += `<${name}>\n`;
            set.forEach(item => xml += `<${name.slice(0, -1)}>${this.escapeXML(item)}</${name.slice(0, -1)}>
`);
            xml += `</${name}>
`;
        };
        addList('Characters', characters);
        addList('Locations', locations);
        addList('Times', times);
        addList('Extensions', extensions);
        xml += `</SmartType>
`;
        xml += `</FinalDraft>`;
        
        const blob = new Blob([xml], {type: 'text/xml'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.sfss.meta.title || 'script'}.fdx`;
        a.click();
    }

    async downloadFountain() {
        try {
            await this.sfss.storageManager.updateBackupTimestamp(this.sfss.activeScriptId);
            const data = this.sfss.exportToJSONStructure();
            if (!this.sfss.fountainParser) {
                console.error("FountainParser not initialized");
                alert("Internal Error: Fountain Parser not loaded.");
                return;
            }
            const fountainText = this.sfss.fountainParser.generate(data);
            const blob = new Blob([fountainText], {type: 'text/plain;charset=utf-8'});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${this.sfss.meta.title || 'script'}.fountain`;
            a.click();
        } catch (e) {
            console.error("Download Fountain Error:", e);
            alert("Failed to generate Fountain file.");
        }
    }

    async downloadText() {
        await this.sfss.storageManager.updateBackupTimestamp(this.sfss.activeScriptId);
        const data = this.sfss.exportToJSONStructure();
        const textData = this.sfss.fountainParser.generate(data);
        const blob = new Blob([textData], {type: 'text/plain;charset=utf-8'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.sfss.meta.title || 'script'}.txt`;
        a.click();
    }

    printScript() {
        if (!this.sfss.pageViewActive) this.sfss.togglePageView();
        const style = document.createElement('style');
        style.id = 'print-style';
        let headerContent = (this.sfss.meta.title || 'Untitled Screenplay').replace(/"/g, "'");
        if (this.sfss.meta.showDate) {
            headerContent += ` / ${new Date().toLocaleDateString()}`;
        }
        style.innerHTML = `@media print { 
                                @page { 
                                    size: letter;
                                    margin-top: 1.0in;
                                    margin-bottom: 1.0in;
                                    margin-left: 1.5in;
                                    margin-right: 1.0in;
                                    @top-right { 
                                        content: "${headerContent}"; 
                                        font-size: 12pt; 
                                        font-family: 'Courier Prime', monospace; 
                                        color: #333;
                                    } 
                                    @bottom-center { 
                                        content: counter(page); 
                                        font-size: 12pt; 
                                        font-family: 'Courier Prime', monospace; color: #333; 
                                    } 
                                } 
                                @page :first { 
                                    @top-right { content: normal; } 
                                    @bottom-center { content: normal; } 
                                } 
                            }`;
        document.head.appendChild(style);
        window.print();
        const printStyle = document.getElementById('print-style');
        if (printStyle) printStyle.remove();
    }

    escapeXML(unsafe) {
        return unsafe.replace(/[<>&'"']/g, c => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    }
}
