import { liquidGlass } from "../src/liquid-glass.js";
import { bindCopy } from "./copy-code.js";
import { mountControlShowcase } from "./native-controls.js";

const byId = (id) => document.getElementById(id);
const stage = byId("stage");
const lens = byId("item");
const frame = byId("lens-frame");
const sceneArt = () => byId(stage.dataset.scene);
const mode = byId("mode");
const enabled = byId("enabled");
const pointer = byId("interactive");
const status = byId("renderer");
const example = byId("example");

const sliders = [
  ["width", "Width", 100, 420, 1, "px"],
  ["height", "Height", 54, 250, 1, "px"],
  ["radius", "Radius", 0, 128, 1, "px"],
  ["refraction", "Refraction", 0, 62, 1, "px"],
  ["bevel", "Bevel", 2, 64, 1, "px"],
  ["curvature", "Curvature", .5, 5, .1],
  ["chroma", "Chroma", 0, .8, .02],
  ["blur", "Frost", 0, 18, .5, "px"],
  ["saturation", "Saturation", 0, 2, .05],
  ["tint", "Tint", 0, .7, .01],
  ["glow", "Glow", 0, .8, .01],
  ["edgeHighlight", "Rim light", 0, 1, .02],
  ["lightAngle", "Light angle", 0, 360, 1, "°"],
];
const clear = {
  width: 250, height: 122, radius: 61, refraction: 30, bevel: 38, curvature: 3.1,
  chroma: 0, blur: 0, saturation: 1.24, tint: .045, glow: .13, edgeHighlight: .96, lightAngle: 145,
};
const presets = {
  clear,
  frost: { ...clear, refraction: 8, blur: 11, tint: .26, glow: .27, saturation: 1.05 },
  prism: { ...clear, radius: 41, refraction: 40, bevel: 43, curvature: 2.3, chroma: .26, glow: .16 },
};
let values = { ...clear };
let glass;
let topbarGlass;
let x = stage.clientWidth / 2;
let y = stage.clientHeight / 2;
let drag;
let metrics;
let sizeKey;
let updateFrame;
let moveFrame;
let pendingMove;

for (const [id, label, min, max, step, suffix = ""] of sliders) {
  const row = document.createElement("div");
  row.className = "slider";
  row.innerHTML = `<label for="${id}">${label}<output for="${id}" id="${id}-value"></output></label>
    <input id="${id}" type="range" min="${min}" max="${max}" step="${step}">`;
  byId("sliders").append(row);
  byId(id).addEventListener("input", (event) => {
    values[id] = event.target.valueAsNumber;
    const preset = byId("presets").querySelector(":checked");
    if (preset) preset.checked = false;
    byId(id + "-value").value = values[id] + suffix;
    if (updateFrame === undefined) updateFrame = requestAnimationFrame(update);
  });
}

function readSelection(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value;
}

function syncSliders() {
  for (const [id, , , , , suffix = ""] of sliders) {
    byId(id).value = values[id];
    byId(id + "-value").value = values[id] + suffix;
  }
}

function showStatus() {
  const labels = {
    content: "SVG · element content",
    backdrop: "SVG · live backdrop",
    sampled: "Sampled image",
    scene: "Scene copy",
    frost: "CSS · frosted glass",
  };
  const label = glass ? labels[glass.renderer] : "Glass disabled";
  if (status.textContent !== label) status.textContent = label;
  byId("topbar-renderer").textContent = topbarGlass ? labels[topbarGlass.renderer] : "Glass disabled";
  byId("renderer-note").hidden = !(glass && ["auto", "backdrop", "sampled"].includes(mode.value) && glass.renderer === "frost" && values.refraction > 0);
}
lens.addEventListener("liquidglass:rendererchange", showStatus);
byId("topbar").addEventListener("liquidglass:rendererchange", showStatus);

