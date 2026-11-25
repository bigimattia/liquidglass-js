import { lensStrength } from "../optics.js";

const namespace = "http://www.w3.org/2000/svg";
const documentMaps = new WeakMap();
const lensBounds = { x: 0, y: 0, width: 1, height: 1 };
let nextId = 0;

export function browserEngine(view) {
  const { userAgentData, userAgent } = view.navigator;
  if (userAgentData?.brands.some(({ brand }) => brand === "Chromium") || /\b(?:Chrome|Chromium)\//.test(userAgent)) {
    return "blink";
  }
  if (/Firefox\//.test(userAgent)) return "gecko";
  return /AppleWebKit\//.test(userAgent) ? "webkit" : "unknown";
}

function attrs(node, attributes) {
  for (const [key, value] of Object.entries(attributes)) {
    const text = String(value);
    if (node.getAttribute(key) !== text) node.setAttribute(key, text);
  }
  return node;
}

function svg(document, name, attributes) {
  return attrs(document.createElementNS(namespace, name), attributes);
}

function displacementUnits(engine, width, height, content) {
  if (!content) return { unit: 1, xScale: 1, yScale: 1 };
  // Gecko scales by the box diagonal, Blink by width, and WebKit by each axis.
  if (engine === "webkit") {
    const shortSide = Math.min(width, height);
    return { unit: shortSide, xScale: shortSide / width, yScale: shortSide / height };
  }
  return {
    unit: engine === "gecko" ? Math.hypot(width, height) / Math.SQRT2 : width,
    xScale: 1,
    yScale: 1,
  };
}

function getMap(document, engine, content, geometry) {
  if (!documentMaps.has(document)) {
    documentMaps.set(document, { entries: new Map(), canvas: document.createElement("canvas") });
  }
  const { entries, canvas } = documentMaps.get(document);
  const key = [engine, content, geometry.key].join("/");
  let entry = entries.get(key);
  if (entry) {
    entries.delete(key);
    entries.set(key, entry);
    return entry;
  }

  const { columns, rows, offsets, coverage, highlights, width, height } = geometry;
  const { xScale, yScale } = displacementUnits(engine, width, height, content);
  canvas.width = columns;
  canvas.height = rows;
  const context = canvas.getContext("2d");
  entry = { url: null, ready: Promise.resolve(null) };
  if (context) {
    const image = context.createImageData(columns, rows);
    const pixels = image.data;
    for (let index = 0; index < coverage.length; index++) {
      const pixel = 4 * index;
      pixels[pixel] = 127.5 + 127.5 * offsets[2 * index] * xScale;
      pixels[pixel + 1] = 127.5 + 127.5 * offsets[2 * index + 1] * yScale;
      pixels[pixel + 2] = highlights[index];
      pixels[pixel + 3] = content ? coverage[index] : 255;
    }
    context.putImageData(image, 0, 0);
    const url = canvas.toDataURL();
    const decoding = new document.defaultView.Image();
    decoding.src = url;
    entry.ready = decoding.decode().then(() => {
      entry.url = url;
      return url;
    }, () => null);
  }
  if (entries.size >= 32) entries.delete(entries.keys().next().value);
  entries.set(key, entry);
  return entry;
}

function filterGraph(document, content, flags) {
  const graph = svg(document, "filter", {
    ...lensBounds,
    id: "liquid-glass-" + ++nextId,
    primitiveUnits: content ? "objectBoundingBox" : "userSpaceOnUse",
    "color-interpolation-filters": "sRGB",
  });
  function add(name, attributes) {
    const node = svg(document, name, attributes);
    graph.append(node);
    return node;
  }

  if (content) {
    add("feFlood", { ...lensBounds, "flood-color": "rgb(128,128,0)", result: "neutral" });
  }
  const map = add("feImage", {
    ...lensBounds, preserveAspectRatio: "none", result: content ? "shape" : "offsets",
  });
  if (content) {
    add("feComposite", { ...lensBounds, in: "shape", in2: "neutral", operator: "over", result: "offsets" });
  }

  const source = flags.blur ? "frosted" : "SourceGraphic";
  const blur = flags.blur ? add("feGaussianBlur", { in: "SourceGraphic", result: source }) : null;
  function displace(result) {
    return add("feDisplacementMap", {
      in: source, in2: "offsets", xChannelSelector: "R", yChannelSelector: "G", result,
    });
  }
  const displacements = [];
  if (flags.chroma) {
    const names = ["red", "green", "blue"];
    for (const [channel, name] of names.entries()) {
      displacements.push(displace(name));
      const matrix = Array(20).fill(0);
      matrix[channel * 6] = 1;
      matrix[19] = 1;
      add("feColorMatrix", { in: name, values: matrix.join(" "), result: name + "Only" });
    }
    add("feBlend", { in: "redOnly", in2: "greenOnly", mode: "screen", result: "redGreen" });
    add("feBlend", { in: "redGreen", in2: "blueOnly", mode: "screen", result: "rgb" });
    add("feComposite", { in: "rgb", in2: "green", operator: "in", result: "warped" });
  } else {
    displacements.push(displace("warped"));
  }

  let result = "warped";
  const saturation = flags.saturation ? add("feColorMatrix", {
    in: result, type: "saturate", result: "saturated",
  }) : null;
  if (saturation) result = "saturated";

  const rim = flags.rim ? add("feColorMatrix", { ...lensBounds, in: "offsets", result: "rim" }) : null;
  if (rim) {
    add("feComposite", { ...lensBounds, in: "rim", in2: result, operator: "atop", result: "lit" });
    result = "lit";
  }
  if (content) {
    // Displace real content inside the silhouette and retain the original pixels outside it.
    add("feComposite", { ...lensBounds, in: result, in2: "shape", operator: "in", result: "interior" });
    add("feComposite", { in: "SourceGraphic", in2: "shape", operator: "out", result: "exterior" });
    add("feComposite", { in: "interior", in2: "exterior", operator: "arithmetic", k2: 1, k3: 1 });
  }
  return { graph, map, displacements, blur, saturation, rim };
}

export function makeSvgLens(element, engine, mode) {
  const document = element.ownerDocument;
  const view = document.defaultView;
  const content = mode === "content";
  const root = svg(document, "svg", { width: 0, height: 0, "aria-hidden": "true" });
  root.style.cssText = "position:absolute;overflow:hidden;pointer-events:none";
  const tree = element.getRootNode();
  (tree === document ? document.body : tree).append(root);
  const defs = svg(document, "defs", {});
  root.append(defs);

  let requestedKey;
  let request = 0;
  let activeMap;
  let mapFailed = false;
  let current;
  let graph;
  let topology;
  let lastRender;
  let settleTimer;
  let destroyed = false;

  function publish(refreshId = false) {
    if (refreshId) graph.graph.id = "liquid-glass-" + ++nextId;
    current.apply('url("#' + graph.graph.id + '")');
  }

  function paint() {
    if (!activeMap) return;
    const { geometry, options } = current;
    const { width, height, key } = geometry;
    const { refraction, chroma, blur, saturation, edgeHighlight } = options;
    const nextRender = [activeMap, key, refraction, chroma, content ? blur : 0,
      content ? saturation : 1, content ? edgeHighlight : 0];
    if (lastRender?.every((value, index) => value === nextRender[index])) {
      publish();
      return;
    }
    lastRender = nextRender;

    const flags = { chroma: !!chroma, blur: content && !!blur,
      saturation: content && saturation !== 1, rim: content && !!edgeHighlight };
    const nextTopology = Object.values(flags).join("/");
    if (topology !== nextTopology) {
      topology = nextTopology;
      graph = filterGraph(document, content, flags);
      defs.replaceChildren(graph.graph);
    }
    const { unit } = displacementUnits(engine, width, height, content);
    const scale = 2 * lensStrength(refraction, chroma, width, height) / unit;
    if (content) {
      const padX = 18 / width;
      const padY = 18 / height;
      attrs(graph.graph, { x: -padX, y: -padY, width: 1 + 2 * padX, height: 1 + 2 * padY });
    }
    const newImage = graph.map.getAttribute("href") !== activeMap;
    attrs(graph.map, { href: activeMap, width: content ? 1 : width, height: content ? 1 : height });
    for (const [index, node] of graph.displacements.entries()) {
      attrs(node, { scale: scale * (flags.chroma ? 1 + (index - 1) * chroma : 1) });
    }
    if (graph.blur) attrs(graph.blur, { stdDeviation: (blur / width) + " " + (blur / height) });
    if (graph.saturation) attrs(graph.saturation, { values: saturation });
    if (graph.rim) {
      attrs(graph.rim, { values: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 " + edgeHighlight + " 0 0" });
    }

    const webkit = content && engine === "webkit";
    publish(webkit);
    if (webkit && newImage) {
      // WebKit can cache the old result before its feImage finishes painting.
      view.clearTimeout(settleTimer);
      settleTimer = view.setTimeout(() => publish(true), 94);
    }
  }

  function render(geometry, options, apply) {
    current = { geometry, options, apply };
    if (requestedKey !== geometry.key) {
      requestedKey = geometry.key;
      mapFailed = false;
      const ticket = ++request;
      const map = getMap(document, engine, content, geometry);
      if (map.url) {
        activeMap = map.url;
      } else {
        map.ready.then((url) => {
          if (destroyed || ticket !== request) return;
          if (url) {
            activeMap = url;
            paint();
          } else if (!activeMap) {
            mapFailed = true;
            current.apply("");
          }
        });
      }
    }
    if (mapFailed) apply("");
    else paint();
  }

  function dispose() {
    destroyed = true;
    view.clearTimeout(settleTimer);
    root.remove();
  }

  return { render, dispose };
}
