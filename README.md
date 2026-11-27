# Liquid Glass JS

A dependency-free glass material for ordinary HTML elements. It can refract the native page backdrop or the contents of a declared scroll pane. Angular, React and Vue bind the same JavaScript core to their lifecycle.

## Playground

Try the [interactive demo on GitHub Pages](https://bigimattia.github.io/liquidglass-js/).

![Automatic mode using viewport SVG to bend a grid in the live scroll pane](docs/images/playground.png)

To run the playground locally:

```sh
mise trust
mise install
mise run dev
```

Open [the local playground](http://127.0.0.1:4173/demo/) to refract the contents of a live scroll pane. The renderer starts at **Automatic**. Switch between photo, grid, and typography artwork inside the pane and scroll it beneath the pinned glass. **Simple** shows one refraction slider. **Advanced** adds radius, bevel, curvature, and chroma.

In **Usage**, choose a renderer and a language to copy the corresponding layout and configuration. **Automatic** and **Viewport SVG** examples pass a `viewportSource`. Angular uses a template reference to the scroll pane.

The native-controls showcase has its own renderer picker. Select Button, Switch, Slider, Segmented, or Media and copy the Tailwind markup or the matching JavaScript, Angular, Vue, or React configuration. The Media example has no viewport source, so forcing **Viewport SVG** falls back to frost.

## Install

```sh
npm install @ikeofficial/liquid-glass-js
```

The package includes minified ESM and CSS, TypeScript declarations, and an [agent skill](skills/liquid-glass-js/SKILL.md). Frameworks are optional peers of their respective adapters. Installing the core alone adds zero dependencies. The playground and build tools use separate development dependencies.

## Publishing

The **Publish to npm** GitHub Actions workflow publishes `@ikeofficial/liquid-glass-js` to npmjs.com. Add an npm granular access token with permission to publish this package and bypass 2FA as the `NPM_TOKEN` repository secret under GitHub Settings → Secrets and variables → Actions. Do not commit the token. npm plans to remove direct publishing with granular tokens in January 2027; migrate to [trusted publishing](https://docs.npmjs.com/trusted-publishers/) before then.

Update the version in `package.json`, then run **Publish to npm** from the Actions tab. Each published npm version must be new. To build a local archive, run `mise run install` and `mise run pack`.

## License

[MIT](LICENSE)

## Plain JavaScript

```js
import { liquidGlass } from "@ikeofficial/liquid-glass-js";
import "@ikeofficial/liquid-glass-js/style.css";

const item = document.querySelector("#item");
const glass = liquidGlass(item, { mode: "auto", viewportSource: "#feed", radius: 30 });

glass.update({ chroma: 0.2 });
glass.destroy();
```

The call returns a controller. Reapplying to the same element updates the existing controller. `update(options)` merges options. Use `update(options, { replace: true })` to reset omitted options. Call `destroy()` when the element unmounts. Read `glass.renderer` for the active renderer or listen on the host for `liquidglass:rendererchange`.

For plain HTML, copy the `src/` folder from the repository and serve it over HTTP. Load `liquid-glass.css` with a stylesheet link and import `liquidGlass` from the folder’s `liquid-glass.js` in a module script.

## Angular

Add `LiquidGlassDirective` to a standalone component’s imports and load the shared stylesheet globally, for example via your Angular workspace’s styles list. Angular 20 or later within the package’s peer range.

```ts
import { Component } from "@angular/core";
import { LiquidGlassDirective } from "@ikeofficial/liquid-glass-js/angular";

@Component({
  imports: [LiquidGlassDirective],
  template: `
    <div class="glass-shell">
      <main #feed class="glass-source">Scrollable content</main>
      <button class="glass-bar"
        [liquidGlass]="{ mode: 'viewport', viewportSource: feed, radius: 24 }">
        Continue
      </button>
    </div>
  `,
  styles: `
    .glass-shell { position: relative; isolation: isolate; }
    .glass-source { height: 24rem; overflow: auto; }
    .glass-bar {
      position: absolute; inset: 1rem 1rem auto; min-height: 3rem;
      border: 0; background: transparent; color: inherit;
    }
  `,
})
export class Action {}
```

Use `mode: 'auto'` with the same source to prefer native backdrop refraction. A selector such as `viewportSource: '#feed'` also works.

## React

```jsx
import { useLiquidGlass } from "@ikeofficial/liquid-glass-js/react";
import "@ikeofficial/liquid-glass-js/style.css";

export function Action() {
  const ref = useLiquidGlass({ mode: "auto", radius: 22 });
  return <button ref={ref}>Continue</button>;
}
```

The hook returns a callback ref for a DOM element. In TypeScript, you can narrow it with `useLiquidGlass<HTMLButtonElement>()`.

## Vue

```vue
<script setup>
import { vLiquidGlass } from "@ikeofficial/liquid-glass-js/vue";
import "@ikeofficial/liquid-glass-js/style.css";
</script>

<template>
  <button v-liquid-glass="{ mode: 'auto', radius: 22 }">Continue</button>
</template>
```

The directive can also be registered globally with `app.directive("liquid-glass", vLiquidGlass)`.

## Rendering modes

| Mode | Behavior |
| --- | --- |
| `auto` (default when `mode` is omitted) | Native backdrop refraction, then viewport SVG if a usable source is configured, then frosted glass |
| `viewport` | SVG refraction of the declared source. Uses frost when the source or filter is unavailable |
| `backdrop` | Native backdrop refraction where supported. Uses frost otherwise |
| `frost` | CSS blur, tint, and highlights |
| `off` | Disables glass and restores author styling |

`viewportSource` accepts a same-document HTML element or a selector resolved in the lens’s document or shadow root. Give the source a bounded, axis-aligned viewport and place the lens in an overlapping sibling layer. The source must be outside the lens subtree and the lens must be outside the source subtree. The source’s own scrolling moves the scene under the lens while the filter stays in place. Call `glass.refresh()` after changing their relative position or replacing a selector target without an options update.

Viewport SVG applies a CSS filter to the source, which creates a stacking context and can change positioning for fixed descendants. Keep fixed overlays outside that source. The source may contain ordinary text, images, and interactive HTML. Native video compositing varies by browser. Use an ordinary lens host with available `::before` and `::after` pseudo-elements.

The SVG renderers use an internally generated PNG data URL and fall back to frost if it cannot load. Reduced motion disables pointer tracking. Reduced transparency and forced colors use a solid treatment. The `liquid-glass` class with the shared stylesheet gives you a CSS-only treatment.

The `content` and `sampled` modes and the media `backdrop` option have been removed. For local artwork, position it in an HTML source layer behind the lens and use `viewportSource`. The native-control examples use Tailwind CSS v4 and the shared glass stylesheet.

## Options

| Option | Default | Effect |
| --- | --- | --- |
| `mode` | `"auto"` | Auto, viewport, backdrop, frost, or off |
| `viewportSource` | `null` | HTML element or selector for the scroll pane or scene in auto and viewport modes |
| `radius` | 24 | Corner radius in CSS pixels. Set size with your CSS |
| `refraction` | 18 | Requested edge displacement in CSS pixels. Zero disables distortion |
| `bevel` | 24 | Width of the refracted edge in CSS pixels |
| `curvature` | 2 | Shape of the optical bevel, 0.25–8 |
| `chroma` | 0 | Color-channel spread, 0–1 |
| `blur` | 2 | Frost in CSS pixels |
| `saturation` | 1.35 | Color saturation multiplier |
| `tint` | 0.14 | Tint opacity, 0–1. Set `--liquid-glass-tint-rgb` as an RGB triplet |
| `glow` | 0.23 | Interior highlight opacity, 0–1 |
| `edgeHighlight` | 0.85 | Rim light intensity, 0–1 |
| `lightAngle` | 145 | Rim gradient angle in degrees |
| `interactive` | `true` | Pointer-tracking highlight |

## Agent skill

Copy [`skills/liquid-glass-js`](skills/liquid-glass-js) into your project’s `.agents/skills/` directory. Invoke `$liquid-glass-js` and provide a checkout or tarball path.

## References

The content-rendering approach draws on [Aave’s Building Glass for the Web](https://aave.com/design/building-glass-for-the-web) and the browser measurements reported by [gentpan/liquidglass](https://github.com/gentpan/liquidglass). The playground uses original generated photography.
