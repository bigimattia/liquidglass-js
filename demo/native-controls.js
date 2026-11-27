import { liquidGlass } from "../src/liquid-glass.js";
import { bindCopy } from "./copy-code.js";

const shell = "relative isolate overflow-hidden rounded-full shadow-[0_5px_18px_#243c6538] ring-1 ring-inset ring-white/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-800";
const optics = "pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,#ffffffeb,#ffffff32_38%,#6e87bf24_68%,#ffffffa6)]";
const lensBox = "pointer-events-none absolute inset-0";
const lens = (name) => `
  <span data-glass-source="${name}" class="${optics}" aria-hidden="true"></span>
  <span data-lens class="${lensBox}" aria-hidden="true"></span>`;
const mediaLens = `<span data-lens class="${lensBox} bg-white/10" aria-hidden="true"></span>`;
const mediaButton = (action, label, graphic) => `<button type="button" data-${action} aria-label="${label}"
  class="${shell} grid size-10 shrink-0 cursor-pointer place-items-center border-0 bg-white/20 text-white hover:bg-white/35 active:scale-95 sm:size-12">
  ${mediaLens}
  <span class="relative z-10 font-semibold [text-shadow:0_1px_5px_#11253a]" aria-hidden="true">${graphic}</span>
</button>`;

function toggleSaved(root, signal) {
  const button = root.querySelector("[data-save]");
  const label = button?.querySelector("[data-label]");
  if (!button || !label) return;
  button.addEventListener("click", () => {
    const saved = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(saved));
    label.textContent = saved ? "Preset saved" : "Save preset";
  }, { signal });
}

function syncVolume(root, signal) {
  const input = root.querySelector("input");
  const value = root.querySelector("output");
  const track = root.querySelector("[data-track]");
  if (!input || !value || !track) return;
  const update = () => {
    value.value = input.value + "%";
    track.style.setProperty("--level", String(input.valueAsNumber / 100));
  };
  input.addEventListener("input", update, { signal });
  update();
}

function bindMedia(root, signal) {
  const video = root.querySelector("video");
  const play = root.querySelector("[data-play]");
  const seek = root.querySelector("[data-seek]");
  const error = root.querySelector("[data-media-error]");
  const icon = play?.querySelector("[data-icon]");
  const rewind = root.querySelector("[data-rewind]");
  const forward = root.querySelector("[data-forward]");
  if (!video || !play || !seek || !error || !icon || !rewind || !forward) return;
  const duration = () => Number.isFinite(video.duration) ? video.duration : 0;

  const sync = () => {
    const paused = video.paused || video.ended;
    play.setAttribute("aria-label", paused ? "Play" : "Pause");
    icon.textContent = paused ? "▶" : "Ⅱ";
    seek.max = String(duration());
    seek.value = String(video.currentTime);
    seek.disabled = !duration();
  };

  const jump = (time) => {
    if (duration()) video.currentTime = Math.max(0, Math.min(duration(), time));
  };

  play.addEventListener("click", () => {
    if (video.paused || video.ended) {
      video.play().then(() => { error.hidden = true; }, () => { error.hidden = false; });
    } else {
      video.pause();
    }
  }, { signal });
  rewind.addEventListener("click", () => jump(video.currentTime - 2), { signal });
  forward.addEventListener("click", () => jump(video.currentTime + 2), { signal });
  seek.addEventListener("input", () => jump(seek.valueAsNumber), { signal });
  for (const event of ["loadedmetadata", "durationchange", "timeupdate", "play", "pause", "ended"]) {
    video.addEventListener(event, sync, { signal });
  }
  video.addEventListener("error", () => { error.hidden = false; }, { signal });
  error.hidden = !video.error;
  sync();
}

