# SFSS

**SFSS** is a professional, client-side Screenwriting Progressive Web App (PWA) designed to provide an industry-standard writing experience directly in the browser. Built with a "local-first" philosophy, it ensures total privacy and offline capability without reliance on external servers or subscriptions.

> **"A Final Draft clone for the modern web."**

## 🎬 Project Context

**SFSS** is a flagship digital initiative by **Matija Radeljak** and **Aning Film**, a Zagreb-based production company committed to the concept of the "Double Bottom Line": creating projects that are both financially sustainable and socially impactful.

### Aning Film
Aning Film operates at the intersection of traditional cinema and modern innovation. Beyond producing feature films and documentaries, the company is deeply invested in professional training, digital storytelling, and building infrastructure for the next generation of filmmakers. Their mission is transparency, equality, and efficiency—values directly reflected in the open and accessible nature of SFSS.

### Dogma 23
This project is part of the **Dogma 23** initiative, a "Gallery of Film" and creative incubator in Zagreb. Reimagining the spirit of the Dogma 95 movement for the 21st century, Dogma 23 serves as a physical and digital hub where filmmakers, financiers, and audiences connect. SFSS serves as the digital toolset for this movement: a free, professional-grade instrument that removes barriers to entry for screenwriters everywhere.

*   **Developer:** Matija Radeljak

## ✨ Key Features

*   **Industry Standard Formatting:** Custom formatting engine ensuring 12pt Courier, correct margins, and standard element spacing.
*   **100% Client-Side & Private:** No database, no cloud logins. All work is saved locally to your device (LocalStorage & IndexedDB).
*   **Progressive Web App (PWA):** Installable on Desktop and Mobile. Works completely offline once loaded.
*   **Interoperability:** Import/Export **Final Draft (.fdx)**, **Fountain**, and **JSON**.
*   **Mobile-Optimized:** Adapts from a desktop writing suite to a mobile-friendly drafting tool.
*   **Production Tools:** Scene navigation, Script Reports, Integrated Media Player (YouTube track binding), and Visual Storyboards.

## 🛠 Technical Architecture

SFSS is built as a **Single Page Application (SPA)** using **Vanilla JavaScript (ES Modules)**.

*   **Entry Point:** `index.html` loads `assets/script.js`.
*   **Module Loading:** `assets/script.js` dynamically imports either `MobileApp.js` or `SFSS.js` (Desktop) based on the device viewport.
*   **Core Logic:** Located in `assets/js-mod/`, managing everything from `contenteditable` input to the custom pagination engine (`PageRenderer.js`).

## 🛠 Usage and installation

App will load into your browser cache and you can install it to your desktop computer or mobile device. No data is transfered to or from the app, there isn't even an update mechanism. The app once loaded fully lives in your browser and works the same with or without internet connection, with the single exception of the music player which sources tracks from YouTube which cannot be made offline (for now).

You can also download the serverless version. Simply download the serverless/ directory to your computer, unzip it if needed, and run index.html (open the file with a web browser of your choice). The app will work identically and you can also install it as a native desktop app. Same thing works on Android and iPhone devices.


## 📄 License

**100% Open Source & Free.**

SFSS is released under the [MIT License](LICENSE). You are free to use, modify, distribute, and build your own versions of this software for personal or commercial use.

---