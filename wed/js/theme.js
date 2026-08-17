/**
 * TempMal — Theme / Utilities
 */

const Theme = {
  init() {
    this.enhanceAccessibility();
  },

  enhanceAccessibility() {
    document.querySelectorAll('button:not([aria-label])').forEach((btn) => {
      if (btn.textContent.trim() && !btn.querySelector('svg:only-child')) return;
    });
  }
};

document.addEventListener('DOMContentLoaded', () => Theme.init());