function coreOptions() {
  const { width, height, ...optics } = values;
  return {
    mode: mode.value,
    ...optics,
    backdrop: ["auto", "sampled"].includes(mode.value) ? sceneArt() : null,
    interactive: pointer.checked,
  };
}

function update() {
  if (updateFrame !== undefined) cancelAnimationFrame(updateFrame);
  updateFrame = undefined;
  const content = String(mode.value === "content");
  if (lens.dataset.content !== content) lens.dataset.content = content;
  const size = values.width + "/" + values.height;
  if (size !== sizeKey) {
    sizeKey = size;
    frame.style.setProperty("--demo-width", values.width + "px");
    frame.style.setProperty("--demo-height", values.height + "px");
    measure();
  }
  setStyle(frame, "--demo-radius", values.radius + "px");
  if (enabled.checked) {
    const options = coreOptions();
    if (glass) glass.update(options);
    else glass = liquidGlass(lens, options);
    // Discover media under the bar instead of supplying the playground source.
    const { backdrop, ...barOptions } = options;
    const scene = byId("header-scene").checked;
    const headerOptions = { ...barOptions, mode: scene ? "scene" : mode.value, scene: scene ? "page" : null, backdrop: null };
    if (topbarGlass) topbarGlass.update(headerOptions);
    else topbarGlass = liquidGlass(byId("topbar"), headerOptions);
  } else {
    glass?.destroy();
    glass = undefined;
    topbarGlass?.destroy();
    topbarGlass = undefined;
  }
  moveTo(x, y);
  showCode();
  showStatus();
}

function setStyle(element, name, value) {
  if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
}

function measure() {
  metrics = {
    width: stage.clientWidth,
    height: stage.clientHeight,
    halfWidth: frame.offsetWidth / 2,
    halfHeight: frame.offsetHeight / 2,
  };
}

function moveTo(nextX, nextY) {
  const { width, height, halfWidth, halfHeight } = metrics;
  const marginX = halfWidth + 6;
  const marginY = halfHeight + 6;
  x = Math.max(marginX, Math.min(width - marginX, nextX));
  y = Math.max(marginY, Math.min(height - marginY, nextY));
  setStyle(frame, "--lens-x", x + "px");
  setStyle(frame, "--lens-y", y + "px");

  if (mode.value === "content") {
    const photo = sceneArt();
    setStyle(lens, "--plate", `url("${photo.src}")`);
    const usePhoto = stage.dataset.scene === "photo" && photo.naturalWidth;
    const scale = usePhoto ? Math.max(width / photo.naturalWidth, height / photo.naturalHeight) : 1;
    const imageWidth = usePhoto ? photo.naturalWidth * scale : width;
    const imageHeight = usePhoto ? photo.naturalHeight * scale : height;
    setStyle(lens, "--plate-width", imageWidth + "px");
    setStyle(lens, "--plate-height", imageHeight + "px");
    setStyle(lens, "--plate-x", ((width - imageWidth) / 2 - x + halfWidth) + "px");
    setStyle(lens, "--plate-y", ((height - imageHeight) / 2 - y + halfHeight) + "px");
  }
  if (["auto", "sampled"].includes(mode.value) && glass?.renderer !== "backdrop") glass?.refresh();
}

lens.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || drag) return;
  drag = { id: event.pointerId, x: x - event.clientX, y: y - event.clientY };
  lens.setPointerCapture(event.pointerId);
});
lens.addEventListener("pointermove", (event) => {
  if (event.pointerId !== drag?.id) return;
  pendingMove = [event.clientX + drag.x, event.clientY + drag.y];
  if (moveFrame !== undefined) return;
  moveFrame = requestAnimationFrame(() => {
    moveFrame = undefined;
    moveTo(...pendingMove);
  });
});
lens.addEventListener("lostpointercapture", (event) => {
  if (event.pointerId === drag?.id) drag = undefined;
});

