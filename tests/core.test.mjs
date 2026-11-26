import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { liquidGlass } from "@ikeofficial/liquid-glass-js";
import { lensGeometry, lensStrength } from "../src/optics.js";
import { makeSvgLens } from "../src/renderers/svg.js";

test("the bevel bends inward, mirrors across the lens, and leaves the center flat", () => {
  const { columns, rows, offsets } = lensGeometry(99, 47, { radius: 12, bevel: 14, curvature: 2 });
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

test("the reported wide capsule has a symmetric, antialiased mask and bounded displacement", () => {
  const { columns, rows, offsets, coverage, highlights } = lensGeometry(
    368, 122, { radius: 108, bevel: 30, curvature: 2, lightAngle: 145 },
  );
  assert.equal(coverage[0], 0);
  assert.equal(coverage[columns - 1], 0);
  assert.equal(coverage[columns * rows - 1], 0);
  assert.equal(coverage[columns * Math.floor(rows / 2) + Math.floor(columns / 2)], 255);
  assert(coverage.some((alpha) => alpha > 0 && alpha < 255));
  assert(highlights[Math.round(columns / 2)] > highlights[columns * (rows - 1) + Math.round(columns / 2)]);
  assert(offsets.every((offset) => Number.isFinite(offset) && Math.abs(offset) <= 1));
  assert.equal(lensStrength(48, 0, 368, 122), 48);
  assert(lensStrength(62, .8, 100, 54) * 1.8 < 27);
});

test("strength changes reuse the displacement map and SVG graph", async () => {
  const { window } = new JSDOM("<div></div>");
  let encodes = 0;
  window.HTMLCanvasElement.prototype.getContext = () => ({
    createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData() {},
  });
  window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64," + ++encodes;
  window.Image.prototype.decode = () => Promise.resolve();
  const { document } = window;
  const lens = makeSvgLens(document.querySelector("div"), "blink", "content");
  const settings = { radius: 108, bevel: 30, curvature: 2, chroma: 0, blur: 0, saturation: 1, edgeHighlight: .94 };
  const geometry = { ...lensGeometry(368, 122, settings), width: 368, height: 122, key: "large-capsule" };
  lens.render(geometry, { ...settings, refraction: 22 }, () => {});
  await new Promise(setImmediate);
  const filter = document.querySelector("filter");
  assert(filter.querySelector('feComposite[operator="out"][in2="shape"]'));
  const displacement = filter.querySelector("feDisplacementMap");
  const previous = Number(displacement.getAttribute("scale"));
  lens.render(geometry, { ...settings, refraction: 48 }, () => {});
  assert.equal(document.querySelector("filter"), filter);
  assert(Number(displacement.getAttribute("scale")) > previous);
  assert.equal(encodes, 1);
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

test("automatic selection prefers live refraction and falls back to a supplied image", async () => {
  for (const [userAgent, expected] of [["Chrome/140.0", "backdrop"], ["Firefox/140.0", "sampled"], ["AppleWebKit/605.1.15", "sampled"]]) {
    const { window } = new JSDOM("<img><div></div>", { pretendToBeVisual: true });
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
    window.HTMLCanvasElement.prototype.getContext = (kind) => {
      if (kind !== "2d") return null;
      const image = (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) });
      return { createImageData: image, getImageData: (_, __, w, h) => image(w, h),
        putImageData() {}, clearRect() {}, save() {}, beginPath() {}, rect() {}, clip() {}, drawImage() {}, restore() {} };
    };
    window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,AA==";
    window.Image.prototype.decode = () => Promise.resolve();
    const backdrop = document.querySelector("img");
    backdrop.style.objectFit = "fill";
    Object.defineProperties(backdrop, { complete: { value: true }, naturalWidth: { value: 60 }, naturalHeight: { value: 40 } });
    const lens = document.querySelector("div");
    Object.defineProperties(lens, { clientWidth: { value: 60 }, clientHeight: { value: 40 } });
    const frame = () => new Promise((resolve) => window.requestAnimationFrame(() => setImmediate(resolve)));
    const glass = liquidGlass(lens, { backdrop });
    try {
      await frame();
      assert.equal(glass.renderer, expected);
      glass.update({ mode: "sampled" });
      await frame();
      assert.equal(glass.renderer, "sampled");
      glass.update({ mode: "backdrop", backdrop: null });
      await frame();
      assert.equal(glass.renderer, expected === "backdrop" ? "backdrop" : "frost");
      glass.update({ mode: "sampled" });
      await frame();
      assert.equal(glass.renderer, "frost");
      assert.equal(lens.querySelector("canvas"), null);
    } finally {
      glass.destroy();
      window.close();
    }
  }
});
