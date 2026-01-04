Project Vision: Treatment Printing Engine Overhaul ("Strict Fit" Architecture)

We are upgrading the "Treatment Prepare & Print" feature. Currently, it relies on standard HTML/CSS flow, which causes layout breakages when content is large.

We need to treat this feature as a standalone Publishing Engine—a "mini-app" within the application. It must move away from browser reflow and adopt a "Strict Containerization" architecture. It must guarantee pixel-perfect output where scenes NEVER exceed their allocated page count, regardless of content volume. If a scene has 100 images, the engine must calculate a grid dense enough to fit them all neatly onto the single allocated page. Machine-strict layout consistency is the priority over readability.

Core Architecture: The Layout Engine
The system must operate in three distinct phases:

1. The Measurement & Constraint Phase Before rendering, the system must perform a "Shadow Measure" of the content and compare it against the Hard Limits of the selected configuration.

Text Constraint: Calculate available height for text. If the synopsis/script exceeds this, the engine must mathematically truncate it (clamp) to fit perfectly, adding an ellipsis. It does not flow to a new page.

Visual Constraint: Calculate available area for images/thumbnails. The engine must determine the optimal grid density (rows/cols) to fit all items within that fixed box.

Example: If fitting 100 thumbnails into a 4x4 inch box, the engine calculates the exact cell size (e.g., 5px by 5px) to ensure strict alignment.

2. The Distribution Phase (Logical Pagination) The system generates Logical Pages based on strict allocation rules.

Rule: A Scene is an atomic unit. It owns a specific number of pages (1 or 2) and cannot expand beyond that.

Page Generation:

Normal/Booklet: Create 1 Logical Page per scene. Fill slots.

Facing: Create 2 Logical Pages per scene (Left & Right). Fill slots.

3. The Rendering Phase (Imposition) Map Logical Pages to Physical Sheets.

Booklet: Reorder and place 2 Logical Pages (A5) onto 1 Physical Sheet (Landscape Letter).

Normal/Facing: Map 1:1 to Physical Sheets.

The Configuration Matrix (Strict Layout Rules)
The engine must enforce these hard limits per scene:

A. Normal Mode (Max 1 Page per Scene)

Portrait:

Structure: Vertical Stack (Header -> Stats -> Synopsis -> Visuals).

Constraint: Text takes upper priority. Visuals get the remaining bottom space. If visual content is heavy, the grid becomes denser to fit it all in the footer area.

Landscape:

Structure: Fixed 2-Column Grid (Left: Text, Right: Visuals).

Constraint: Text hard-stops at the bottom of Left Column. Visuals hard-stop at the bottom of Right Column.

B. Booklet Mode (Max 1 Page per Scene)

*Structure: Vertical Stack (A5 dimensions).

Constraint: Strictly 1 page. Text and images must scale/clamp to fit this smaller form factor.

Imposition: Total pages must be a multiple of 4 (pad with blanks). Pages must be reordered (imposed) for folding.

C. Facing Pages Mode (Max 2 Pages per Scene)

Structure: A dedicated "Spread".

Left Page (Even): Dedicated to Text (Header, Synopsis, Notes, Stats). Hard stop at page bottom.

Right Page (Odd): Dedicated to Visuals (Images, Script Thumbnails). Hard stop at page bottom.

Constraint: If a scene has 0 images, the Right Page still exists (can remain blank or hold overflow notes), ensuring the rhythm of the book is never broken.

Visual & Technical Requirements
Dynamic Geometry: JS must calculate layout geometry (--page-width, --page-height, --visual-container-height) and pass them to CSS variables.

"Best Fit" Grid Calculator: Implement a function calculateGrid(itemCount, availableWidth, availableHeight) that returns the optimal columns and rows to fit itemCount items perfectly into the box without overflow.

Text Clamping: Implement a function that measures text height and slices the string at the exact character index that fits the container.

CSS Reset: Use strict box-sizing: border-box, overflow: hidden, and print-color-adjust: exact to prevent any browser-based reflow surprises.

Summary of Task: Refactor PrintManager.js and print.css (and any other css/js file you deem relevant to acomplish the task) to implement this Strict Fit Layout Engine. Remove all logic related to "continuation pages" or variable-height scenes. Replace it with logic that calculates density and truncation to force every scene into its specific 1 or 2-page container. Implement the Imposition logic for Booklet mode.