import assert from "node:assert/strict";
import { after, test } from "node:test";
import { JSDOM } from "jsdom";

const { window } = new JSDOM("<main></main>", { pretendToBeVisual: true });
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia = () => new window.EventTarget();
for (const name of ["window", "document", "HTMLElement", "Element", "SVGElement", "Node", "Event", "navigator"]) {
  Object.defineProperty(globalThis, name, { value: name === "window" ? window : window[name], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

after(() => window.close());

function host() {
  const node = document.createElement("div");
  document.querySelector("main").append(node);
  return node;
}

function assertLens(element, radius) {
  assert(element.classList.contains("liquid-glass"));
  assert.equal(element.style.getPropertyValue("--liquid-glass-radius"), radius + "px");
}

test("React ref survives StrictMode, updates options and moves to a replacement host", async () => {
  const { createElement, StrictMode, act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useLiquidGlass } = await import("@ikeofficial/liquid-glass-js/react");
  function Sample({ options, tag }) {
    const glass = useLiquidGlass(options);
    return createElement(tag, { ref: glass }, "Continue");
  }

  const target = host();
  const root = createRoot(target);
  const render = (options, tag) => act(() => root.render(
    createElement(StrictMode, null, createElement(Sample, { options, tag })),
  ));
  await render({ radius: 8 }, "button");
  const old = target.firstElementChild;
  assertLens(old, 8);
  await render({}, "button");
  assertLens(old, 24);
  await render({ radius: 35 }, "div");
  assert(!old.classList.contains("liquid-glass"));
  const revised = target.firstElementChild;
  assertLens(revised, 35);
  await act(() => root.unmount());
  assert(!revised.classList.contains("liquid-glass"));
  target.remove();
});

test("Vue directive updates and cleans up when the app unmounts", async () => {
  const { createApp, h, nextTick, shallowRef, withDirectives } = await import("vue");
  const { vLiquidGlass } = await import("@ikeofficial/liquid-glass-js/vue");
  const target = host();
  const options = shallowRef({ radius: 9 });
  const app = createApp({
    render: () => withDirectives(h("button", "Continue"), [[vLiquidGlass, options.value]]),
  });

  app.mount(target);
  const item = target.firstElementChild;
  assertLens(item, 9);
  options.value = {};
  await nextTick();
  assertLens(item, 24);
  app.unmount();
  assert(!item.classList.contains("liquid-glass"));
  target.remove();
});

test("Angular directive works with a standalone component and zoneless updates", async () => {
  await import("@angular/compiler");
  const { Component, provideZonelessChangeDetection, signal } = await import("@angular/core");
  const { createApplication } = await import("@angular/platform-browser");
  const { LiquidGlassDirective } = await import("@ikeofficial/liquid-glass-js/angular");
  class Sample {
    options = signal({ radius: 10 });
  }
  Component({
    selector: "glass-fixture",
    standalone: true,
    imports: [LiquidGlassDirective],
    template: '<main #feed>Scroll feed</main><button [liquidGlass]="{ mode: options().mode, radius: options().radius, viewportSource: feed }">Continue</button>',
  })(Sample);

  const target = host();
  const app = await createApplication({ providers: [provideZonelessChangeDetection()] });
  const instance = app.bootstrap(Sample, target);
  try {
    await app.whenStable();
    const item = target.querySelector("button");
    assertLens(item, 10);
    instance.instance.options.set({});
    await app.whenStable();
    assertLens(item, 24);

    const source = target.querySelector("main");
    window.HTMLCanvasElement.prototype.getContext = () => ({
      createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      putImageData() {},
    });
    window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,AA==";
    window.Image.prototype.decode = () => Promise.resolve();
    for (const element of [source, item]) {
      for (const key of ["clientWidth", "offsetWidth", "clientHeight", "offsetHeight"]) {
        Object.defineProperty(element, key, { value: 60 });
      }
      element.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, width: 60, height: 60, right: 60, bottom: 60 });
    }
    instance.instance.options.set({ mode: "viewport" });
    await app.whenStable();
    await new Promise((resolve) => window.requestAnimationFrame(() => setImmediate(resolve)));
    assert.match(source.style.filter, /url\(/);
    instance.instance.options.set({ mode: "off" });
    await app.whenStable();
    assert.equal(source.style.filter, "");
    assert(!item.classList.contains("liquid-glass"));
    instance.destroy();
    assert(!item.classList.contains("liquid-glass"));
  } finally {
    app.destroy();
    target.remove();
  }
});
