import { lensGeometry } from "./optics.js";
import { resolveOptions } from "./options.js";
import { browserEngine, makeSvgLens } from "./renderers/svg.js";
import { makeViewportLens } from "./renderers/viewport.js";

const instances = new WeakMap();
const material = "liquid-glass";

/** Apply a glass material to an HTML element. Load style.css before mounting. */
export function liquidGlass(element, changes = {}) {
  const document = element?.ownerDocument;
  const view = document?.defaultView;
  if (!view || !(element instanceof view.HTMLElement)) {
    throw new TypeError("liquidGlass requires an HTML element");
  }
  const existing = instances.get(element);
  if (existing) {
    existing.update(changes);
    return existing;
  }

  let options = resolveOptions(view, changes);
  const engine = browserEngine(view);
  const supportsBackdrop = engine === "blink" && view.CSS?.supports("backdrop-filter", 'url("#glass")');
  const motion = view.matchMedia("(prefers-reduced-motion: reduce)");
  const solid = view.matchMedia("(prefers-reduced-transparency: reduce), (forced-colors: active)");
  const originalStyles = new Map();
  const hadClass = element.classList.contains(material);
  const observer = new view.ResizeObserver(schedule);
  let svgLens;
  let viewportLens;
  let geometry;
  let source = null;
  let frame = null;
  let lightFrame = null;
  let pointer;
  let activeRenderer = "off";
  let destroyed = false;

  function style(property, value) {
    const name = "--liquid-glass-" + property;
    if (element.style.getPropertyValue(name) === String(value)) return;
    if (!originalStyles.has(name)) {
      originalStyles.set(name, [element.style.getPropertyValue(name), element.style.getPropertyPriority(name)]);
    }
    element.style.setProperty(name, value);
  }

  function restoreStyles() {
    for (const [name, [value, priority]] of originalStyles) {
      element.style.setProperty(name, value, priority);
    }
    originalStyles.clear();
  }

  function schedule() {
    if (!destroyed && options.mode !== "off" && frame === null) frame = view.requestAnimationFrame(render);
  }

  function setRenderer(renderer, url = "") {
    if (renderer !== "off") {
      style("lens", renderer === "backdrop" ? url : "");
    }
    if (activeRenderer === renderer) return;
    activeRenderer = renderer;
    view.queueMicrotask(() => {
      if (!destroyed && activeRenderer === renderer) {
        element.dispatchEvent(new view.CustomEvent("liquidglass:rendererchange", { detail: { renderer } }));
      }
    });
  }

  function clearSvg() {
    svgLens?.dispose();
    svgLens = undefined;
  }

  function scroll(event) {
    // Scrolling inside the source changes its sampled pixels, not the relative lens position.
    if (!(event.target instanceof view.Node) || !source?.contains(event.target)) schedule();
  }

  function watchSource(next) {
    if (next === source) return;
    viewportLens?.dispose();
    viewportLens = undefined;
    if (source) observer.unobserve(source);
    if (!source && next) {
      view.addEventListener("scroll", scroll, true);
      view.addEventListener("resize", schedule);
    }
    source = next;
    if (source) observer.observe(source);
    if (!source) {
      view.removeEventListener("scroll", scroll, true);
      view.removeEventListener("resize", schedule);
    }
  }

  function viewportSource() {
    const tree = element.getRootNode();
    let target = options.viewportSource;
    if (typeof target === "string") {
      try {
        target = tree.querySelector(target);
      } catch {
        return null;
      }
    }
    if (!(target instanceof view.HTMLElement) || target.getRootNode() !== tree
      || target.contains(element) || element.contains(target)) return null;
    return target;
  }

  function renderViewport() {
    const next = viewportSource();
    watchSource(next);
    if (!next?.isConnected) {
      setRenderer("frost");
      return;
    }
    viewportLens ??= makeViewportLens(element, next, engine);
    if (activeRenderer !== "viewport") setRenderer("frost");
    const renderedOptions = options;
    viewportLens.render(options, (applied) => {
      if (options === renderedOptions) setRenderer(applied ? "viewport" : "frost");
    });
  }

  function render() {
    frame = null;
    const { mode, refraction } = options;
    const { clientWidth: width, clientHeight: height } = element;
    if (solid.matches || mode === "frost" || !refraction || !element.isConnected || !width || !height) {
      clearSvg();
      watchSource(null);
      setRenderer("frost");
      return;
    }

    if (supportsBackdrop && (mode === "auto" || mode === "backdrop")) {
      geometry = lensGeometry(width, height, options, geometry);
      svgLens ??= makeSvgLens(element);
      const renderedOptions = options;
      svgLens.render(geometry, options, (url) => {
        if (options !== renderedOptions) return;
        if (url) {
          watchSource(null);
          setRenderer("backdrop", url);
        } else if (mode === "auto") {
          renderViewport();
        } else {
          watchSource(null);
          setRenderer("frost");
        }
      });
      return;
    }

    clearSvg();
    if (mode === "viewport" || mode === "auto") renderViewport();
    else {
      watchSource(null);
      setRenderer("frost");
    }
  }

  function resetLight() {
    pointer = undefined;
    if (options.mode === "off") return;
    style("light-x", "");
    style("light-y", "");
  }

  function moveLight(event) {
    if (options.mode === "off" || !options.interactive || motion.matches || event.pointerType === "touch") return;
    pointer = { x: event.clientX, y: event.clientY };
    if (lightFrame !== null) return;
    lightFrame = view.requestAnimationFrame(() => {
      lightFrame = null;
      if (!pointer) return;
      const { width, height, left, top } = element.getBoundingClientRect();
      if (!width || !height) return;
      style("light-x", (pointer.x - left) / width * 100 + "%");
      style("light-y", (pointer.y - top) / height * 100 + "%");
    });
  }

  function applyOptions() {
    if (options.mode === "off") {
      if (frame !== null) view.cancelAnimationFrame(frame);
      frame = null;
      pointer = undefined;
      clearSvg();
      watchSource(null);
      restoreStyles();
      element.classList.remove(material);
      setRenderer("off");
      return;
    }
    element.classList.add(material);
    style("radius", options.radius + "px");
    style("blur", options.blur + "px");
    style("saturation", options.saturation);
    style("tint", options.tint);
    style("glow", options.glow);
    style("edge", options.edgeHighlight);
    style("angle", options.lightAngle + "deg");
    if (!options.interactive) resetLight();
    if (activeRenderer === "off") setRenderer("frost");
    schedule();
  }

  const controller = {
    get renderer() {
      return activeRenderer;
    },
    update(changes, { replace = false } = {}) {
      if (destroyed) return;
      options = resolveOptions(view, changes, replace ? undefined : options);
      applyOptions();
    },
    refresh: schedule,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame !== null) view.cancelAnimationFrame(frame);
      if (lightFrame !== null) view.cancelAnimationFrame(lightFrame);
      clearSvg();
      watchSource(null);
      observer.disconnect();
      element.removeEventListener("pointermove", moveLight);
      element.removeEventListener("pointerleave", resetLight);
      motion.removeEventListener("change", resetLight);
      solid.removeEventListener("change", schedule);
      restoreStyles();
      if (hadClass) element.classList.add(material);
      else element.classList.remove(material);
      instances.delete(element);
      activeRenderer = "off";
    },
  };

  instances.set(element, controller);
  element.addEventListener("pointermove", moveLight, { passive: true });
  element.addEventListener("pointerleave", resetLight);
  motion.addEventListener("change", resetLight);
  solid.addEventListener("change", schedule);
  observer.observe(element);
  applyOptions();
  return controller;
}
