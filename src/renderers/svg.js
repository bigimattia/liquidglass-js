import { lensStrength } from "../optics.js";

const namespace = "http://www.w3.org/2000/svg";
const documentMaps = new WeakMap();
let nextId = 0;

export function browserEngine(view) {
  const { userAgentData, userAgent } = view.navigator;
  if (userAgentData?.brands.some(({ brand }) => brand === "Chromium") || /\b(?:Chrome|Chromium)\//.test(userAgent)) {
    return "blink";
  }
  if (/Firefox\//.test(userAgent)) return "gecko";
  return /AppleWebKit\//.test(userAgent) ? "webkit" : "unknown";
}

export function attrs(node, attributes) {
  for (const [key, value] of Object.entries(attributes)) {
    const text = String(value);
    if (node.getAttribute(key) !== text) node.setAttribute(key, text);
  }
  return node;
}

export function svg(document, name, attributes) {
  return attrs(document.createElementNS(namespace, name), attributes);
}

export function filterRoot(element) {
  const document = element.ownerDocument;
  const root = svg(document, "svg", { width: 0, height: 0, "aria-hidden": "true" });
  root.style.cssText = "position:absolute;overflow:hidden;pointer-events:none";
  const defs = svg(document, "defs", {});
  root.append(defs);
  const tree = element.getRootNode();
  (tree === document ? document.body : tree).append(root);
  return { root, defs };
}

export function filterId() {
  return "liquid-glass-" + ++nextId;
}

export function getMap(document, geometry, feather = false) {
  if (!documentMaps.has(document)) {
    documentMaps.set(document, { entries: new Map(), canvas: document.createElement("canvas") });
  }
  const { entries, canvas } = documentMaps.get(document);
  const key = (feather ? "viewport/" : "backdrop/") + geometry.key;
  let entry = entries.get(key);
  if (entry) {
    entries.delete(key);
    entries.set(key, entry);
    return entry;
  }

  const { columns, rows, offsets, coverage } = geometry;
  canvas.width = columns;
  canvas.height = rows;
  const context = canvas.getContext("2d");
  entry = { url: null, ready: Promise.resolve(null) };
  if (context) {
    const image = context.createImageData(columns, rows);
    const pixels = image.data;
    for (let index = 0; index < coverage.length; index++) {
      const pixel = 4 * index;
      // Fade the displacement itself so the viewport map stays opaque at the rim.
      const weight = feather ? 127 * coverage[index] / 255 : 127.5;
      const neutral = feather ? 128 : 127.5;
      pixels[pixel] = neutral + weight * offsets[2 * index];
      pixels[pixel + 1] = neutral + weight * offsets[2 * index + 1];
      pixels[pixel + 3] = 255;
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

export function appendRefraction(graph, chromatic) {
  function add(name, attributes) {
    const node = svg(graph.ownerDocument, name, attributes);
    graph.append(node);
    return node;
  }
  function displace(result) {
    return add("feDisplacementMap", {
      in: "SourceGraphic", in2: "offsets", xChannelSelector: "R", yChannelSelector: "G", result,
    });
  }
  if (!chromatic) return [displace("warped")];

  const displacements = [];
  for (const [channel, name] of ["red", "green", "blue"].entries()) {
    displacements.push(displace(name));
    const matrix = Array(20).fill(0);
    matrix[channel * 6] = matrix[19] = 1;
    add("feColorMatrix", { in: name, values: matrix.join(" "), result: name + "Only" });
  }
  add("feBlend", { in: "redOnly", in2: "greenOnly", mode: "screen", result: "redGreen" });
  add("feBlend", { in: "redGreen", in2: "blueOnly", mode: "screen", result: "rgb" });
  add("feComposite", { in: "rgb", in2: "green", operator: "in", result: "warped" });
  return displacements;
}

export function setDisplacement(nodes, scale, chroma) {
  for (const [index, node] of nodes.entries()) {
    attrs(node, { scale: scale * (nodes.length === 1 ? 1 : 1 + (index - 1) * chroma) });
  }
}

export function makeMapRequest(document, feather, repaint) {
  let requestedKey;
  let request = 0;
  const state = { url: null, failed: false, requestMap, cancel };

  function requestMap(geometry) {
    if (requestedKey === geometry.key) return;
    requestedKey = geometry.key;
    state.failed = false;
    const ticket = ++request;
    const map = getMap(document, geometry, feather);
    if (map.url) {
      state.url = map.url;
      return;
    }
    map.ready.then((url) => {
      if (ticket !== request) return;
      state.url = url;
      state.failed = !url;
      repaint();
    });
  }

  function cancel() {
    request++;
  }

  return state;
}

export function makeSvgLens(element) {
  const { root, defs } = filterRoot(element);
  const mapRequest = makeMapRequest(element.ownerDocument, false, paint);
  let current;
  let graph;
  let map;
  let displacements;
  let chromatic;

  function paint() {
    const { geometry, options, apply } = current;
    if (mapRequest.failed) {
      apply("");
      return;
    }
    if (!mapRequest.url) return;
    const { width, height } = geometry;
    const { refraction, chroma } = options;
    if (chromatic !== !!chroma) {
      chromatic = !!chroma;
      graph = svg(element.ownerDocument, "filter", {
        id: filterId(), x: 0, y: 0, width: 1, height: 1,
        primitiveUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB",
      });
      map = svg(element.ownerDocument, "feImage", {
        x: 0, y: 0, preserveAspectRatio: "none", result: "offsets",
      });
      graph.append(map);
      displacements = appendRefraction(graph, chromatic);
      defs.replaceChildren(graph);
    }
    attrs(map, { href: mapRequest.url, width, height });
    setDisplacement(displacements, 2 * lensStrength(refraction, chroma, width, height), chroma);
    apply('url("#' + graph.id + '")');
  }

  return {
    render(geometry, options, apply) {
      current = { geometry, options, apply };
      mapRequest.requestMap(geometry);
      paint();
    },
    dispose() {
      mapRequest.cancel();
      root.remove();
    },
  };
}
