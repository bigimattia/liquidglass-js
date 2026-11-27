import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { liquidGlass } from "@ikeofficial/liquid-glass-js";
import { lensGeometry } from "../src/optics.js";
import { makeSvgLens } from "../src/renderers/svg.js";

test("the bevel bends inward, mirrors across the lens, and leaves the center flat", () => {
  const { columns, rows, offsets } = lensGeometry(99, 47, { radius: 12, bevel: 14, curvature: 2, refraction: 28 });
  const point = (x, y) => [...offsets.subarray(2 * (y * columns + x), 2 * (y * columns + x) + 2)];
  const [mx, my] = point(8, 2);
  const [rx, ry] = point(columns - 9, 2);
  const [bx, by] = point(8, rows - 3);
  assert(mx > 0 && my > 0);
  assert.equal(rx, -mx);
  assert.equal(ry, my);
  assert.equal(bx, mx);
  assert.equal(by, -my);
  assert.deepEqual(point(49, 23), [0, 0]);
});

test("the wide capsule leaves pixels outside the rim untouched", () => {
  const { columns, rows, offsets } = lensGeometry(
    368, 122, { radius: 108, bevel: 30, curvature: 2, refraction: 28 },
  );
  for (const cell of [0, columns - 1, columns * rows - 1]) {
    assert.deepEqual([...offsets.subarray(cell * 2, cell * 2 + 2)], [0, 0]);
  }
  assert(offsets.every((offset) => Number.isFinite(offset) && Math.abs(offset) <= 1));
});

test("the encoded viewport warp preserves local orientation at high strength", () => {
  for (const [width, height, radius] of [[807, 96, 22], [288, 96, 22], [110, 54, 27], [288, 96, 0]]) {
    const { columns, rows, offsets, strength } = lensGeometry(width, height, {
      radius, refraction: 51, bevel: 32, curvature: 2,
    });
    assert(strength > 10);
    const samples = Float64Array.from(offsets, (offset, index) => {
      const cell = Math.floor(index / 2);
      const horizontal = index % 2 === 0;
      const position = horizontal ? cell % columns * width / columns : Math.floor(cell / columns) * height / rows;
      const encoded = Math.round(128 + 127 * offset);
      return position + 2 * strength * (encoded / 255 - 0.5);
    });
    function determinant(a, b, c) {
      return (samples[b] - samples[a]) * (samples[c + 1] - samples[a + 1])
        - (samples[b + 1] - samples[a + 1]) * (samples[c] - samples[a]);
    }
    for (let y = 0; y < rows - 1; y++) {
      for (let x = 0; x < columns - 1; x++) {
        const topLeft = 2 * (y * columns + x);
        const topRight = topLeft + 2;
        const bottomLeft = topLeft + 2 * columns;
        const bottomRight = bottomLeft + 2;
        assert(determinant(topLeft, topRight, bottomLeft) > 0);
        assert(determinant(topRight, bottomRight, topLeft) > 0);
        assert(determinant(bottomLeft, topLeft, bottomRight) > 0);
        assert(determinant(bottomRight, bottomLeft, topRight) > 0);
      }
    }
  }
});

test("native backdrop reuses the SVG graph and caches effective displacement maps", async () => {
  const { window } = new JSDOM("<div></div>");
  let encodes = 0;
  window.HTMLCanvasElement.prototype.getContext = () => ({
    createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData() {},
  });
  window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64," + ++encodes;
  window.Image.prototype.decode = () => Promise.resolve();
  const { document } = window;
  const lens = makeSvgLens(document.querySelector("div"));
  const settings = { radius: 108, bevel: 30, curvature: 2, chroma: 0, blur: 0, saturation: 1, edgeHighlight: .94 };
  const weaker = lensGeometry(368, 122, { ...settings, refraction: 22 });
  const stronger = lensGeometry(368, 122, { ...settings, refraction: 48 });
  lens.render(weaker, settings, () => {});
  await new Promise(setImmediate);
  const filter = document.querySelector("filter");
  const displacement = filter.querySelector("feDisplacementMap");
  const previous = Number(displacement.getAttribute("scale"));
  lens.render(stronger, settings, () => {});
  await new Promise(setImmediate);
  assert.equal(document.querySelector("filter"), filter);
  assert(Number(displacement.getAttribute("scale")) > previous);
  lens.render(weaker, settings, () => {});
  assert.equal(Number(displacement.getAttribute("scale")), previous);
  assert.equal(encodes, 2);
  lens.dispose();
  assert.equal(document.querySelector("filter"), null);
  window.close();
});

