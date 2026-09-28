"use strict";

// Animate only visible content; never hide it while waiting for JavaScript.
(() => {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!("IntersectionObserver" in window) || !("animate" in Element.prototype)) return;
  const running = new Set();
  const targets = document.querySelectorAll(".hero-copy > *, .hero-visual, .intro > *, .section-heading, .feature-grid article, .how > div, .steps li, .benefit-band h2, .benefit-grid p, .specifications > *, .purchase-card, .about > *, .faq > div, .contact > div");
  const observer = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      if (preference.matches || target.contains(document.activeElement)) return;
      const siblings = Array.from(target.parentElement.children);
      const delay = Math.min(siblings.indexOf(target), 3) * 70;
      const animation = target.animate([
        { opacity: 0.15, transform: "translateY(24px)" },
        { opacity: 1, transform: "translateY(0)" }
      ], { duration: 650, delay, easing: "cubic-bezier(.2,.7,.2,1)", fill: "none" });
      running.add(animation);
      animation.finished.catch(() => {}).finally(() => running.delete(animation));
    });
  }, { threshold: 0.08 });
  targets.forEach(target => observer.observe(target));
  // Preference changes and keyboard focus stop movement immediately.
  function stopAnimations() {
    running.forEach(animation => animation.cancel());
    running.clear();
  }
  preference.addEventListener("change", () => { if (preference.matches) stopAnimations(); });
  document.addEventListener("focusin", stopAnimations);
  window.addEventListener("pagehide", () => { stopAnimations(); observer.disconnect(); }, { once: true });
})();