const examples = {
  action: {
    html: `<button type="button" data-save aria-pressed="false"
  class="${shell} group inline-flex min-h-14 min-w-48 cursor-pointer items-center justify-center gap-2.5 border-0 bg-white/36 px-6 font-semibold tracking-tight text-slate-950 transition duration-200 ease-out hover:bg-white/65 active:scale-95 aria-pressed:bg-emerald-100/75 motion-reduce:transition-none">
  ${lens("action")}
  <span class="relative z-10 grid size-6 shrink-0 place-items-center text-indigo-700 group-aria-pressed:text-emerald-800" aria-hidden="true">
    <span class="group-aria-pressed:hidden">＋</span>
    <span class="hidden group-aria-pressed:block">✓</span>
  </span>
  <span data-label class="relative z-10">Save preset</span>
</button>`,
    options: { viewportSource: "[data-glass-source=action]", radius: 40, refraction: 17, bevel: 22 },
    enhance: toggleSaved,
  },
  switch: {
    html: `<label class="group inline-flex cursor-pointer items-center gap-3 rounded-3xl bg-white/38 px-4 py-3 font-medium text-slate-950 shadow-[0_8px_24px_#36574626] ring-1 ring-inset ring-white/65">
  <input type="checkbox" role="switch" class="peer sr-only" />
  <span class="relative h-9 w-16 rounded-full bg-slate-500/35 shadow-inner ring-1 ring-inset ring-white/55 transition-colors peer-checked:bg-emerald-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-indigo-800 motion-reduce:transition-none" aria-hidden="true">
    <span class="${shell} absolute! top-1 left-1 size-7 bg-white/75 transition-transform duration-300 ease-[cubic-bezier(.2,.7,.25,1.2)] group-has-checked:translate-x-7 motion-reduce:transition-none">
      ${lens("switch")}
    </span>
  </span>
  <span>Reflections</span>
</label>`,
    options: { viewportSource: "[data-glass-source=switch]", radius: 24, refraction: 11, bevel: 14 },
  },
  slider: {
    html: `<div class="w-full max-w-sm rounded-3xl border border-white/60 bg-white/40 px-5 py-4 font-medium text-slate-950 shadow-[0_10px_28px_#39276a32]">
  <label class="block">
    <span class="flex justify-between">Volume <output aria-hidden="true">62%</output></span>
    <span data-track class="relative mt-2 block h-10 rounded-full [--level:.62] focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-indigo-800">
      <span class="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,#6847cf_calc(var(--level)*100%),#af9fca_0)]" aria-hidden="true"></span>
      <span class="${shell} pointer-events-none absolute! top-1/2 left-[calc(var(--level)*(100%-2.5rem)+1.25rem)] h-6 w-10 -translate-x-1/2 -translate-y-1/2 bg-white/65" aria-hidden="true">
        ${lens("slider")}
      </span>
      <input type="range" min="0" max="100" value="62" class="absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-10 [&::-webkit-slider-thumb]:appearance-none [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-10" />
    </span>
  </label>
</div>`,
    options: { viewportSource: "[data-glass-source=slider]", radius: 18, refraction: 10, bevel: 11 },
    enhance: syncVolume,
  },
  segmented: {
    html: `<fieldset class="relative m-0 grid min-w-0 grid-cols-3 rounded-full border border-white/65 bg-slate-600/15 p-1 shadow-[0_10px_28px_#25486430] text-sm font-medium text-slate-950 [--index:0] has-[[value=week]:checked]:[--index:1] has-[[value=month]:checked]:[--index:2]">
  <legend class="sr-only">Time range</legend>
  <span class="${shell} pointer-events-none absolute! inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] translate-x-[calc(var(--index)*100%)] bg-white/75 transition-transform duration-300 ease-[cubic-bezier(.2,.7,.25,1.15)] motion-reduce:transition-none" aria-hidden="true">
    ${lens("segmented")}
  </span>
  <label class="relative cursor-pointer rounded-full px-4 py-2 text-center focus-within:outline-2 focus-within:outline-indigo-800"><input class="sr-only" type="radio" name="period" value="day" checked />Day</label>
  <label class="relative cursor-pointer rounded-full px-4 py-2 text-center focus-within:outline-2 focus-within:outline-indigo-800"><input class="sr-only" type="radio" name="period" value="week" />Week</label>
  <label class="relative cursor-pointer rounded-full px-4 py-2 text-center focus-within:outline-2 focus-within:outline-indigo-800"><input class="sr-only" type="radio" name="period" value="month" />Month</label>
</fieldset>`,
    options: { viewportSource: "[data-glass-source=segmented]", radius: 28, refraction: 13, bevel: 16 },
  },
  media: {
    html: `<div class="relative aspect-video w-full max-w-2xl overflow-hidden rounded-2xl bg-slate-950 shadow-2xl ring-1 ring-white/30">
  <video src="./shore-motion.mp4" poster="./shore.jpg" muted playsinline preload="metadata"
    class="absolute inset-0 size-full object-cover" aria-label="Animated shoreline"></video>
  <div class="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-linear-to-t from-slate-950/75 to-transparent p-3 pt-8 sm:flex-nowrap">
    ${mediaButton("rewind", "Back 2 seconds", "−2")}
    ${mediaButton("play", "Play", "<span data-icon>▶</span>")}
    ${mediaButton("forward", "Forward 2 seconds", "+2")}
    <div class="${shell} flex h-10 min-w-24 flex-1 items-center px-3 sm:h-12">
      ${mediaLens}
      <input data-seek type="range" aria-label="Seek video" min="0" max="0" step="0.01" disabled
        class="relative z-10 m-0 w-full cursor-pointer accent-white focus-visible:outline-2 focus-visible:outline-white" />
    </div>
  </div>
  <p data-media-error role="status" hidden class="absolute inset-x-3 top-3 rounded-lg bg-black/75 p-2 text-sm text-white">Unable to play the video.</p>
</div>`,
    options: { radius: 24, refraction: 13, bevel: 14 },
    enhance: bindMedia,
  },
};

