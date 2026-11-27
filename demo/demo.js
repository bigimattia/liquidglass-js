import { liquidGlass } from "../src/liquid-glass.js";
import { bindCopy } from "./copy-code.js";
import { mountControlShowcase } from "./native-controls.js";

const viewportDefaults = { refraction: 28, radius: 22, bevel: 32, curvature: 2, chroma: 0 };
const byId = (id) => document.getElementById(id);
const readSelection = (name) => document.querySelector(`input[name="${name}"]:checked`).value;

function mountSliders(container, definitions, change) {
  const controls = definitions.map(([key, label, min, max, step, suffix = ""]) => {
    const id = container.id + "-" + key;
    const row = document.createElement("div");
    row.className = key === "refraction" ? "slider primary-setting" : "slider advanced-setting";
    row.innerHTML = `<label for="${id}">${label}<output for="${id}"></output></label>
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}">`;
    container.append(row);
    const input = row.querySelector("input");
    const output = row.querySelector("output");
    input.addEventListener("input", () => {
      output.value = input.value + suffix;
      change(key, input.valueAsNumber);
    });
    return { key, input, output, suffix };
  });
  return (settings, disabled = false) => {
    for (const { key, input, output, suffix } of controls) {
      input.value = settings[key];
      output.value = input.value + suffix;
      input.disabled = disabled;
    }
  };
}

const playground = byId("playground");
const viewportScene = byId("viewport-scene");
const viewportLens = byId("viewport-lens");
const viewportMode = byId("viewport-mode");
const viewportStatus = byId("viewport-status");
const viewportValues = { ...viewportDefaults };
let viewportClicks = 0;

const syncViewport = mountSliders(
  byId("viewport-sliders"),
  [
    ["refraction", "Refraction", 0, 62, 1, "px"],
    ["radius", "Radius", 0, 48, 1, "px"],
    ["bevel", "Bevel", 2, 64, 1, "px"],
    ["curvature", "Curvature", .5, 5, .1],
    ["chroma", "Chroma", 0, .8, .02],
  ],
  (key, value) => {
    viewportValues[key] = value;
    updateViewport();
  },
);

function usageExample(language, mode) {
  const usesSource = mode === "auto" || mode === "viewport";
  const { refraction, radius, bevel, curvature, chroma } = viewportValues;
  const customOptics = Object.keys(viewportDefaults).some((key) =>
    key !== "refraction" && viewportValues[key] !== viewportDefaults[key]);
  const settings = playground.dataset.detail === "advanced" || customOptics
    ? `refraction: ${refraction}, radius: ${radius}, bevel: ${bevel}, curvature: ${curvature}, chroma: ${chroma}`
    : `refraction: ${refraction}`;
  const options = `{ mode: "${mode}", ${usesSource ? 'viewportSource: "#glass-feed", ' : ""}${settings} }`;
  const stylesheet = 'import "@ikeofficial/liquid-glass-js/style.css";';
  const css = `.glass-shell { position: relative; isolation: isolate; }
.glass-source { height: 24rem; overflow: auto; background: #dbece0; }
.glass-content {
  min-height: 40rem; padding: 8rem 1.5rem;
  background: repeating-linear-gradient(128deg, #1c584c44 0 2px, transparent 2px 20px);
}
.glass-bar { position: absolute; inset: 20px 20px auto; height: 88px; pointer-events: none; }
.glass-lens { position: absolute; inset: 0; }
.glass-bar button { position: relative; margin: 1rem; pointer-events: auto; }`;
  function markup(lens, reference = "") {
    return `<div class="glass-shell">
  <main id="glass-feed"${reference} class="glass-source" tabindex="0">
    <div class="glass-content"><h1>Live content</h1><p>Scroll through the glass.</p></div>
  </main>
  <header class="glass-bar">
    <div class="glass-lens" ${lens} aria-hidden="true"></div>
    <button type="button">Menu</button>
  </header>
</div>`;
  }
  const indent = (text, spaces) => text.replace(/^/gm, " ".repeat(spaces));

  if (language === "angular") {
    const binding = `{ mode: '${mode}', ${usesSource ? "viewportSource: feed, " : ""}${settings} }`;
    const template = markup(`[liquidGlass]="${binding}"`, usesSource ? " #feed" : "");
    return `import { Component } from "@angular/core";
import { LiquidGlassDirective } from "@ikeofficial/liquid-glass-js/angular";

// Add "@ikeofficial/liquid-glass-js/style.css" to your global styles.
@Component({
  selector: "glass-example",
  imports: [LiquidGlassDirective],
  template: \`
${indent(template, 4)}
  \`,
  styles: \`
${indent(css, 4)}
  \`,
})
export class GlassExample {}`;
  }

  if (language === "react") {
    const jsx = markup("ref={glass}").replaceAll("class=", "className=").replace('tabindex="0"', "tabIndex={0}");
    return `import { useLiquidGlass } from "@ikeofficial/liquid-glass-js/react";
${stylesheet}

export function GlassExample() {
  const glass = useLiquidGlass(${options});
  return (
    <>
      <style>{\`${css}\`}</style>
${indent(jsx, 6)}
    </>
  );
}`;
  }

  if (language === "vue") {
    return `<script setup>
import { vLiquidGlass } from "@ikeofficial/liquid-glass-js/vue";
${stylesheet}
const options = ${options};
</script>

<template>
${indent(markup('v-liquid-glass="options"'), 2)}
</template>

<style scoped>
${css}
</style>`;
  }

  return `${markup('id="glass-lens"')}

<style>
${indent(css, 2)}
</style>

<script type="module">
  import { liquidGlass } from "@ikeofficial/liquid-glass-js";
  ${stylesheet}

  const glass = liquidGlass(document.querySelector("#glass-lens"), ${options});
  // Call glass.destroy() when removing the example.
</script>`;
}

