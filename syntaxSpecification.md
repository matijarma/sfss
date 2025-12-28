# **Comprehensive Technical Specification: Fountain and FDX Syntax Architecture for Screenplay Application Development**

## **1\. Executive Summary and Architectural Standards**

The development of a professional-grade screenplay writing application necessitates a rigorous, bite-level understanding of the two dominant data interchange formats in the modern film and television industry: **Fountain** and **Final Draft XML (FDX)**. While both standards aim to produce a document that adheres to the strict formatting conventions established during the Hollywood studio era—specifically the "one page equals one minute" metric using Courier 12-point font—they represent diametrically opposed engineering philosophies.

Fountain is a syntax-based, plain-text markup language designed for portability, interoperability, and future-proofing. It relies on context-sensitive parsing and visual heuristics to interpret screenplay elements.1 In contrast, FDX (Final Draft XML) is a verbose, explicit, and attribute-heavy XML schema designed to preserve production data, revision history, and precise layout specifications down to the pixel.1

This report serves as the definitive technical source of truth for engineering teams tasked with constructing the Input/Output (I/O) layer of a screenwriting application. It provides an exhaustive analysis of the syntactic rules, tag hierarchies, and conversion logic required to losslessly read (open) and write (save) both formats. The analysis is structured to guide the creation of a unified Abstract Syntax Tree (AST) or internal data model capable of reconciling the flexibility of Fountain with the rigidity of FDX.

### **1.1 The Divergence of Data Models**

To architect a robust internal "Script Model," engineers must first understand the fundamental incompatibility between the implicit nature of Fountain and the explicit nature of FDX. A successful application acts as a translation engine between these two paradigms.

| Feature Domain | Fountain (Plain Text) | Final Draft FDX (XML) | Architectural Implication |
| :---- | :---- | :---- | :---- |
| **Data Structure** | Line-based, sequential text stream. | DOM-based hierarchical XML tree. | The internal model must be sequential (like Fountain) but hold rich metadata (like FDX). |
| **Element Typing** | Implicit; derived from capitalization, spacing, and regex patterns. | Explicit; defined by the Type attribute (e.g., Type="Action"). | The parser must contain a "heuristic engine" for Fountain import to assign strict types for FDX export. |
| **Visual Formatting** | Deferred; the renderer decides margins at output time. | Immediate; margins (LeftIndent) and styles are hard-coded in attributes. | The app must implement a "virtual typesetting" engine to calculate layout on the fly for FDX export. |
| **Metadata Storage** | Key-Value pairs at the start of the file. | Dedicated nodes (\<TitlePage\>, \<SmartType\>). | Metadata objects must be distinct from the script content body. |
| **Revision Tracking** | Not natively supported (plain text diffing only). | granular support (\<RevisionID\>, \<Revision\> sets). | The model must support a "Revision Layer" that is serialized to FDX but potentially flattened for Fountain. |

### **1.2 The "Source of Truth" Hierarchy**

For the purposes of this specification, the "Source of Truth" is defined by the following hierarchy of precedence:

