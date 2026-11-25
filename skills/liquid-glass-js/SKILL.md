---
name: liquid-glass-js
description: Install and integrate the Liquid Glass JS library with plain JavaScript, Angular, React, or Vue. Use when a user requests this library or wants to tune its element, image, or live-page refraction.
---

## Install

- Install the supplied `ikeofficial-liquid-glass-js-*.tgz` using the target project’s package manager. From a library checkout, run `mise run install` and `mise run pack` to build the archive in `dist/`. If neither source nor archive is available, ask for its location.
- Always load `@ikeofficial/liquid-glass-js/style.css`. In Angular, add it to the app’s global styles. For plain HTML without a bundler, copy the library’s `src/` folder to public assets, link `liquid-glass.css`, and import the ES module `liquid-glass.js`.

## Attach to an existing element

- JavaScript uses `const glass = liquidGlass(element, options)` from `@ikeofficial/liquid-glass-js`. Call `glass.update(changes)` when tuning and `glass.destroy()` when unmounting.
- Angular imports the standalone `LiquidGlassDirective` from `@ikeofficial/liquid-glass-js/angular` and uses `[liquidGlass]="options"`.
- React imports `useLiquidGlass` from `@ikeofficial/liquid-glass-js/react` and passes its return value to the element’s `ref`.
- Vue imports `vLiquidGlass` from `@ikeofficial/liquid-glass-js/vue` and uses `v-liquid-glass="options"` on the element.

Use an ordinary HTML host with geometry supplied by the app’s CSS and available `::before` and `::after` pseudo-elements. The adapters clean themselves up and treat a new options object as the complete configuration.

## Choose the surface to refract

- `{ mode: "content" }` bends the host’s own rendered pixels across browsers. Put the artwork inside the element or paint it via its CSS background. Use a decorative layer when text must stay optically sharp.
- `{ mode: "sampled", backdrop: media }` samples a same-origin or CORS-enabled image, canvas, or video behind the lens. Use an axis-aligned, borderless source and `object-fit: fill` or centered `cover` or `contain`. Call `glass.refresh()` after changing position or redrawing a canvas.
- `{ mode: "scene", scene: element }` refracts an inert copy of an HTML scene; a host may be inside the scene. Mark ancestors with `liquid-glass-scene` and omit `scene` to use the nearest, or set `scene` to its key. The opt-in `@ikeofficial/liquid-glass-js/auto` entry mounts `[liquid-glass]` hosts; their attribute value can select a keyed ancestor. Test performance and alignment: canvas, video, iframe and custom elements are omitted, and dynamic or complex layouts may not match. Call `refresh()` after unobserved style changes.
- Automatic mode (the default) refracts live page pixels in Chromium and falls back to the supplied backdrop or CSS frost. Use `{ mode: "backdrop" }` without a source to select live page refraction explicitly. `{ mode: "frost" }` uses CSS directly. Use sampled or frost mode if CSP prevents the generated SVG-map image.
- Use the target project’s own markup and geometry. Check focus, contrast, and the effect over detailed artwork. Run `mise run dev` in the library checkout for the playground and framework examples.
