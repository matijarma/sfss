export class ScrollbarManager {
    constructor(element) {
        if (typeof element === 'string') {
            this.element = document.querySelector(element);
        } else {
            this.element = element;
        }

        if (!this.element) {
            // Silently fail if element not found, as some might be optional
            return;
        }

        this.scrollTimeout = null;
        this.init();
    }

    init() {
        this.element.addEventListener('scroll', () => this.handleScroll());
    }

    handleScroll() {
        // Add the scrolling class to show the scrollbar
        if (!this.element.classList.contains('scrolling')) {
            this.element.classList.add('scrolling');
        }

        // Clear the previous timeout if it exists
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }

        // Set a new timeout to hide the scrollbar
        this.scrollTimeout = setTimeout(() => {
            this.element.classList.remove('scrolling');
        }, 1500); // Hide after 1.5 seconds
    }
}