function optionsFor(example, mode) {
  const { viewportSource, ...optics } = example.options;
  return {
    mode, ...optics, blur: mode === "frost" ? 6 : 2, tint: .03, glow: .12, edgeHighlight: .9,
    ...((mode === "auto" || mode === "viewport") && viewportSource ? { viewportSource } : {}),
  };
}

function sourceCode(example, framework, settings) {
  const { html, enhance } = example;
  const template = (markup) => markup.replace(/^/gm, "    ");
  const style = 'import "@ikeofficial/liquid-glass-js/style.css";';
  const options = JSON.stringify(settings).replace(/"([a-zA-Z]+)":/g, "$1: ").replace(/,/g, ", ");
  const behavior = enhance ? "\n" + enhance.toString() + "\n" : "";
  const typedBehavior = behavior.replace("(root, signal)", "(root: HTMLElement, signal: AbortSignal)")
    .replace('(time) =>', '(time: number) =>')
    .replace('querySelector("[data-track]")', 'querySelector<HTMLElement>("[data-track]")')
    .replace('querySelector("[data-seek]")', 'querySelector<HTMLInputElement>("[data-seek]")')
    .replace('querySelector("[data-media-error]")', 'querySelector<HTMLElement>("[data-media-error]")');
  const attach = enhance ? `\n    ${enhance.name}(root, events.signal);` : "";

  if (framework === "html") return html;
  if (framework === "js") {
    return `import { liquidGlass } from "@ikeofficial/liquid-glass-js";
${style}
${behavior}
// Wrap the HTML example in an element with id="glass-example".
const root = document.querySelector("#glass-example");
const events = new AbortController();
const options = ${options};
const lenses = [...root.querySelectorAll("[data-lens]")].map((element) =>
  liquidGlass(element, { ...options }),
);${attach.trimEnd().replace(/\n    /g, "\n")}

export function dispose() {
  events.abort();
  lenses.forEach((glass) => glass.destroy());
}`;
  }
  if (framework === "angular") {
    // Angular template bindings use single-quoted string literals inside the attribute.
    const binding = options.replaceAll('"', "'");
    const markup = html.replaceAll("data-lens", '[liquidGlass]="options"');
    return `import { Component${enhance ? ", afterNextRender, DestroyRef, ElementRef, inject" : ""} } from "@angular/core";
import { LiquidGlassDirective } from "@ikeofficial/liquid-glass-js/angular";
import type { LiquidGlassOptions } from "@ikeofficial/liquid-glass-js";

// Add "@ikeofficial/liquid-glass-js/style.css" to the application's global styles.
${typedBehavior}
@Component({
  selector: "app-glass-control",
  imports: [LiquidGlassDirective],
  template: \`
${template(markup)}
  \`,
})
export class GlassControl {
  readonly options: LiquidGlassOptions = ${binding};
${enhance ? `
  constructor() {
    const root = inject(ElementRef<HTMLElement>).nativeElement;
    const events = new AbortController();
    inject(DestroyRef).onDestroy(() => events.abort());
    afterNextRender(() => ${enhance.name}(root, events.signal));
  }
` : ""}}`;
  }
  if (framework === "vue") {
    const markup = html.replaceAll("data-lens", 'v-liquid-glass="options"').replace(/^<([a-z]+)/, enhance ? '<$1 ref="root"' : "<$1");
    return `<script setup lang="ts">
${enhance ? 'import { onMounted, onBeforeUnmount, ref } from "vue";\n' : ""}import { vLiquidGlass } from "@ikeofficial/liquid-glass-js/vue";
import type { LiquidGlassOptions } from "@ikeofficial/liquid-glass-js";
${style}
${typedBehavior}
const options: LiquidGlassOptions = ${options};
${enhance ? `
const root = ref<HTMLElement | null>(null);
const events = new AbortController();
onMounted(() => { if (root.value) ${enhance.name}(root.value, events.signal); });
onBeforeUnmount(() => events.abort());` : ""}
</script>

<template>
${template(markup)}
</template>`;
  }

  let number = 0;
  const markup = html.replaceAll("data-lens", () => `ref={glass${++number}}`)
    .replaceAll("class=", "className=").replace('value="62"', 'defaultValue="62"')
    .replace(/ checked\b/g, " defaultChecked").replace("playsinline", "playsInline");
  const hooks = Array.from({ length: number }, (_, index) =>
    `  const glass${index + 1} = useLiquidGlass<HTMLSpanElement>(options);`).join("\n");
  return `import { useLiquidGlass } from "@ikeofficial/liquid-glass-js/react";
${enhance ? `import { useEffect, useRef } from "react";\n` : ""}import type { LiquidGlassOptions } from "@ikeofficial/liquid-glass-js";
${style}
${typedBehavior}
export function GlassControl() {
  const options: LiquidGlassOptions = ${options};
${hooks}
${enhance ? `
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const events = new AbortController();${attach}
    return () => events.abort();
  }, []);
