import { lensGeometry } from "./optics.js";
import { resolveOptions } from "./options.js";
import { makeBackdropLens } from "./renderers/sampled.js";
import { makeSceneLens } from "./renderers/scene.js";
import { browserEngine, makeSvgLens } from "./renderers/svg.js";

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
  const observer = new view.ResizeObserver(() => { sceneLens?.refresh(); schedule(); });
  let svgLens;
  let svgMode;
  let sampledLens;
  let sceneLens;
  let sceneSource;
  let geometry;
  let source;
  let stopVideo;
  let frame = null;
  let lightFrame = null;
  let pointer;
  let activeRenderer = "frost";
  let destroyed = false;

  function style(property, value) {
    const name = "--liquid-glass-" + property;
    if (element.style.getPropertyValue(name) === String(value)) return;
    if (!originalStyles.has(name)) {
      originalStyles.set(name, [element.style.getPropertyValue(name), element.style.getPropertyPriority(name)]);
    }
    element.style.setProperty(name, value);
  }

  function schedule() {
    if (!destroyed && frame === null) frame = view.requestAnimationFrame(render);
  }

  function resize() { sceneLens?.refresh(); schedule(); }

  function setRenderer(renderer, url = "") {
    style("overlay-filter", renderer === "content" || renderer === "scene" ? "none" : "");
    style("css-rim", ["content", "sampled"].includes(renderer) ? 0 : "");
    style("content-filter", renderer === "content" ? url : "");
    style("lens", renderer === "backdrop" ? url : "");
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
    svgMode = undefined;
  }

  function render() {
    frame = null;
    const { mode, refraction, radius, bevel, curvature, lightAngle } = options;
    const content = mode === "content";
    const live = supportsBackdrop && (mode === "auto" || mode === "backdrop");
    const preferLive = live && mode === "auto";
    if (mode === "scene" || (mode === "auto" && !preferLive && !options.backdrop)) watchScene(resolveScene());
    const useScene = mode === "scene" || (mode === "auto" && !preferLive && !options.backdrop && !!sceneLens);
    if (!useScene && options.refraction && ["auto", "sampled"].includes(mode) && !options.backdrop && !preferLive) {
      watchSource(discoverSource());
    }
    const width = content ? element.offsetWidth : element.clientWidth;
    const height = content ? element.offsetHeight : element.clientHeight;
    if (solid.matches || mode === "frost" || !refraction || !element.isConnected || !width || !height) {
      setRenderer("frost");
      clearSvg();
      sampledLens?.canvas.remove();
      sceneLens?.layer.remove();
      return;
    }

    const density = content ? Math.min(view.devicePixelRatio || 1, 2) : 1;
    const key = [width, height, Math.min(radius, width / 2, height / 2), bevel, curvature, lightAngle, density].join("/");
    if (key !== geometry?.key) {
      geometry = { ...lensGeometry(width, height, options, density), width, height, key };
    }

    if (useScene) {
      sampledLens?.canvas.remove();
      if (!sceneLens || !sceneLens.render()) {
        sceneLens?.layer.remove();
        clearSvg();
        setRenderer("frost");
        return;
      }
      if (!sceneLens.layer.parentNode) element.prepend(sceneLens.layer);
      if (svgMode !== "scene") {
        clearSvg();
        svgLens = makeSvgLens(element, engine, "content");
        svgMode = "scene";
        setRenderer("frost");
      }
      const renderedOptions = options;
      svgLens.render(geometry, options, (url) => {
        if (options !== renderedOptions || !sceneLens) return;
        sceneLens.layer.style.filter = url || "none";
        setRenderer(url ? "scene" : "frost");
      });
      return;
    }
    sceneLens?.layer.remove();

    function sample() {
      if (!source) {
        sampledLens?.canvas.remove();
        return false;
      }
      sampledLens ??= makeBackdropLens(document);
      if (!sampledLens.canvas.parentNode) element.prepend(sampledLens.canvas);
      if (sampledLens.render(source, geometry, options)) {
        setRenderer("sampled");
        return true;
      }
      sampledLens.canvas.remove();
      return false;
    }

    if (!preferLive && sample()) {
      clearSvg();
      return;
    }
    if (!content && !live) {
      setRenderer("frost");
      clearSvg();
      return;
    }

    const nextSvgMode = content ? "content" : "backdrop";
    if (svgMode !== nextSvgMode) {
      clearSvg();
      svgLens = makeSvgLens(element, engine, nextSvgMode);
      svgMode = nextSvgMode;
      sampledLens?.canvas.remove();
      setRenderer("frost");
    }
    const renderedOptions = options;
    svgLens.render(geometry, options, (url) => {
      if (options !== renderedOptions) return;
      if (url) {
        sampledLens?.canvas.remove();
        setRenderer(nextSvgMode, url);
      } else if (!preferLive || !sample()) {
        setRenderer("frost");
      }
    });
  }

  function resolveScene() {
    if (options.scene instanceof view.HTMLElement) return options.scene;
    const key = typeof options.scene === "string" ? options.scene : element.getAttribute("liquid-glass");
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent.hasAttribute("liquid-glass-scene") && (!key || parent.getAttribute("liquid-glass-scene") === key)) return parent;
    }
    return null;
  }

  function watchScene(next) {
    if (next === element || (next && element.contains(next))) next = null;
    if (next === sceneSource) return;
    if (sceneSource) observer.unobserve(sceneSource);
    sceneLens?.destroy();
    sceneSource = next;
    sceneLens = next ? makeSceneLens(element, next, schedule) : undefined;
    if (next) observer.observe(next);
  }

  // Only media found behind the lens at its center can be sampled. This is not
  // a capture of the surrounding DOM; explicit backdrops remain authoritative.
  function discoverSource() {
    const bounds = element.getBoundingClientRect();
    const hits = document.elementsFromPoint?.(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2) ?? [];
    let behind = false;
    for (const hit of hits) {
      if (hit === element || element.contains(hit)) { behind = true; continue; }
      if (!behind || hit.contains(element)) continue;
      if (hit.matches("img, video, canvas") && !hit.classList.contains("liquid-glass-backdrop")) return hit;
      const background = view.getComputedStyle(hit).backgroundColor;
      if (background && background !== "transparent" && background !== "rgba(0, 0, 0, 0)") return null;
    }
    return null;
  }

  function resetLight() {
    pointer = undefined;
    style("light-x", "");
    style("light-y", "");
  }

  function moveLight(event) {
    if (!options.interactive || motion.matches || event.pointerType === "touch") return;
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

  function watchSource(next) {
    if (source === next) return;
    if (source) {
      observer.unobserve(source);
      source.removeEventListener("load", schedule);
      stopVideo?.();
      stopVideo = undefined;
    }
    source = next;
    if (source) {
      observer.observe(source);
      source.addEventListener("load", schedule);
      if (source.localName === "video") stopVideo = watchVideo(source);
    }
  }

  function watchVideo(video) {
    const events = ["loadeddata", "seeked", "resize"];
    for (const event of events) video.addEventListener(event, schedule);
    function nextFrame() {
      if (!solid.matches) schedule();
      videoFrame = video.requestVideoFrameCallback(nextFrame);
    }
    let videoFrame = video.requestVideoFrameCallback?.(nextFrame);
    return () => {
      if (videoFrame !== undefined) video.cancelVideoFrameCallback(videoFrame);
      for (const event of events) video.removeEventListener(event, schedule);
    };
  }

  function applyOptions() {
    element.classList.add(material);
    style("radius", options.radius + "px");
    style("blur", options.blur + "px");
    style("saturation", options.saturation);
    style("tint", options.tint);
    style("glow", options.glow);
    style("edge", options.edgeHighlight);
    style("angle", options.lightAngle + "deg");
    if (!options.interactive) resetLight();
    const watching = options.refraction && ["auto", "backdrop", "sampled", "scene"].includes(options.mode);
    watchSource(watching && options.mode !== "scene" ? options.backdrop : null);
    watchScene(options.mode === "scene" || (options.mode === "auto" && !supportsBackdrop && !options.backdrop) ? resolveScene() : null);
    view.removeEventListener("scroll", schedule, true);
    view.removeEventListener("resize", resize);
    if (watching) {
      view.addEventListener("scroll", schedule, true);
      view.addEventListener("resize", resize);
    }
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
    refresh() { sceneLens?.refresh(); schedule(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame !== null) view.cancelAnimationFrame(frame);
      if (lightFrame !== null) view.cancelAnimationFrame(lightFrame);
      clearSvg();
      sampledLens?.canvas.remove();
      sceneLens?.destroy();
      watchSource(null);
      view.removeEventListener("scroll", schedule, true);
      view.removeEventListener("resize", resize);
      observer.disconnect();
      element.removeEventListener("pointermove", moveLight);
      element.removeEventListener("pointerleave", resetLight);
      motion.removeEventListener("change", resetLight);
      solid.removeEventListener("change", schedule);
      for (const [name, [value, priority]] of originalStyles) {
        element.style.setProperty(name, value, priority);
      }
      if (!hadClass) element.classList.remove(material);
      instances.delete(element);
      activeRenderer = "frost";
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