const directions = new Map([
  ["ArrowLeft", [-1, 0]], ["ArrowRight", [1, 0]], ["ArrowUp", [0, -1]], ["ArrowDown", [0, 1]],
]);
lens.addEventListener("keydown", (event) => {
  const direction = directions.get(event.key);
  if (!direction) return;
  event.preventDefault();
  const step = event.shiftKey ? 36 : 12;
  moveTo(x + direction[0] * step, y + direction[1] * step);
});

byId("scenes").addEventListener("change", () => {
  const scene = readSelection("scene");
  stage.dataset.scene = scene;
  update();
});
byId("test-header").addEventListener("click", () => {
  byId("scenes").querySelector('[value="grid"]').checked = true;
  stage.dataset.scene = "grid";
  update();
  moveTo(x, stage.clientHeight - metrics.halfHeight - 6);
  window.scrollTo({ top: window.scrollY + stage.getBoundingClientRect().top + stage.clientHeight / 3 - 8, behavior: "instant" });
});
mode.addEventListener("change", update);
enabled.addEventListener("change", update);
pointer.addEventListener("change", update);
byId("header-scene").addEventListener("change", update);
for (const image of stage.querySelectorAll(".scene-art")) image.addEventListener("load", update);

byId("presets").addEventListener("change", (event) => {
  values = { ...presets[event.target.value] };
  syncSliders();
  update();
});
byId("reset").addEventListener("click", () => {
  values = { ...clear };
  byId("presets").querySelector('[value="clear"]').checked = true;
  byId("scenes").querySelector('[value="photo"]').checked = true;
  stage.dataset.scene = "photo";
  mode.value = "auto";
  enabled.checked = pointer.checked = true;
  x = stage.clientWidth / 2;
  y = stage.clientHeight / 2;
  syncSliders();
  update();
});

function showCode() {
  const usesSource = ["auto", "sampled"].includes(mode.value);
  const options = `{ mode: "${mode.value}", radius: ${values.radius}, refraction: ${values.refraction}${usesSource ? ", backdrop: source" : ""} }`;
  const snippets = {
    js: [
      'import { liquidGlass } from "@ikeofficial/liquid-glass-js";',
      'import "@ikeofficial/liquid-glass-js/style.css";',
      '',
      'const item = document.querySelector("#item");',
      ...(usesSource ? [`const source = document.querySelector("#${stage.dataset.scene}");`] : []),
      `const glass = liquidGlass(item, ${options});`,
    ],
    angular: [
      'import { LiquidGlassDirective } from "@ikeofficial/liquid-glass-js/angular";',
      '// Import the shared stylesheet in your application styles.',
      '// Add LiquidGlassDirective to the component imports.',
      '',
      '<!-- Pass an options object from the component -->',
      '<button [liquidGlass]="options">Continue</button>',
    ],
    react: [
      'import { useLiquidGlass } from "@ikeofficial/liquid-glass-js/react";',
      'import "@ikeofficial/liquid-glass-js/style.css";',
      '',
      'function Action() {',
      '  const glass = useLiquidGlass({ mode: "content", radius: 24 });',
      '  return <button ref={glass}>Continue</button>;',
      '}',
    ],
    vue: [
      '<script setup lang="ts">',
      'import { vLiquidGlass } from "@ikeofficial/liquid-glass-js/vue";',
      'import "@ikeofficial/liquid-glass-js/style.css";',
      '</script>',
      '',
      '<template>',
      '  <button v-liquid-glass="{ mode: \'content\', radius: 24 }">Continue</button>',
      '</template>',
    ],
  };
  const code = snippets[readSelection("framework")].join("\n");
  if (example.textContent !== code) example.textContent = code;
}
byId("frameworks").addEventListener("change", showCode);
bindCopy(byId("copy"), example);
mountControlShowcase();

liquidGlass(byId("live-dom"), { mode: "content", radius: 19, blur: 0, refraction: 13, tint: .06 });

new ResizeObserver(() => {
  measure();
  moveTo(x, y);
}).observe(stage);
syncSliders();
update();