` : ""}
  return (
${template(enhance ? `<div ref={container}>\n${htmlIndent(markup)}\n</div>` : markup)}
  );
}`;
}

function htmlIndent(markup) {
  return markup.replace(/^/gm, "  ");
}

export function mountControlShowcase() {
  const preview = document.getElementById("control-preview");
  const output = document.getElementById("control-code");
  const selector = document.getElementById("control-selector");
  const renderer = document.getElementById("control-renderer");
  const status = document.getElementById("control-renderer-status");
  const language = document.getElementById("control-code-selector");
  let controllers = [];
  let events;

  function selectedExample() {
    return examples[selector.querySelector(":checked").value];
  }

  function displaySource() {
    output.textContent = sourceCode(
      selectedExample(), language.querySelector(":checked").value,
      optionsFor(selectedExample(), renderer.value),
    );
  }

  function showRenderer() {
    const active = new Set(controllers.map((glass) => glass.renderer));
    const labels = [...renderer.options].filter(({ value }) => active.has(value)).map(({ text }) => text);
    const note = renderer.value === "viewport" && !selectedExample().options.viewportSource
      ? " This example has no viewport source." : "";
    status.textContent = "Rendering with " + labels.join(", ") + "." + note;
  }

  function select() {
    const example = selectedExample();
    events?.abort();
    controllers.forEach((glass) => glass.destroy());
    preview.querySelector("video")?.pause();
    preview.dataset.control = selector.querySelector(":checked").value;
    preview.innerHTML = example.html;
    events = new AbortController();
    const options = optionsFor(example, renderer.value);
    controllers = Array.from(preview.querySelectorAll("[data-lens]"), (element) => {
      element.addEventListener("liquidglass:rendererchange", showRenderer, { signal: events.signal });
      return liquidGlass(element, options);
    });
    example.enhance?.(preview, events.signal);
    showRenderer();
    displaySource();
  }

  selector.addEventListener("change", select);
  renderer.addEventListener("change", () => {
    const options = optionsFor(selectedExample(), renderer.value);
    controllers.forEach((glass) => glass.update(options, { replace: true }));
    showRenderer();
    displaySource();
  });
  language.addEventListener("change", displaySource);
  bindCopy(document.getElementById("copy-control"), output);
  select();
}
