import { liquidGlass } from "../src/liquid-glass.js";
import { bindCopy } from "./copy-code.js";

const shell = "relative isolate overflow-hidden rounded-full shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";
const optics = "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_25%_15%,#e8ffff9c,#6cc8db55_45%,#26627e66_80%,#a3efffb0)]";
const mediaOptics = "pointer-events-none absolute inset-0";
const lens = (classes = optics) => `<span data-lens class="${classes}" aria-hidden="true"></span>`;
const mediaButton = (action, label, graphic) => `<button type="button" data-${action} aria-label="${label}"
  class="${shell} grid size-10 shrink-0 cursor-pointer place-items-center border-0 bg-transparent text-white sm:size-12">
  ${lens(mediaOptics)}
  <span class="relative z-10 font-semibold [text-shadow:0_1px_6px_#031926]" aria-hidden="true">${graphic}</span>
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
  class="${shell} inline-grid min-h-14 min-w-44 cursor-pointer place-items-center border-0 bg-cyan-700/30 px-6 font-semibold text-white active:scale-95 aria-pressed:bg-emerald-700/70">
  ${lens()}
  <span data-label class="relative z-10 [text-shadow:0_1px_6px_#031926]">Save preset</span>
</button>`,
    options: { mode: "content", radius: 40, refraction: 17, bevel: 22 },
    enhance: toggleSaved,
  },
  switch: {
    html: `<label class="group inline-flex cursor-pointer items-center gap-4 font-semibold text-white">
  <input type="checkbox" role="switch" class="peer sr-only" />
  <span class="relative h-11 w-20 rounded-full bg-slate-800/70 shadow-inner transition-colors peer-checked:bg-emerald-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-white" aria-hidden="true">
    <span class="${shell} absolute! top-1 left-1 size-9 bg-cyan-200/40 transition-transform group-has-checked:translate-x-9 motion-reduce:transition-none">
      ${lens()}
    </span>
  </span>
  <span>Reflections</span>
</label>`,
    options: { mode: "content", radius: 24, refraction: 11, bevel: 14 },
  },
  slider: {
    html: `<div class="w-full max-w-sm font-semibold text-white [text-shadow:0_1px_6px_#031926]">
  <label class="block">
    <span class="flex justify-between">Volume <output aria-hidden="true">62%</output></span>
    <span data-track class="relative mt-2 block h-10 rounded-full [--level:.62] focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-white">
      <span class="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,#90edeb_calc(var(--level)*100%),#3d5d73_0)]" aria-hidden="true"></span>
      <span class="${shell} pointer-events-none absolute! top-1/2 left-[calc(var(--level)*(100%-2rem)+1rem)] size-8 -translate-x-1/2 -translate-y-1/2 bg-cyan-200/40" aria-hidden="true">
        ${lens()}
      </span>
      <input type="range" min="0" max="100" value="62" class="absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0 [&::-webkit-slider-thumb]:size-8 [&::-webkit-slider-thumb]:appearance-none [&::-moz-range-thumb]:size-8" />
    </span>
  </label>
</div>`,
    options: { mode: "content", radius: 18, refraction: 10, bevel: 11 },
    enhance: syncVolume,
  },
  segmented: {
    html: `<fieldset class="relative m-0 grid min-w-0 grid-cols-3 rounded-full border border-white/40 bg-slate-900/65 p-1 text-sm font-semibold text-white [--index:0] has-[[value=week]:checked]:[--index:1] has-[[value=month]:checked]:[--index:2]">
  <legend class="sr-only">Time range</legend>
  <span class="${shell} pointer-events-none absolute! inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] translate-x-[calc(var(--index)*100%)] bg-cyan-200/40 transition-transform motion-reduce:transition-none" aria-hidden="true">
    ${lens()}
  </span>
  <label class="relative cursor-pointer rounded-full px-4 py-2 text-center focus-within:outline-2"><input class="sr-only" type="radio" name="period" value="day" checked />Day</label>
  <label class="relative cursor-pointer rounded-full px-4 py-2 text-center focus-within:outline-2"><input class="sr-only" type="radio" name="period" value="week" />Week</label>
  <label class="relative cursor-pointer rounded-full px-4 py-2 text-center focus-within:outline-2"><input class="sr-only" type="radio" name="period" value="month" />Month</label>
</fieldset>`,
    options: { mode: "content", radius: 28, refraction: 13, bevel: 16 },
  },
  media: {
    html: `<div class="relative aspect-video w-full max-w-2xl overflow-hidden rounded-2xl bg-slate-950">
  <video src="./shore-motion.mp4" poster="./shore.jpg" muted playsinline preload="metadata"
    class="absolute inset-0 size-full object-cover" aria-label="Animated shoreline"></video>
  <div class="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-linear-to-t from-black/70 to-transparent p-3 pt-8 sm:flex-nowrap">
    ${mediaButton("rewind", "Back 2 seconds", "−2")}
    ${mediaButton("play", "Play", "<span data-icon>▶</span>")}
    ${mediaButton("forward", "Forward 2 seconds", "+2")}
    <div class="${shell} flex h-10 min-w-24 flex-1 items-center px-3 sm:h-12">
      ${lens(mediaOptics)}
      <input data-seek type="range" aria-label="Seek video" min="0" max="0" step="0.01" disabled
        class="relative z-10 m-0 w-full cursor-pointer accent-white focus-visible:outline-2 focus-visible:outline-white" />
    </div>
  </div>
  <p data-media-error role="status" hidden class="absolute inset-x-3 top-3 rounded-lg bg-black/75 p-2 text-sm text-white">Unable to play the video.</p>
</div>`,
    options: { mode: "sampled", radius: 24, refraction: 13, bevel: 14 },
    enhance: bindMedia,
    video: true,
  },
};

