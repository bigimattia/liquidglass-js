import { lensGeometry } from "../optics.js";
import {
  appendRefraction, attrs, filterId, filterRoot, makeMapRequest, setDisplacement, svg,
} from "./svg.js";

const sources = new WeakMap();

function installFilter(source, owner, id) {
  let entry = sources.get(source);
  if (!entry) {
    const { style } = source;
    const computed = source.ownerDocument.defaultView.getComputedStyle(source).filter;
    entry = {
      value: style.getPropertyValue("filter"),
      priority: style.getPropertyPriority("filter"),
      base: computed && computed !== "none" ? computed : "",
      lenses: new Map(),
    };
    sources.set(source, entry);
  }
  entry.lenses.set(owner, 'url("#' + id + '")');
  writeFilters(source, entry);
}

function writeFilters(source, { base, lenses, priority }) {
  const value = [base, ...lenses.values()].filter(Boolean).join(" ");
  if (source.style.getPropertyValue("filter") !== value) {
    source.style.setProperty("filter", value, priority);
  }
}

function removeFilter(source, owner) {
  const entry = sources.get(source);
  if (!entry?.lenses.delete(owner)) return;
  if (entry.lenses.size) writeFilters(source, entry);
  else {
    source.style.setProperty("filter", entry.value, entry.priority);
    sources.delete(source);
  }
}

function measure(element, source) {
  const lens = element.getBoundingClientRect();
  const pane = source.getBoundingClientRect();
  if (lens.right <= pane.left || lens.bottom <= pane.top || lens.left >= pane.right || lens.top >= pane.bottom) return null;
  const { offsetWidth: width, offsetHeight: height } = source;
  if (!width || !height || !pane.width || !pane.height || !lens.width || !lens.height) return null;
  const xScale = width / pane.width;
  const yScale = height / pane.height;
  return {
    viewport: { x: 0, y: 0, width, height },
    lens: {
      x: (lens.left - pane.left) * xScale,
      y: (lens.top - pane.top) * yScale,
      width: lens.width * xScale,
      height: lens.height * yScale,
    },
  };
}

export function makeViewportLens(element, source, engine) {
  const owner = {};
  const document = source.ownerDocument;
  const view = document.defaultView;
  const { root, defs } = filterRoot(source);
  const mapRequest = makeMapRequest(document, paint);
  let geometry;
  let current;
  let lastPaint;
  let graph;
  let map;
  let flood;
  let displacements;
  let chromatic;
  let settle;
  const webkit = engine === "webkit";

  function paint(bounds = measure(element, source)) {
    const { options, applied } = current;
    if (!bounds || mapRequest.failed || !source.isConnected || !element.isConnected) {
      view.clearTimeout(settle);
      removeFilter(source, owner);
      lastPaint = undefined;
      applied(false);
      return;
    }
    if (!mapRequest.url || mapRequest.key !== geometry.key) return;
    const { viewport, lens } = bounds;
    const { chroma } = options;
    const key = [...Object.values(viewport), ...Object.values(lens), geometry.key, chroma].join("/");
    if (key === lastPaint) {
      applied(true);
      return;
    }
    lastPaint = key;

    if (chromatic !== !!chroma) {
      chromatic = !!chroma;
      graph = svg(document, "filter", {
        id: filterId(), filterUnits: "userSpaceOnUse", primitiveUnits: "userSpaceOnUse",
        "color-interpolation-filters": "sRGB",
      });
      flood = svg(document, "feFlood", { "flood-color": "#808000", result: "neutral" });
      map = svg(document, "feImage", { preserveAspectRatio: "none", result: "lens" });
      graph.append(flood, map, svg(document, "feComposite", {
        in: "lens", in2: "neutral", operator: "over", result: "offsets",
      }));
      displacements = appendRefraction(graph, chromatic);
      defs.replaceChildren(graph);
    }
    const newImage = map.getAttribute("href") !== mapRequest.url;
    attrs(graph, viewport);
    attrs(flood, viewport);
    attrs(map, { ...lens, href: mapRequest.url });
    setDisplacement(displacements, geometry.strength, chroma);
    if (webkit) graph.id = filterId();
    installFilter(source, owner, graph.id);
    if (webkit && newImage) {
      // WebKit can cache the first output before feImage paints.
      view.clearTimeout(settle);
      settle = view.setTimeout(() => {
        graph.id = filterId();
        installFilter(source, owner, graph.id);
      }, 94);
    }
    applied(true);
  }

  return {
    render(options, applied) {
      current = { options, applied };
      const bounds = measure(element, source);
      if (bounds) {
        const { width, height } = bounds.lens;
        geometry = lensGeometry(width, height, options, geometry);
        mapRequest.requestMap(geometry);
      }
      paint(bounds);
    },
    dispose() {
      mapRequest.cancel();
      view.clearTimeout(settle);
      removeFilter(source, owner);
      root.remove();
    },
  };
}
