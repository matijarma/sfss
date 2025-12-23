# Technical Specification: Screenplay Formatting Engine (PWA)

## 1. Core Axioms
* **The Golden Rule:** One page $\approx$ One minute of screen time.
* **The Unit:** The "Live Text Area" must remain constant ($6.0" \times 9.0"$) regardless of paper size.
* **The Pitch:** 12-point, 10-pitch monospaced font. 1 character = $0.10"$.
* **The Rhythm:** 6 lines per vertical inch (approx 4.23mm per line).

## 2. Typographic Constants (CSS/Rendering)
* **Font Family:** `Courier`, `Courier Prime`, or `Courier Final Draft`.
* **Font Size:** `12pt` (Strict).
* **Line Height:** `12pt` (or `100%`) to achieve exactly 6 lines per inch.
    * *Note:* No extra leading/padding between lines.
* **Character Width:** Fixed at `0.10in` (`2.54mm`).

## 3. Page Geometry & Margins

### 3.1. US Letter (The Native Standard)
* **Physical Dimensions:** $8.5in \times 11.0in$
* **Logic:** Standard margins create the "Golden Rectangle" of text.
* **CSS `@page` Settings:**
    * `size: letter;`
    * `margin-top: 1.0in;`
    * `margin-bottom: 1.0in;`
    * `margin-left: 1.5in;` (Binding offset)
    * `margin-right: 1.0in;`
* **Live Text Area:** $6.0in$ width $\times$ $9.0in$ height.

### 3.2. A4 Emulation Protocol (The Correction)
* **Physical Dimensions:** $210mm \times 297mm$ ($8.27in \times 11.69in$)
* **The Problem:** A4 is taller ($+0.69in$) and narrower ($-0.23in$) than US Letter.
* **The Fix:** Apply specific offsets to force US Letter text geometry onto A4 paper.
* **CSS `@page` Settings:**
    * `size: A4;`
    * `margin-top: 1.0in;`
    * **`margin-bottom: 1.7in;`** (CRITICAL: Absorbs excess vertical height to prevent timing drift).
    * `margin-left: 1.5in;` (Binding safe zone).
    * **`margin-right: 0.8in;`** (CRITICAL: Reduced to compensate for narrower paper, preventing line-wrap orphans).
* **Live Text Area:** $\approx 5.97in$ width $\times$ $\approx 8.99in$ height.

## 4. Element Indentation Logic
*Measurements are relative to the **Left Page Edge**. The Left Margin is defined as `1.5in`.*

| Element Type | Absolute Position (Left Edge) | Relative Indent (From Margin) | Alignment |
| :--- | :--- | :--- | :--- |
| **Scene Heading** | `1.5in` | `0in` | Left |
| **Action** | `1.5in` | `0in` | Left |
| **Dialogue** | `2.5in` | `1.0in` | Left |
| **Parenthetical** | `3.1in` | `1.6in` | Left |
| **Character** | `3.7in` | `2.2in` | Left |
| **Transition** | N/A | N/A | Right (`1.0in` from Right Margin) |
| **Page Number** | Right Aligned | `0.5in` from Top Edge | Right |

## 5. Pagination Logic (The "Page View")
* **Hard Limits:**
    * Max Lines Per Page: ~54-56 lines (strictly calculated by available height / line height).
* **Breaking Rules:**
    1.  **Orphans:** A single line of Action or Dialogue cannot be left at the bottom of a page. Move the block to the next page.
    2.  **Scene Headers:** A Scene Heading cannot be the last line of a page. It must carry at least 1 line of Action/Dialogue with it.
    3.  **Dialogue Splits:**
        * If a dialogue block is split, insert `(MORE)` centered at the bottom of Page A.
        * Insert `CHARACTER NAME (CONT'D)` at the top of Page B.
        * *Validation:* The `1.7in` bottom margin on A4 guarantees the `(MORE)` tag triggers at the correct vertical coordinate relative to US Letter.

## 6. Logic: Calculating "Eighths"
*Production Breakdown metric. 1 Page = 8/8.*

* **Formula:**
    $$Eighths = \frac{\text{Vertical Height of Scene (inches)}}{\text{Live Text Height (9.0 inches)}} \times 8$$
* **Implementation Steps:**
    1.  Measure vertical height from Scene Header start to next Scene Header start.
    2.  Exclude margins from calculation.
    3.  Round to the nearest whole integer (min 1, max 8 per page equivalent).

## 7. JavaScript Data Models (Reference)

```javascript
/**
 * Configuration for supported paper formats.
 * All measurements are in inches unless specified.
 */
const PAPER_CONFIGS = {
    US_LETTER: {
        name: "US Letter",
        cssSize: "letter", // for @page size
        dimensions: {
            width: 8.5,
            height: 11.0
        },
        margins: {
            top: 1.0,
            bottom: 1.0,
            left: 1.5,
            right: 1.0
        },
        liveArea: {
            width: 6.0,
            height: 9.0
        }
    },
    A4_EMULATION: {
        name: "A4 (US Emulation)",
        cssSize: "A4", // for @page size
        dimensions: {
            width: 8.27,
            height: 11.69
        },
        // Modified margins to force US Letter Text Block onto A4
        margins: {
            top: 1.0,
            bottom: 1.7, // "Heavy Footer"
            left: 1.5,
            right: 0.8   // "Right Margin Compromise"
        },
        liveArea: {
            width: 5.97, // ~6.0
            height: 8.99 // ~9.0
        }
    }
};

/**
 * Element Indentation Rules
 * relativeToMargin: Indent added to the base 1.5" margin
 */
const ELEMENT_STYLES = {
    SCENE_HEADING: { relativeToMargin: 0, textTransform: 'uppercase' },
    ACTION:        { relativeToMargin: 0 },
    DIALOGUE:      { relativeToMargin: 1.0 },
    PARENTHETICAL: { relativeToMargin: 1.6 },
    CHARACTER:     { relativeToMargin: 2.2, textTransform: 'uppercase' },
    TRANSITION:    { alignment: 'right' } // Special handling: 1.0" from right margin
};
```
## 8. CSS / Print Logic
### 8.1. Base CSS Variables

```css
:root {
    --font-std: 'Courier Prime', 'Courier', monospace;
    --line-height-std: 12pt;
    --char-width-std: 0.1in; /* 10 pitch */
}
```
### 8.2. Print Media Query
Objective: Remove UI elements and enforce page size strictly during print.

```css
@media print {
    /* Hide app UI */
    .toolbar, .sidebar, .nav { display: none; }

    /* Force specific paper handling */
    @page {
        size: auto; /* Let the specific class below override */
        margin: 0mm; /* Browser headers/footers removal */
    }

    /* Logic: App must apply one of these classes to the <body> or print container */
    
    .print-format-letter {
        width: 8.5in;
        height: 11in;
    }
    .print-format-letter .page-content {
        padding: 1in 1in 1in 1.5in; /* Top Right Bottom Left */
    }

    .print-format-a4 {
        width: 210mm;
        height: 297mm;
    }
    .print-format-a4 .page-content {
        /* The Emulation Padding */
        padding-top: 1in;
        padding-bottom: 1.7in;
        padding-left: 1.5in;
        padding-right: 0.8in;
    }
}
```