test("keep a single controller, validate updates atomically and restore author styling", () => {
  const { window } = new JSDOM("<button>Continue</button>", { pretendToBeVisual: true });
  window.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  window.matchMedia = () => new window.EventTarget();
  const item = window.document.querySelector("button");
  item.style.setProperty("--liquid-glass-radius", "4px", "important");
  const glass = liquidGlass(item, { radius: 26, chroma: .3 });
  assert.equal(liquidGlass(item, { radius: 27 }), glass);
  assert.equal(item.style.getPropertyValue("--liquid-glass-radius"), "27px");
  assert.throws(() => glass.update({ radius: 12, chroma: 2 }), RangeError);
  assert.equal(item.style.getPropertyValue("--liquid-glass-radius"), "27px");
  glass.update({ mode: "frost" }, { replace: true });
  assert.equal(item.style.getPropertyValue("--liquid-glass-radius"), "24px");
  glass.destroy();
  glass.destroy();
  assert.equal(item.style.getPropertyValue("--liquid-glass-radius"), "4px");
  assert.equal(item.style.getPropertyPriority("--liquid-glass-radius"), "important");
  assert(!item.classList.contains("liquid-glass"));
  window.close();
});

test("automatic selection prefers native backdrop, then viewport, then frost", async () => {
  for (const [userAgent, expected] of [
    ["Chrome/140.0", "backdrop"], ["Firefox/140.0", "viewport"], ["AppleWebKit/605.1.15", "viewport"],
  ]) {
    const { window } = new JSDOM('<main id="feed" style="filter: blur(1px) !important"></main><button>Lens</button>', {
      pretendToBeVisual: true,
    });
    const { document } = window;
    Object.defineProperty(window.navigator, "userAgent", { value: userAgent });
    window.CSS = { supports: () => true };
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.matchMedia = () => new window.EventTarget();
    const bounds = { width: 60, height: 40, top: 0, left: 0, right: 60, bottom: 40 };
    window.HTMLElement.prototype.getBoundingClientRect = () => bounds;
    for (const key of ["clientWidth", "offsetWidth", "clientHeight", "offsetHeight"]) {
      Object.defineProperty(window.HTMLElement.prototype, key, { value: key.endsWith("Width") ? 60 : 40 });
    }
    let encodes = 0;
    window.HTMLCanvasElement.prototype.getContext = () => ({
      createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      putImageData() {},
    });
    window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64," + ++encodes;
    window.Image.prototype.decode = () => Promise.resolve();
    const source = document.querySelector("main");
    const lens = document.querySelector("button");
    const frame = () => new Promise((resolve) => window.requestAnimationFrame(() => setImmediate(resolve)));
    const glass = liquidGlass(lens, { viewportSource: "#feed" });
    try {
      await frame();
      assert.equal(glass.renderer, expected);
      assert.equal(source.style.filter.includes("url("), expected === "viewport");

      glass.update({ mode: "viewport", viewportSource: source });
      await frame();
      assert.equal(glass.renderer, "viewport");
      assert.match(source.style.filter, /^blur\(1px\) url\(/);
      assert.equal(source.style.getPropertyPriority("filter"), "important");

      const second = document.createElement("button");
      lens.after(second);
      const siblingGlass = liquidGlass(second, { mode: "viewport", viewportSource: source });
      await frame();
      assert.equal(source.style.filter.match(/url\(/g).length, 2);
      siblingGlass.destroy();
      assert.equal(source.style.filter.match(/url\(/g).length, 1);

      const mapCount = encodes;
      glass.update({ chroma: .4 });
      await frame();
      assert.equal(document.querySelectorAll("feDisplacementMap").length, 3);
      assert.equal(encodes, mapCount);

      glass.update({ mode: "off" });
      assert.equal(glass.renderer, "off");
      assert(!lens.classList.contains("liquid-glass"));
      assert.equal(lens.style.getPropertyValue("--liquid-glass-radius"), "");
      assert.equal(source.style.filter, "blur(1px)");
      assert.equal(source.style.getPropertyPriority("filter"), "important");
      assert.equal(document.querySelector("filter"), null);

      glass.update({ mode: "viewport", viewportSource: "[" });
      await frame();
      assert.equal(glass.renderer, "frost");
      glass.update({ mode: "backdrop", viewportSource: source });
      await frame();
      assert.equal(glass.renderer, expected === "backdrop" ? "backdrop" : "frost");
      assert.equal(source.style.filter, "blur(1px)");
      glass.update({ mode: "auto", viewportSource: "#missing" });
      await frame();
      assert.equal(glass.renderer, expected === "backdrop" ? "backdrop" : "frost");

      if (expected === "backdrop") {
        let attempts = 0;
        window.Image.prototype.decode = () => ++attempts === 1 ? Promise.reject() : Promise.resolve();
        glass.update({ mode: "auto", viewportSource: source, radius: 7 });
        await frame();
        assert.equal(glass.renderer, "viewport");
        assert.equal(attempts, 2);
      }
    } finally {
      glass.destroy();
      window.close();
    }
  }
});
