---
name: liquid-glass-js
description: Install and integrate the Liquid Glass JS library with plain JavaScript, Angular, React, or Vue. Use when a user requests this library or wants to tune its viewport or live-page refraction.
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

## Choose the renderer

- Omitting `mode` selects `auto`. Use `{ viewportSource: source }` to try native backdrop refraction, then viewport SVG when the source is usable, then frost.
- `{ mode: "viewport", viewportSource: source }` selects viewport SVG explicitly. Supply a same-tree HTML element or selector. Use a bounded scroll pane and position the lens above it in a separate layer. In Angular, a template reference such as `#feed` can be passed as `viewportSource: feed`.
- `{ mode: "backdrop" }` selects native backdrop refraction when available. `{ mode: "frost" }` selects CSS frost directly. `{ mode: "off" }` disables the material and restores author styling.
- Call `glass.refresh()` after moving the lens relative to the source or replacing its selector target. Run `mise run dev` and use the **Usage** renderer picker to get a matching JavaScript, Angular, React, or Vue example. Verify the effect over live text and detailed artwork.
