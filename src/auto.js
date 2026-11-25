import { liquidGlass } from "./liquid-glass.js";

// Opt-in declarative entry point. Framework adapters can keep using the core directly.
const controllers = new Map();
let pending = false;
function sync() {
  pending = false;
  for (const [element, controller] of controllers) {
    if (!element.isConnected || !element.hasAttribute("liquid-glass")) {
      controller.destroy();
      controllers.delete(element);
    }
  }
  for (const element of document.querySelectorAll("[liquid-glass]")) {
    if (element.closest(".liquid-glass-scene")) continue;
    if (controllers.has(element)) controllers.get(element).refresh();
    else controllers.set(element, liquidGlass(element));
  }
}
function schedule() {
  if (!pending) { pending = true; queueMicrotask(sync); }
}
function start() {
  sync();
  new MutationObserver((records) => {
    if (records.some(({ target }) => !(target.nodeType === 1 ? target : target.parentElement)?.closest(".liquid-glass"))) schedule();
  }).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ["liquid-glass", "liquid-glass-scene"],
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