1. **Explicit Syntax Rules:** Hard constraints defined in the Fountain syntax documentation 1 and the XML structure observed in valid FDX files.1  
2. **Forced Interpretation:** Syntax that overrides heuristics (e.g., Fountain's forced scene heading .).  
3. **Visual Convention:** Industry standards for layout that inform how undefined attributes (like FDX margins) should be calculated when converting from Fountain.

## ---

**2\. The Fountain Syntax Specification: Heuristic Parsing Logic**

Fountain is a markdown-inspired syntax. Its "Golden Rule" states that the syntax should resemble a screenplay even in its raw text form.1 For a software parser, this implies that the interpretative logic must be robust enough to distinguish between a Character name and an Action line without explicit tags, relying heavily on line breaks and capitalization patterns.

### **2.1 The Force Methodology**

A critical requirement for any Fountain parser is the implementation of "Forcing." Because Fountain relies on heuristics, ambiguities are inevitable. The syntax provides specific characters to override the parser's automated logic. These characters must be parsed to determine the element type but stripped from the final content model/display.

* **Forced Scene Heading (.):** Any line beginning with a period is strictly a Scene Heading, regardless of its content. This prevents lines like "SNIPER SCOPE POV" from being misread as Action.1  
* **Forced Action (\!):** Any line beginning with an exclamation point is strictly Action. This allows writers to start action lines with uppercase words without triggering Character recognition (e.g., \!LOUD NOISES startle him.).1  
* **Forced Character (@):** Any line beginning with an "at" symbol is strictly a Character. This supports names with lowercase letters (e.g., @McCLANE) or non-Roman scripts.1  
* **Forced Transition (\>):** Any line beginning with a greater-than symbol is strictly a Transition. This supports transitions that do not end in standard phrases like "TO:" (e.g., \> FADE OUT).1

### **2.2 Scene Headings (Sluglines)**

The Scene Heading is the primary structural unit of a screenplay, breaking the narrative into schedulable events.

#### **2.2.1 Parsing Logic**

The parser must identify a line as a Scene Heading if it meets **all** of the following criteria:

1. It is preceded by a blank line (newline).  
2. It begins with one of the standard prefixes: INT, EXT, EST, INT./EXT, INT/EXT, or I/E (case-insensitive).  
3. The prefix is immediately followed by a period . or a space.1

**Valid Examples:**

* EXT. FIELD \- DAY  
* int. car \- night  
* I/E SPACESHIP \- CONTINUOUS

#### **2.2.2 Scene Numbers**

Scene numbers are essential for production drafts. In Fountain, they are appended to the Scene Heading line, enclosed in hash marks \#.

* **Input Syntax:** EXT. HOUSE \- DAY \#1A\#  
* **Parsing Action:** The parser must extract the string 1A from the hashes, store it as the Scene Number property of the element, and remove the hashes from the display text. The FDX export will later map this to the Number attribute of the \<Paragraph\> tag.1

### **2.3 Action (Scene Description)**

Action is the default element. If a block of text cannot be identified as a Scene Heading, Character, Dialogue, Transition, or Metadata, it is parsed as Action.1

#### **2.3.1 Line Break Integrity**

Unlike standard HTML or Markdown parsers which often collapse adjacent lines into a single paragraph, a Fountain parser must respect **single line breaks**. Screenwriting relies on "white space" to control pacing.

* Input:  
  He looks.  
  He leaps.  
* **Output:** Two distinct Action elements (or one element with a preserved newline), not a single continuous paragraph.1

#### **2.3.2 Centered Text**

Centered text is a stylistic variation of Action, often used for "The End" or titles within the script.

* **Syntax:** Text enclosed in greater-than and less-than signs: \> THE END \<.  
* **Parsing Action:** The parser strips the \> and \< wrappers and sets the alignment property of the Action element to Center. Spaces between the wrapper and text are optional and should be trimmed.1

### **2.4 Character Elements**

The parser's ability to distinguish Character names from Action is the most critical logic gate in the system.

#### **2.4.1 Recognition Rules**

A line is parsed as a Character if:

1. It is preceded by a blank line.  
2. It is entirely in **UPPERCASE**.  
3. It is immediately followed by a line of text (which becomes Dialogue).  
4. It is *not* a Scene Heading (does not start with INT./EXT.).

**Exceptions and Nuances:**

* **Extensions:** Parentheticals on the same line as the name (e.g., (V.O.), (O.S.)) are permitted. These extensions may contain lowercase letters.1  
* **Numbers:** Character names may contain numbers (e.g., R2D2), but they must contain at least one alphabetical character. A line like 23 is Action; R2D2 is Character.1

### **2.5 Dialogue and Parentheticals**

Dialogue is the content inextricably linked to a Character element.

#### **2.5.1 Dialogue Parsing**

Any text immediately following a Character element (or a Parenthetical) is Dialogue.

* **Internal Line Breaks:** Writers may force line breaks within dialogue.  
* **Empty Lines:** If a writer wishes to insert a visual blank line inside a dialogue speech without breaking the block, they must use **two spaces** on the empty line. A standard empty newline (without spaces) terminates the Dialogue element and resets the parser to expect Action or a new Character.1

#### **2.5.2 Parentheticals**

Parentheticals act as acting directions.

* **Syntax:** Wrapped in parentheses () on a separate line.  
* **Context:** They must appear *after* a Character element and *before* or *between* Dialogue lines.  
* **Parsing Action:** The text inside parentheses is extracted. The renderer typically indents this further than dialogue (e.g., 3.0" indent).1

#### **2.5.3 Dual Dialogue**

Dual Dialogue represents two characters speaking simultaneously.

* **Syntax:** A caret ^ is placed after the *second* Character's name.  
  Code snippet  
  SIMON  
  Go left\!

  ALVIN ^  
  Go right\!

* **Parsing Action:** Upon encountering the caret, the parser must link the current Character/Dialogue block with the *immediately preceding* Character/Dialogue block. In the internal model, these two blocks form a "Dual Dialogue Group" to be rendered side-by-side.1

### **2.6 Transitions**

Transitions indicate editorial cuts.

#### **2.6.1 Recognition Rules**

A line is parsed as a Transition if:

1. It is in **UPPERCASE**.  
2. It is preceded and followed by blank lines.  
3. It ends in TO:.

**Examples:** CUT TO:, FADE OUT TO:.

#### **2.6.2 Forced Transitions**

If a transition does not end in TO:, it must be forced with a leading \>.

* **Input:** \> FADE TO BLACK.  
* **Output:** FADE TO BLACK. (Type: Transition).1

### **2.7 Structural Metadata: Sections and Synopses**

Fountain allows writers to structure their document without affecting the printed output.

* **Sections:** Lines starting with one or more hashes \# denote structural depth.  
  * \# Act 1 (Level 1\)  
  * \#\# Sequence 2 (Level 2\)  
  * \#\#\# Scene 5 (Level 3\)  
* **Synopses:** Lines starting with an equals sign \= denote a summary of the section or scene below it.  
  * \= Creating the monster.  
* **Usage:** These elements must be parsed into the document's navigation tree (Outline View) but strictly excluded from the "Script Content" stream used for pagination and printing.1

### **2.8 Formatting (Emphasis)**

Fountain uses a restricted subset of Markdown for text styling.

* **Bold:** \*\*text\*\*  
* **Italics:** \*text\*  
* **Underline:** \_text\_  
* **Bold Italic:** \*\*\*text\*\*\*  
* **Underline Italic:** \_\*text\*\_

**Note:** Unlike standard Markdown where underscores can denote italics, Fountain strictly reserves underscores \_ for **underlining**, a crucial formatting requirement in screenplays.1 The parser must handle escaped characters (e.g., \\\*) to allow literal asterisks.

### **2.9 The Boneyard (Comments)**

Text enclosed in C-style block comments /\*... \*/ is defined as the "Boneyard."

* **Behavior:** This content is completely ignored by the pagination and printing engines. It serves as a repository for cut scenes or alternative dialogue.  
* **Mapping:** When converting to FDX, Boneyard content does not have a direct 1:1 paragraph type, but inline notes \[\[Note\]\] usually map to FDX ScriptNotes.1

## ---

**3\. The Final Draft (FDX) XML Specification**

While Fountain is human-readable, FDX (Final Draft XML) is machine-readable. It is strictly hierarchical and preserves not just the text, but the *state* of the application (window positions, cursor location) and production metadata (scene lengths, omits). The following analysis breaks down the XML structure required to generate a valid .fdx file.1

### **3.1 Root Document Structure**

The file must begin with the XML declaration \<?xml version="1.0" encoding="UTF-8" standalone="no"?\>. The root element is \<FinalDraft\>.

**Root Attributes:**

* DocumentType: Must be set to "Script".  
* Template: "Yes" or "No".  
* Version: Integer indicating the schema version (e.g., "1" or "4").1

**High-Level Child Elements:**

* \<Content\>: The container for the entire script body.  
* \<TitlePage\>: A self-contained document definition for the title page.  
* \<HeaderAndFooter\>: Definitions for running headers.  
* \<SmartType\>: Lists for auto-complete data.  
* \<Revisions\>: Definitions of revision sets.  
* \<ScriptNote\>: Definitions of floating notes.

### **3.2 The Paragraph Architecture**

The \<Paragraph\> element is the atomic unit of the FDX format. It sits within \<Content\>.

#### **3.2.1 Paragraph Types**

The Type attribute defines the semantic role of the text. The software must strictly map internal element types to these string values:

* "General": Used for non-standard text or the opening "FADE IN".  
* "Scene Heading": Equivalent to Fountain Sluglines.  
* "Action": Equivalent to Fountain Action.  
* "Character": Equivalent to Fountain Character.  
* "Dialogue": Equivalent to Fountain Dialogue.  
* "Parenthetical": Equivalent to Fountain Parentheticals.  
* "Transition": Equivalent to Fountain Transitions.  
* "Shot": Used for camera angles (e.g., "ANGLE ON").  
* "Cast List": Used in TV templates.8

#### **3.2.2 Formatting Attributes**

Each \<Paragraph\> tag explicitly defines its layout. While Fountain relies on defaults, FDX demands specific measurements.

* Alignment: "Left", "Center", "Right".  
* FirstIndent: Indentation of the first line (inches).  
* Leading: Line spacing style ("Regular").  
* LeftIndent: Distance from the left margin (inches).  
* RightIndent: Distance from the right margin (inches).  
* SpaceBefore: Vertical space before the paragraph (measured in lines, e.g., "1" or "2").7

**Insight:** To ensure FDX files open correctly in Final Draft without layout shifting, the software developer must hard-code these indent values to standard industry metrics (e.g., Dialogue Left Indent \= 2.5") during the export process.

### **3.3 Text Representation and Style**

Content is not placed directly into the \<Paragraph\> tag. It is nested inside one or more \<Text\> tags.

**XML Structure:**

XML

\<Paragraph Type\="Action"\>  
    \<Text\>The alien \</Text\>  
    \<Text Style\="Bold"\>SCREAMS\</Text\>  
    \<Text\>.\</Text\>  
\</Paragraph\>

**Attributes:**

* Style: A string combining styles, e.g., "Bold+Underline".  
* AdornmentStyle: Integer (0 or \-1).  
* Background: Hex code (ARGB) for highlighting (e.g., \#FFFFFFFFFFFF).  
* Color: Hex code for text color.  
* Font: Font family (e.g., "Courier Final Draft").  
* Size: Font size (e.g., "12").  
* RevisionID: An integer linking the text to a Revision Set defined in \<Revisions\>.1

### **3.4 Scene Properties and Pagination**

FDX requires pre-calculated production data for Scene Headings.

**Element:** \<SceneProperties\> (Child of \<Paragraph Type="Scene Heading"\>)

* Length: The length of the scene measured in **eighths** of a page (e.g., "5/8").  
* Page: The page number where the scene starts.  
* Title: Custom scene title (often empty).1

**Implication:** The software cannot simply dump text into XML. It must run a pagination algorithm *before* saving to FDX to calculate the Length and Page attributes. If these are missing or set to "0", Final Draft may display the script incorrectly or fail to generate reports.

### **3.5 The Title Page Sub-Document**

The \<TitlePage\> element acts as a mini-FDX file embedded within the main file. It does not use the key-value pairs of Fountain; it uses absolute positioning.

**Structure:**

XML

\<TitlePage\>  
    \<Content\>  
        \<Paragraph Alignment\="Center"\>  
            \<Text\>SCRIPT TITLE\</Text\>  
        \</Paragraph\>  
       ...  
    \</Content\>  
\</TitlePage\>

The developer must map the Fountain keys (Title:, Author:) to specific \<Paragraph\> blocks with appropriate vertical spacing (SpaceBefore) to center them on the page visually.4

### **3.6 SmartType and Autocomplete**

Final Draft relies on \<SmartType\> lists to provide autocomplete functionality.

**Structure:**

XML

\<SmartType\>  
    \<Characters\>  
        \<Character\>EDWARD\</Character\>  
        \<Character\>WILL\</Character\>  
    \</Characters\>  
    \<Locations\>  
        \<Location\>RIVER\</Location\>  
    \</Locations\>  
   ...  
\</SmartType\>

When saving an FDX file, the software must scan the script, extract unique Character names and Locations, and populate these lists. Failure to do so will result in an empty autocomplete cache when the user opens the file in Final Draft.7

### **3.7 Revision Handling**

Revisions are tracked via the \<Revisions\> definitions and the RevisionID attribute on \<Text\> tags.

**Definition Block:**

XML

\<Revisions\>  
    \<Revision Color\="\#0000FF" ID\="1" Mark\="\*" Name\="Blue Rev" FullRevision\="No"/\>  
\</Revisions\>

Usage:  
If a user edits text while in "Blue Revision" mode, the corresponding \<Text\> tag must include RevisionID="1". The application must maintain a mapping table between these IDs and the active revision set.4

## ---

**4\. Dual Dialogue: The Interoperability Challenge**

Handling Dual Dialogue requires bridging a significant gap between Fountain's parser-based approach and FDX's layout-based approach.

### **4.1 Fountain Implementation**

Fountain uses the caret ^ on the second character line to link it to the first.

* **State Machine Logic:** When the parser encounters CHARACTER ^, it must look back at the *immediately preceding* element. If that element is a Dialogue block, the parser flags both the previous block and the current block as a "Dual Dialogue Pair."

### **4.2 FDX Implementation**

Research indicates that FDX does not use a strictly semantic \<DualDialogue\> container tag in the way one might expect. Instead, it relies on **layout attributes** or specific styling commands to render the text side-by-side.

Structure Logic:  
Final Draft implements dual dialogue by adjusting the LeftIndent and RightIndent of the \<Paragraph\> elements to position them in columns.

* **Left Speaker:** Standard left margin, truncated right margin.  
* **Right Speaker:** Increased left margin (placing it in the middle of the page), standard right margin.

Conversion Strategy:  
When exporting Fountain Dual Dialogue to FDX:

1. Identify the two Dialogue blocks.  
2. Set the Type="Character" and Type="Dialogue" for the first speaker.  
3. Set the Type="Character" and Type="Dialogue" for the second speaker.  
4. Apply specific DualDialogue flags if supported by the library, OR calculate the LeftIndent and RightIndent values to visually position the second speaker to the right of the first.  
   * *Note on \<DualDialogue\> Tag:* While some third-party parsers allude to a tag, standard FDX often manages this via the Dual Dialogue property in the internal formatting engine which might be serialized as a specific formatting flag or simply layout coordinates. The safest "source of truth" implementation is to maintain the sequential order but flag the formatting attributes to force the side-by-side render.10

## ---

**5\. Metadata Mapping and Boneyard Logic**

### **5.1 ScriptNotes (\<ScriptNote\>)**

FDX supports specific, timestamped notes attached to paragraphs.

* **Fountain Source:** \].  
* **FDX Target:**  
  XML  
  \<ScriptNote Date\="2023-10-27T10:00:00" ID\="1"\>  
      \<Paragraph\>  
          \<Text\>This is a note\</Text\>  
      \</Paragraph\>  
  \</ScriptNote\>

  The application must generate unique IDs for notes and link them to the document flow.12

### **5.2 Header and Footer**

Fountain does not inherently support header/footer configuration (it leaves this to the print renderer). FDX requires explicit definition.

* **Strategy:** On FDX export, generate a default \<HeaderAndFooter\> block.  
* **Content:** Typically includes \<DynamicLabel Type="Page \#"/\> positioned at the right margin of the Header.4

## ---

**6\. Implementation Strategy and Algorithms**

### **6.1 The "Script Model" (AST)**

To support both formats, the internal data structure should be a list of ScriptElement objects.  
Class ScriptElement:

* UUID: Unique identifier.  
* Type: Enum (SceneHeading, Action, Character, Dialogue, Parenthetical, Transition, General).  
* Content: Rich text string (preserving bold/italics).  
* Attributes: Dictionary for FDX-specific metadata (SceneNumber, RevisionID, DualDialoguePartnerID).  
* Notes: List of attached ScriptNotes.

### **6.2 Parser Logic (Fountain Import)**

Use a state machine rather than simple regex matching.

* **State:** Neutral \-\> CharacterCandidate \-\> Dialogue.  
* **Logic:**  
  * Read line.  
  * Check for **Forces** (., \!, @). If found, set Type and strip force character.  
  * If no force, apply regex:  
    * Scene Heading: ^(INT|EXT|EST|I/E)\[\\.\\s\]?  
    * Transition: Uppercase and ends in TO:?  
    * Character: All caps and followed by text?  
  * **Dual Dialogue:** If Character has ^, backtrack to previous element and link UUIDs.

### **6.3 Generator Logic (FDX Export)**

* **Pagination Pass:** Before XML generation, run a "Virtual Printer" using Courier 12pt metrics to calculate page breaks. Update Length and Page attributes for all Scene Headings.  
* **SmartType Builder:** Iterate through all Character and Scene Heading elements. De-duplicate and sort strings. Populate \<SmartType\> XML block.  
* **XML Construction:** Use a DOM builder (like xml.etree or lxml). Do not concatenate strings to avoid encoding errors. Ensure UTF-8 encoding.

### **6.4 Handling Lossy Data**

* **Fountain \-\> FDX:** Layout precision is lost. Apply default Final Draft template margins (e.g., Action Width: 6.0", Dialogue Width: 3.5").  
* **FDX \-\> Fountain:** Revision colors and locked page numbers are often lost in standard Fountain. To mitigate this, specific Fountain extensions (like /\* @revision: blue \*/) can be used in the Boneyard to preserve data for round-tripping, though this is non-standard.

## ---

**7\. Conclusion**

By adhering to the parsing heuristics of Fountain and the strict XML schema of FDX, a developer can build a screenplay application that satisfies the entire production pipeline. The critical engineering challenge is not just parsing text, but maintaining the metadata layer—scene lengths, revision sets, and character lists—that turns a simple text file into a production-ready script.

The "Source of Truth" relies on respecting the specific parsing priority of Fountain (Forces \> Syntax \> Defaults) and ensuring the FDX output contains the mandatory \<SceneProperties\> and \<SmartType\> metadata to ensure compatibility with industry-standard scheduling and budgeting tools.

### **Table: Attribute Mapping Summary**

| Internal Model | Fountain Syntax | FDX Paragraph Type | Critical FDX Attributes |
| :---- | :---- | :---- | :---- |
| **Scene Heading** | EXT. LOC \- DAY or .FORCED | "Scene Heading" | Number, \<SceneProperties Length="..." Page="..."\> |
| **Action** | Description text. or \!FORCED | "Action" | Standard margins. |
| **Character** | NAME (All Caps) or @Forced | "Character" | Indentation (approx 2.0" left). |
| **Dialogue** | Text following Character. | "Dialogue" | Indentation (approx 1.0" left). |
| **Parenthetical** | (wryly) | "Parenthetical" | Indentation (approx 1.5" left). |
| **Transition** | CUT TO: or \> FORCED | "Transition" | Alignment="Right". |
| **Dual Dialogue** | NAME ^ | "Character" / "Dialogue" | Modified LeftIndent / RightIndent for columns. |
| **Note** | \[\[Note\]\] | \<ScriptNote\> | Date, ID. |
| **Boneyard** | /\* Hidden \*/ | (None) or \<ScriptNote\> | Often excluded or converted to Note. |

This specification provides the necessary architectural blueprint to implement the open and save functions for a modern screenwriting application.