const viewportGlass = liquidGlass(viewportLens, {
  ...viewportValues, mode: viewportMode.value, viewportSource: viewportScene,
  interactive: false, tint: .08, glow: .14,
});

const rendererLabels = { backdrop: "Native backdrop", viewport: "Viewport SVG", frost: "Frosted glass", off: "Glass off" };
function showRenderer() {
  viewportStatus.textContent = rendererLabels[viewportGlass.renderer];
}

function updateViewport() {
  viewportGlass.update({ ...viewportValues, mode: viewportMode.value });
  showRenderer();
  showUsage();
}

viewportLens.addEventListener("liquidglass:rendererchange", showRenderer);
viewportMode.addEventListener("change", () => {
  syncViewport(viewportValues, viewportMode.value === "off");
  updateViewport();
});
byId("viewport-reset").addEventListener("click", () => {
  Object.assign(viewportValues, viewportDefaults);
  viewportMode.value = "auto";
  viewportScene.scrollTop = 0;
  syncViewport(viewportValues);
  updateViewport();
});
byId("viewport-scroll").addEventListener("click", () => {
  viewportScene.scrollTop = viewportScene.scrollTop + viewportScene.clientHeight >= viewportScene.scrollHeight - 1
    ? 0 : viewportScene.scrollTop + 160;
});
byId("viewport-action").addEventListener("click", () => {
  byId("viewport-count").textContent = ++viewportClicks;
});
byId("detail").addEventListener("change", () => {
  playground.dataset.detail = readSelection("detail");
  showUsage();
});
const artwork = {
  photo: ["./shore.jpg", "Rocky coast with waves"],
  grid: ["./grid.svg", "Calibration grid"],
  type: ["./type.svg", "Typography specimen"],
};
const artworkImage = byId("viewport-art");
function showArtwork() {
  const [src, alt] = artwork[readSelection("artwork")];
  artworkImage.src = src;
  artworkImage.alt = alt;
}
byId("artwork-choice").addEventListener("change", showArtwork);

const example = byId("example");
const usageDescription = byId("usage-description");
const usageRenderer = byId("usage-renderer");

const usageNotes = {
  auto: "Automatic is the default. It tries native backdrop, then the configured viewport source, then frost.",
  viewport: "Viewport SVG uses the declared scroll pane as its source and falls back to frost.",
  backdrop: "Native backdrop refracts the page behind the lens where supported and falls back to frost.",
  frost: "Frosted glass uses CSS blur, tint, and highlights.",
  off: "Off removes the glass treatment and restores author styling.",
};

function showUsage() {
  const mode = usageRenderer.value;
  usageDescription.textContent = usageNotes[mode];
  example.textContent = usageExample(readSelection("framework"), mode);
}

byId("frameworks").addEventListener("change", showUsage);
usageRenderer.addEventListener("change", showUsage);
bindCopy(byId("copy"), example);
mountControlShowcase();
liquidGlass(document.querySelector(".topbar"), {
  mode: "auto", radius: 24, blur: 12, refraction: 14,
  tint: .42, glow: .18, interactive: false,
});

showArtwork();
syncViewport(viewportValues);
updateViewport();