function optionsFor(example) {
  return { ...example.options, blur: 0, tint: .07, glow: .14, edgeHighlight: .95 };
}

function sourceCode(example, framework) {
  const { html, enhance, video } = example;
  const template = (markup) => markup.replace(/^/gm, "    ");
  const style = 'import "@ikeofficial/liquid-glass-js/style.css";';
  const options = JSON.stringify(optionsFor(example)).replace(/"([a-zA-Z]+)":/g, "$1: ").replace(/,/g, ", ");
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
  liquidGlass(element, { ...options${video ? ', backdrop: root.querySelector("video")' : ""} }),
);${attach.trimEnd().replace(/\n    /g, "\n")}

export function dispose() {
  events.abort();
  lenses.forEach((glass) => glass.destroy());
}`;
  }
  if (framework === "angular") {
    // Angular template bindings use single-quoted string literals inside the attribute.
    const binding = options.replaceAll('"', "'");
    const markup = html.replaceAll("data-lens", `[liquidGlass]="${video ? binding.slice(0, -1) + ", backdrop: media }" : "options"}"`)
      .replace("<video ", "<video #media ");
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
    const markup = html.replaceAll("data-lens", `v-liquid-glass="${video ? "{ ...options, backdrop: media }" : "options"}"`)
      .replace("<video ", '<video ref="media" ').replace(/^<([a-z]+)/, enhance ? '<$1 ref="root"' : "<$1");
    return `<script setup lang="ts">
${enhance ? 'import { onMounted, onBeforeUnmount, ref } from "vue";\n' : ""}import { vLiquidGlass } from "@ikeofficial/liquid-glass-js/vue";
import type { LiquidGlassOptions } from "@ikeofficial/liquid-glass-js";
${style}
${typedBehavior}
const options: LiquidGlassOptions = ${options};${video ? '\nconst media = ref<HTMLVideoElement | null>(null);' : ""}
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
    .replace(/ checked\b/g, " defaultChecked").replace("playsinline", "playsInline")
    .replace("<video ", "<video ref={setMedia} ");
  const hooks = Array.from({ length: number }, (_, index) =>
    `  const glass${index + 1} = useLiquidGlass<HTMLSpanElement>(options);`).join("\n");
  return `import { useLiquidGlass } from "@ikeofficial/liquid-glass-js/react";
${enhance ? `import { useEffect, useRef${video ? ", useState" : ""} } from "react";\n` : ""}import type { LiquidGlassOptions } from "@ikeofficial/liquid-glass-js";
${style}
${typedBehavior}
export function GlassControl() {
${video ? "  const [media, setMedia] = useState<HTMLVideoElement | null>(null);\n" : ""}  const options: LiquidGlassOptions = { ...${options}${video ? ", backdrop: media" : ""} };
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
  const language = document.getElementById("control-code-selector");
  let controllers = [];
  let events;

  function selectedExample() {
    return examples[selector.querySelector(":checked").value];
  }

  function displaySource() {
    output.textContent = sourceCode(selectedExample(), language.querySelector(":checked").value);
  }

  function select() {
    const example = selectedExample();
    events?.abort();
    controllers.forEach((glass) => glass.destroy());
    preview.querySelector("video")?.pause();
    preview.dataset.control = selector.querySelector(":checked").value;
    preview.innerHTML = example.html;
    const options = { ...optionsFor(example), backdrop: preview.querySelector("video") };
    controllers = Array.from(preview.querySelectorAll("[data-lens]"), (element) => liquidGlass(element, options));
    events = new AbortController();
    example.enhance?.(preview, events.signal);
    displaySource();
  }

  selector.addEventListener("change", select);
  language.addEventListener("change", displaySource);
  bindCopy(document.getElementById("copy-control"), output);
  select();
}
