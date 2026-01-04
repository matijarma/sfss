import * as constants from './Constants.js';
import { PageRenderer } from './PageRenderer.js';

export class ReportsManager {
    constructor(app) {
        this.app = app;
        this.modal = document.getElementById('reports-modal');
        this.closeBtn = document.getElementById('reports-close-btn');
        this.charSelectContainer = document.getElementById('report-char-select-container');
        this.charSelect = document.getElementById('report-char-select');
        this.outputArea = document.getElementById('report-output');
        this.settingsArea = document.getElementById('report-settings');
        this.downloadTxtBtn = document.getElementById('report-download-txt-btn');
        this.downloadPdfBtn = document.getElementById('report-download-pdf-btn');
        
        this.currentReportData = null; 
        this.activeType = 'script';
        this.charColors = {};

        this.init();
    }

    init() {
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
        
        if (this.downloadTxtBtn) this.downloadTxtBtn.addEventListener('click', () => this.downloadTxt());
        if (this.downloadPdfBtn) this.downloadPdfBtn.addEventListener('click', () => this.printReport());

        const toggleBtns = this.settingsArea.querySelectorAll('.toggle-btn');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                toggleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeType = btn.dataset.value;
                this.updateUIForType();
            });
        });

        if (this.charSelect) {
            this.charSelect.addEventListener('change', () => {
                this.renderPlaceholder();
                this.downloadTxtBtn.classList.add('hidden');
                this.downloadPdfBtn.classList.add('hidden');
            });
        }

        this.modal.addEventListener('click', (e) => {
            if (e.target.id === 'reports-generate-btn') {
                this.generate();
            }
        });
    }

    open() {
        if (document.body.classList.contains('mobile-view')) this.app.sidebarManager.toggleMobileMenu();
        this.modal.classList.remove('hidden');
        this.resetUI();
        this.populateCharacterSelect();
        this.app.pushHistoryState('reports');
    }

    close() {
        this.modal.classList.add('hidden');
        this.outputArea.innerHTML = '';
        this.downloadTxtBtn.classList.add('hidden');
        this.downloadPdfBtn.classList.add('hidden');
    }

    resetUI() {
        this.activeType = 'script';
        const toggleBtns = this.settingsArea.querySelectorAll('.toggle-btn');
        toggleBtns.forEach(b => b.classList.toggle('active', b.dataset.value === 'script'));
        
        this.updateUIForType();
        this.renderPlaceholder();
        this.currentReportData = null;
        this.downloadTxtBtn.classList.add('hidden');
        this.downloadPdfBtn.classList.add('hidden');
    }

    renderPlaceholder() {
        this.outputArea.innerHTML = `
            <div class="report-placeholder placeholder-container">
                <i class="fas fa-chart-pie fa-3x placeholder-icon"></i>
                <button id="reports-generate-btn" class="modal-btn-primary">Generate Report</button>
            </div>
        `;
    }

    updateUIForType() {
        if (this.activeType === 'character') {
            this.charSelectContainer.classList.remove('hidden');
        } else {
            this.charSelectContainer.classList.add('hidden');
        }
        this.renderPlaceholder();
        this.downloadTxtBtn.classList.add('hidden');
        this.downloadPdfBtn.classList.add('hidden');
    }

    populateCharacterSelect() {
        this.charSelect.innerHTML = '';
        const chars = Array.from(this.app.characters).sort();
        chars.forEach(char => {
            const option = document.createElement('option');
            option.value = char;
            option.textContent = char;
            this.charSelect.appendChild(option);
        });
    }

    generate() {
        this.outputArea.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                <div class="loader-spinner"></div>
                <div class="loader-text">Analyzing Script...</div>
            </div>
        `;

        this.generateCharacterColors();

        setTimeout(() => {
            let content = '';
            let reportTitle = '';

            try {
                if (this.activeType === 'script') {
                    const data = this.calculateScriptStats();
                    content = this.renderScriptReport(data);
                    this.currentReportData = this.formatScriptReportTxt(data);
                    reportTitle = 'Script Report';
                } else if (this.activeType === 'character') {
                    const charName = this.charSelect.value;
                    if (!charName) throw new Error("Please select a character.");
                    const data = this.calculateCharacterStats(charName);
                    content = this.renderCharacterReport(data);
                    this.currentReportData = this.formatCharacterReportTxt(data);
                    reportTitle = `${charName} Analysis`;
                }

                this.outputArea.innerHTML = content;
                this.downloadTxtBtn.dataset.filename = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
                this.downloadTxtBtn.classList.remove('hidden');
                this.downloadPdfBtn.classList.remove('hidden');
            } catch (e) {
                console.error("Report Generation Error:", e);
                this.outputArea.innerHTML = `<div class="report-error">Error: ${e.message}</div>`;
            }
        }, 100);
    }

    generateCharacterColors() {
        const chars = Array.from(this.app.characters).sort();
        const isDark = document.documentElement.classList.contains('dark-mode');
        const saturation = isDark ? '65%' : '55%'; 
        const lightness = isDark ? '60%' : '45%';

        chars.forEach((char, index) => {
            const hue = Math.floor((index * 137.508) % 360);
            this.charColors[char] = `hsl(${hue}, ${saturation}, ${lightness})`;
        });
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\\]/g, '\\$&');
    }

    _getSourceBlocks() {
        if (this.app.treatmentManager.isActive && this.app.scriptData?.blocks) {
            // If in treatment mode, create DOM nodes in memory from scriptData
            const fragment = document.createDocumentFragment();
            this.app.scriptData.blocks.forEach(blockData => {
                const div = document.createElement('div');
                div.className = `script-line ${blockData.type}`;
                div.dataset.lineId = blockData.id;
                div.textContent = blockData.text;
                fragment.appendChild(div);
            });
            return Array.from(fragment.children);
        } else {
            // Otherwise, use the live editor DOM
            return Array.from(this.app.editor.querySelectorAll('.script-line'));
        }
    }

    getScenesWithGeometrics() {
        const renderer = new PageRenderer();
        const dummyContainer = document.createElement('div');
        Object.assign(dummyContainer.style, { position: 'absolute', left: '-9999px', width: '8.5in' });
        document.body.appendChild(dummyContainer);
        
        const sourceBlocks = this._getSourceBlocks();
        renderer.render(sourceBlocks, dummyContainer, { showSceneNumbers: true });
        
        const totalPages = dummyContainer.querySelectorAll('.page').length;
        const renderedPages = Array.from(dummyContainer.querySelectorAll('.page'));
        const sceneGeometries = [];
        let currentGeo = null;
        
        renderedPages.forEach((page, pageIdx) => {
            const wrapper = page.querySelector('.content-wrapper');
            Array.from(wrapper.children).forEach(node => {
                if (node.classList.contains(constants.ELEMENT_TYPES.SLUG)) {
                    if (currentGeo) sceneGeometries.push(currentGeo);
                    currentGeo = { heightPx: 0, pageStart: pageIdx + 1 };
                }
                if (currentGeo) currentGeo.heightPx += node.offsetHeight || 16;
            });
        });
        if (currentGeo) sceneGeometries.push(currentGeo);
        document.body.removeChild(dummyContainer);

        const PAGE_CONTENT_H = renderer.CONTENT_HEIGHT_PX || (9 * 96);
        return {
            totalPages,
            geometries: sceneGeometries.map(geo => ({
                ...geo,
                eighths: Math.max(1, Math.round((geo.heightPx / PAGE_CONTENT_H) * 8))
            }))
        };
    }

    calculateScriptStats() {
        const geoData = this.getScenesWithGeometrics();
        
        const stats = {
            totalPages: geoData.totalPages,
            totalScenes: 0,
            totalWords: 0,
            totalEighths: 0,
            intExt: { INT: 0, EXT: 0,OTHER: 0 },
            timeOfDay: { DAY: 0, NIGHT: 0, OTHER: 0 },
            elements: { Action: 0, Dialogue: 0, Character: 0, Slug: 0, Transition: 0, Parenthetical: 0 },
            elementWords: { Action: 0, Dialogue: 0 },
            scenes: [],
            monologues: [],
            longestScene: null,
            characters: {} 
        };

        const sourceBlocks = this._getSourceBlocks();
        
        const allChars = Array.from(this.app.characters).filter(c => c.length > 0);
        const charRegex = allChars.length > 0 
            ? new RegExp(`\\b(${allChars.map(c => this.escapeRegExp(c)).join('|')})\\b`, 'gi') 
            : null;

        let currentScene = null;
        let globalSceneIndex = 0;
        let lastSpeaker = null;

        allChars.forEach(c => {
            stats.characters[c] = { 
                name: c, speakingScenes: 0, nonSpeakingScenes: 0, words: 0 
            };
        });

        const finalizeScene = () => {
            if (currentScene) {
                stats.scenes.push(currentScene);
                currentScene.speakingCharacters.forEach(c => {
                    if (stats.characters[c]) stats.characters[c].speakingScenes++;
                });
                currentScene.mentionedCharacters.forEach(c => {
                    if (!currentScene.speakingCharacters.has(c)) {
                        if (stats.characters[c]) stats.characters[c].nonSpeakingScenes++;
                    }
                });
            }
        };

        sourceBlocks.forEach(block => {
            const type = this.app.editorHandler.getBlockType(block);
            const text = block.textContent;
            const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
            stats.totalWords += wordCount;

            const simpleType = type.replace('sc-', '');
            const readableType = simpleType.charAt(0).toUpperCase() + simpleType.slice(1);
            if (stats.elements[readableType] !== undefined) stats.elements[readableType]++;
            
            if (type === constants.ELEMENT_TYPES.ACTION) {
                stats.elementWords.Action += wordCount;
                if (currentScene && charRegex) {
                    let match;
                    charRegex.lastIndex = 0;
                    while ((match = charRegex.exec(text)) !== null) {
                        const matchedName = match[0].toUpperCase();
                        const canonicalName = this.app.editorHandler.getCleanCharacterName(matchedName);
                        if (canonicalName && stats.characters[canonicalName]) {
                             currentScene.mentionedCharacters.add(canonicalName);
                        }
                    }
                }
            }

            if (type === constants.ELEMENT_TYPES.DIALOGUE) {
                stats.elementWords.Dialogue += wordCount;
                if (wordCount > 30 && lastSpeaker) {
                    stats.monologues.push({ 
                        speaker: lastSpeaker, 
                        words: wordCount, 
                        text: text.substring(0, 50) + '...', 
                        scene: globalSceneIndex + 1 
                    });
                }
                if (lastSpeaker && stats.characters[lastSpeaker]) {
                    stats.characters[lastSpeaker].words += wordCount;
                }
            }

            if (type === constants.ELEMENT_TYPES.SLUG) {
                finalizeScene();
                
                const geo = geoData.geometries[globalSceneIndex] || { eighths: 1, pageStart: '-' };
                const upperText = text.toUpperCase();
                
                if (upperText.includes('INT.')) stats.intExt.INT++;
                else if (upperText.includes('EXT.')) stats.intExt.EXT++;
                else stats.intExt.OTHER++;

                if (upperText.includes('DAY')) stats.timeOfDay.DAY++;
                else if (upperText.includes('NIGHT')) stats.timeOfDay.NIGHT++;
                else stats.timeOfDay.OTHER++;

                currentScene = {
                    number: globalSceneIndex + 1,
                    title: text,
                    eighths: geo.eighths,
                    pageStart: geo.pageStart,
                    speakingCharacters: new Set(),
                    mentionedCharacters: new Set()
                };
                globalSceneIndex++;
                lastSpeaker = null;
            }

            if (currentScene) {
                if (type === constants.ELEMENT_TYPES.CHARACTER) {
                    const name = this.app.editorHandler.getCleanCharacterName(text);
                    if (name) {
                        currentScene.speakingCharacters.add(name);
                        lastSpeaker = name;
                    }
                }
            }
        });

        finalizeScene();
        stats.totalScenes = stats.scenes.length;
        stats.scenes.forEach(s => stats.totalEighths += s.eighths);
        
        stats.scenes.sort((a, b) => a.number - b.number);
        stats.longestScene = [...stats.scenes].sort((a, b) => b.eighths - a.eighths)[0];
        stats.monologues.sort((a, b) => b.words - a.words);

        return stats;
    }

    calculateCharacterStats(targetName) {
        const stats = {
            name: targetName,
            totalWords: 0,
            totalSpeeches: 0,
            scenesSpeaking: 0,
            scenesNonSpeaking: 0,
            interactions: {},
            scenes: [ ], 
            monologues: []
        };

        const sourceBlocks = this._getSourceBlocks();
        let currentScene = null;
        let lastSpeaker = null;
        let globalSceneIndex = 0;
        const targetNameRegex = new RegExp(`\\b${this.escapeRegExp(targetName)}\\b`, 'i');

        const flushScene = () => {
            if (currentScene) {
                if (currentScene.speaking) {
                    stats.scenesSpeaking++;
                    stats.scenes.push({ ...currentScene, type: 'speaking' });
                } else if (currentScene.mentioned) {
                    stats.scenesNonSpeaking++;
                    stats.scenes.push({ ...currentScene, type: 'non-speaking' });
                }
            }
        };

        sourceBlocks.forEach(block => {
            const type = this.app.editorHandler.getBlockType(block);
            const text = block.textContent;

            if (type === constants.ELEMENT_TYPES.SLUG) {
                flushScene();
                globalSceneIndex++;
                currentScene = { 
                    number: globalSceneIndex, 
                    title: text, 
                    words: 0, 
                    speaking: false,
                    mentioned: false
                };
                lastSpeaker = null;
            }

            if (currentScene) {
                if (type === constants.ELEMENT_TYPES.CHARACTER) {
                    const name = this.app.editorHandler.getCleanCharacterName(text);
                    if (name === targetName) {
                        currentScene.speaking = true;
                        stats.totalSpeeches++;
                        if (lastSpeaker && lastSpeaker !== targetName) {
                            stats.interactions[lastSpeaker] = (stats.interactions[lastSpeaker] || 0) + 1;
                        }
                    } else if (lastSpeaker === targetName) {
                        stats.interactions[name] = (stats.interactions[name] || 0) + 1;
                    }
                    lastSpeaker = name;
                } 
                else if (type === constants.ELEMENT_TYPES.DIALOGUE) {
                    if (lastSpeaker === targetName) {
                        const w = text.trim().split(/\s+/).length;
                        stats.totalWords += w;
                        currentScene.words += w;
                        if (w > 30) {
                            stats.monologues.push({ words: w, text: text.substring(0, 50) + '...', scene: currentScene.number });
                        }
                    }
                }
                else if (type === constants.ELEMENT_TYPES.ACTION) {
                    if (!currentScene.speaking && targetNameRegex.test(text)) {
                        currentScene.mentioned = true;
                    }
                }
            }
        });
        flushScene();

        stats.monologues.sort((a, b) => b.words - a.words);
        return stats;
    }

    renderPieChart(label, data, colors) {
        const total = Object.values(data).reduce((a, b) => a + b, 0);
        let conicStops = [];
        let currentDeg = 0;
        
        Object.entries(data).forEach(([key, val], idx) => {
            const deg = (val / total) * 360;
            const color = colors[idx % colors.length];
            conicStops.push(`${color} ${currentDeg}deg ${currentDeg + deg}deg`);
            currentDeg += deg;
        });

        const chartStyle = `background: conic-gradient(${conicStops.join(', ')}); width: 80px; height: 80px; border-radius: 50%;`;
        const legendHtml = Object.entries(data).map(([key, val], idx) => `
            <div class="chart-legend-row">
                <span class="chart-legend-dot" style="background:${colors[idx % colors.length]};"></span>
                <span>${key} (${Math.round(val/total*100)}%)</span>
            </div>
        `).join('');

        return `
            <div class="chart-container-flex">
                <div style="${chartStyle}"></div>
                <div class="chart-legend-col">${legendHtml}</div>
            </div>
        `;
    }

    renderCharacterBadge(name, isSpeaking) {
        const color = this.charColors[name] || '#666';
        const className = isSpeaking ? 'badge-custom' : 'badge-custom-outline';
        return `<span class="badge ${className}" style="--badge-color: ${color}" title="${isSpeaking ? 'Speaking' : 'Non-Speaking'}">${name}</span>`;
    }

    renderScriptReport(data) {
        const sortedChars = Object.values(data.characters).sort((a, b) => 
            (b.speakingScenes + b.nonSpeakingScenes) - (a.speakingScenes + a.nonSpeakingScenes)
        );

        return `
            <div class="report-container">
                <div class="report-dashboard">
                    <div class="kpi-card">
                        <div class="kpi-value">${data.totalPages}</div>
                        <div class="kpi-label">Pages</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${data.totalScenes}</div>
                        <div class="kpi-label">Scenes</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${(data.totalWords / 1000).toFixed(1)}k</div>
                        <div class="kpi-label">Words</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${this.formatEighths(data.totalEighths)}</div>
                        <div class="kpi-label">Runtime</div>
                    </div>
                </div>

                <div class="report-grid-2">
                    <div class="report-section">
                        <h3>Breakdown</h3>
                        <div class="flex-justify-between-full flex-wrap-gap-4">
                            <div>
                                <h4 class="report-subtitle-centered">Setting</h4>
                                ${this.renderPieChart('Setting', data.intExt, ['#3b82f6', '#10b981', '#6b7280'])}
                            </div>
                            <div>
                                <h4 class="report-subtitle-centered">Time</h4>
                                ${this.renderPieChart('Time', data.timeOfDay, ['#f59e0b', '#1e293b', '#6b7280'])}
                            </div>
                        </div>
                    </div>

                    <div class="report-section">
                        <h3>Character Statistics</h3>
                        <div class="report-table-scroll-container">
                            <table class="report-table">
                                <thead class="report-table-sticky-thead">
                                    <tr>
                                        <th>Character</th>
                                        <th class="text-center">Speaking</th>
                                        <th class="text-center">Non-Speaking</th>
                                        <th class="text-right">Words</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sortedChars.map(c => `
                                        <tr>
                                            <td class="font-bold" style="color:${this.charColors[c.name]};">${c.name}</td>
                                            <td class="text-center font-mono">${c.speakingScenes}</td>
                                            <td class="text-center font-mono text-faded">${c.nonSpeakingScenes}</td>
                                            <td class="text-right font-mono">${c.words}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="report-section">
                    <h3>Scene Chronology</h3>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th style="width:3%">#</th>
                                <th style="width:8%">Len</th>
                                <th style="width:30%">Slug</th>
                                <th>Characters (Solid=Speaking, Outline=Non-Speaking)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.scenes.map(s => {
                                const badges = [];
                                s.speakingCharacters.forEach(c => badges.push(this.renderCharacterBadge(c, true)));
                                s.mentionedCharacters.forEach(c => {
                                    if(!s.speakingCharacters.has(c)) badges.push(this.renderCharacterBadge(c, false));
                                });
                                return `
                                <tr>
                                    <td class="text-faded text-sm">${s.number}</td>
                                    <td class="font-mono text-sm">${this.formatEighths(s.eighths)}</td>
                                    <td class="font-bold text-sm truncate" title="${s.title}">${s.title}</td>
                                    <td>
                                        <div class="flex-wrap-gap-4">
                                            ${badges.join('')}
                                        </div>
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="report-section">
                    <h3>Top Monologues</h3>
                    <div class="report-grid-2">
                        ${data.monologues.slice(0, 4).map(m => `
                             <div class="stat-item monologue-item">
                                <div class="flex-justify-between-full">
                                    <span class="font-bold" style="color:${this.charColors[m.speaker]}">${m.speaker}</span>
                                    <span class="text-faded text-sm">Sc ${m.scene} • ${m.words}w</span>
                                </div>
                                <div class="text-italic-faded">"${m.text}"</div>
                             </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderCharacterReport(data) {
        const sortedInteractions = Object.entries(data.interactions)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        return `
            <div class="report-container">
                <div class="report-header">
                    <h2 style="color:${this.charColors[data.name]}">${data.name}</h2>
                    <div class="flex-gap-05">
                         <span class="badge speaking">${data.scenesSpeaking} Speaking Scenes</span>
                         <span class="badge non-speaking">${data.scenesNonSpeaking} Non-Speaking</span>
                    </div>
                </div>

                <div class="report-dashboard">
                    <div class="kpi-card">
                        <div class="kpi-value">${data.totalSpeeches}</div>
                        <div class="kpi-label">Speeches</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${data.totalWords}</div>
                        <div class="kpi-label">Words</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${data.totalSpeeches ? Math.round(data.totalWords / data.totalSpeeches) : 0}</div>
                        <div class="kpi-label">Words/Speech</div>
                    </div>
                </div>

                <div class="report-grid-2">
                    <div class="report-section">
                        <h3>Top Interactions</h3>
                        <table class="report-table">
                            ${sortedInteractions.map(([name, count]) => `
                                <tr>
                                    <td>${name}</td>
                                    <td class="text-right font-mono">${count} exchanges</td>
                                </tr>
                            `).join('')}
                            ${sortedInteractions.length === 0 ? '<tr><td class="text-faded">No dialogue interactions.</td></tr>' : ''}
                        </table>
                    </div>

                    <div class="report-section">
                         <h3>Stats</h3>
                         <div class="stat-item">
                            <span>Scene Presence</span>
                            <span class="font-mono">${Math.round((data.scenes.length / (this.app.editor.querySelectorAll('.sc-slug').length || 1))*100)}% of Script</span>
                         </div>
                    </div>
                </div>

                <div class="report-section">
                    <h3>Scene Log</h3>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th style="width:10%">#</th>
                                <th>Slug</th>
                                <th class="text-center">Type</th>
                                <th class="text-right">Words</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.scenes.map(s => `
                                <tr>
                                    <td class="text-faded">${s.number}</td>
                                    <td class="font-bold text-sm truncate" title="${s.title}">${s.title}</td>
                                    <td class="text-center">
                                        <span class="badge ${s.type === 'speaking' ? 'speaking' : 'non-speaking'}">
                                            ${s.type}
                                        </span>
                                    </td>
                                    <td class="text-right font-mono">${s.words}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    formatEighths(e) {
        if (e < 8) return `${e}/8`;
        const p = Math.floor(e/8);
        const rem = e % 8;
        return rem === 0 ? `${p}pg` : `${p} ${rem}/8`;
    }

    formatScriptReportTxt(data) {
        let txt = `SCRIPT REPORT\n`;
        txt += `Pages: ${(data.totalEighths/8).toFixed(2)}\nScenes: ${data.totalScenes}\nWords: ${data.totalWords}\n\n`;
        txt += `CHARACTERS\n`;
        Object.values(data.characters)
            .sort((a,b) => b.words - a.words)
            .forEach(c => {
                txt += `${c.name}: ${c.speakingScenes} spk, ${c.nonSpeakingScenes} non-spk, ${c.words} words\n`;
            });
        txt += `\nSCENES\n`;
        data.scenes.forEach(s => {
            const speaking = Array.from(s.speakingCharacters).join(', ');
            const nonSpeaking = Array.from(s.mentionedCharacters).filter(c => !s.speakingCharacters.has(c)).join(', ');
            txt += `${s.number}. ${s.title} (${this.formatEighths(s.eighths)})\n`;
            if(speaking) txt += `   Speaking: ${speaking}\n`;
            if(nonSpeaking) txt += `   Non-Speaking: ${nonSpeaking}\n`;
        });
        return txt;
    }

    formatCharacterReportTxt(data) {
        let txt = `CHARACTER: ${data.name}\n`;
        txt += `Speeches: ${data.totalSpeeches}\nWords: ${data.totalWords}\nScenes: ${data.scenesSpeaking} (Speaking), ${data.scenesNonSpeaking} (Non-speaking)\n\n`;
        txt += `SCENE LOG\n`;
        data.scenes.forEach(s => {
            txt += `${s.number}. ${s.title} [${s.type.toUpperCase()}] (${s.words} words)\n`;
        });
        return txt;
    }

    collectSceneBlocks() {
        const data = this.app.scriptData || this.app.exportToJSONStructure() || {};
        const blocks = data.blocks || [];
        const scenes = [];
        let current = null;
        blocks.forEach(block => {
            if (block.type === constants.ELEMENT_TYPES.SLUG) {
                if (current) scenes.push(current);
                current = { slug: block, slugText: block.text || 'UNTITLED', id: block.id || block.slugId || block.text, blocks: [] };
            } else if (current) {
                current.blocks.push(block);
            }
        });
        if (current) scenes.push(current);
        return scenes;
    }

    collectScenesForCharacter(targetChar) {
        const scenes = this.collectSceneBlocks();
        const target = (targetChar || '').trim().toUpperCase();
        const cleanCharacter = (name = '') => name.replace(/\(.*?\)/g, '').trim().toUpperCase();
        const ids = [];
        scenes.forEach(scene => {
            const hasChar = scene.blocks.some(b => b.type === constants.ELEMENT_TYPES.CHARACTER && cleanCharacter(b.text || '') === target);
            if (hasChar) ids.push(scene.slug?.id || scene.id || scene.slugText);
        });
        return ids;
    }

    buildCharacterDialogues(targetChar) {
        const scenes = this.collectSceneBlocks();
        const targetUpper = (targetChar || '').toUpperCase();
        const clusters = [];

        const cleanCharacter = (name = '') => name.replace(/\(.*?\)/g, '').trim().toUpperCase();

        scenes.forEach(scene => {
            let activeSpeaker = null;
            let currentCluster = [];
            let clusterHasTarget = false;
            const sceneClusters = [];
            let nonTargetSinceTarget = false;

            const flushCluster = () => {
                if (!currentCluster.length) return;
                if (clusterHasTarget) sceneClusters.push(currentCluster);
                currentCluster = [];
                clusterHasTarget = false;
                nonTargetSinceTarget = false;
            };

            const dialogueTypes = new Set([
                constants.ELEMENT_TYPES.CHARACTER,
                constants.ELEMENT_TYPES.PARENTHETICAL,
                constants.ELEMENT_TYPES.DIALOGUE
            ]);

            scene.blocks.forEach(block => {
                if (block.type === constants.ELEMENT_TYPES.SLUG || block.type === constants.ELEMENT_TYPES.ACTION || block.type === constants.ELEMENT_TYPES.TRANSITION) {
                    activeSpeaker = null;
                    flushCluster();
                    return;
                }
                if (!dialogueTypes.has(block.type)) return;

                if (block.type === constants.ELEMENT_TYPES.CHARACTER) {
                    activeSpeaker = cleanCharacter(block.text || '');
                }
                if (!activeSpeaker) return;

                const isTarget = activeSpeaker === targetUpper;
                if (isTarget && clusterHasTarget && nonTargetSinceTarget) {
                    flushCluster();
                }
                if (isTarget) {
                    clusterHasTarget = true;
                    nonTargetSinceTarget = false;
                } else if (clusterHasTarget) {
                    nonTargetSinceTarget = true;
                }

                currentCluster.push({
                    type: block.type,
                    text: block.text || '',
                    speaker: activeSpeaker,
                    isTarget
                });
            });
            flushCluster();

            if (sceneClusters.length > 0) {
                clusters.push({
                    slug: (scene.slugText || 'UNTITLED').toUpperCase(),
                    clusters: sceneClusters
                });
            }
        });

        return clusters;
    }

    renderCharacterDialogues(character, dialogueData = []) {
        if (!dialogueData.length) return '<div class="report-section"><h3>Dialogues</h3><div class="report-error">No dialogue found for this character.</div></div>';
        const escape = (str = '') => str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const blocksToHtml = (blocks) => blocks.map(b => {
            const cls = `script-line ${b.type} ${b.isTarget ? '' : 'counterpart-line'}`.trim();
            const speakerLabel = b.type === constants.ELEMENT_TYPES.CHARACTER ? escape(b.speaker || '') : '';
            const text = escape(b.text || '');
            if (b.type === constants.ELEMENT_TYPES.CHARACTER) return `<div class="${cls}">${speakerLabel}</div>`;
            if (b.type === constants.ELEMENT_TYPES.PARENTHETICAL) return `<div class="${cls}">(${text})</div>`;
            return `<div class="${cls}">${text}</div>`;
        }).join('');

        const sceneHtml = dialogueData.map(scene => {
            const clusters = scene.clusters.map((cluster, idx) => {
                const separator = idx > 0 ? `<div class="dialogue-separator">* * *</div>` : '';
                return `${separator}<div class="dialogue-cluster">${blocksToHtml(cluster)}</div>`;
            }).join('');
            return `
                <div class="dialogue-excerpt">
                    <div class="script-line sc-slug">${escape(scene.slug)}</div>
                    ${clusters}
                </div>
            `;
        }).join('');

        return `
            <div class="report-section">
                <h3>Dialogues (${character})</h3>
                <div class="dialogue-section-wrap">
                    ${sceneHtml}
                </div>
            </div>
        `;
    }

    downloadTxt() {
        if (!this.currentReportData) return;
        const blob = new Blob([this.currentReportData], {type: 'text/plain;charset=utf-8'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = this.downloadTxtBtn.dataset.filename || 'report.txt';
        a.click();
    }

    printReport() {
        const character = this.activeType === 'character' ? this.charSelect.value : '';
        this.app.printManager.openReportMode({ type: this.activeType, character });
        this.close();
    }

    buildPrintableReport(type = 'script', { character, includeDialogues, includeScenes } = {}) {
        const reportType = type || 'script';
        this.generateCharacterColors();

        if (reportType === 'character') {
            const characters = Array.from(this.app.characters || []).sort();
            const targetChar = character || characters[0] || '';
            if (!targetChar) {
                return { title: 'Character Report', subtitle: '', html: '<div class="report-error">No characters found.</div>', message: 'No characters found.' };
            }
            const data = this.calculateCharacterStats(targetChar);
            const dlgFlag = includeDialogues !== undefined ? !!includeDialogues : true;
            const sceneFlag = includeScenes !== undefined ? !!includeScenes : false;
            const dialogueData = dlgFlag ? this.buildCharacterDialogues(targetChar) : [];
            const sceneIds = sceneFlag ? this.collectScenesForCharacter(targetChar) : [];
            return {
                title: `${targetChar} Report`,
                subtitle: this.app.meta.title || 'Character Analysis',
                html: this.renderCharacterReport(data),
                dialogueData,
                sceneIds,
                includeDialogues: dlgFlag,
                includeScenes: sceneFlag
            };
        }

        const data = this.calculateScriptStats();
        return {
            title: 'Script Report',
            subtitle: this.app.meta.title || 'Story Overview',
            html: this.renderScriptReport(data)
        };
    }
}
