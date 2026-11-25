import type { ObjectDirective } from "vue";
import { liquidGlass, type LiquidGlassController, type LiquidGlassOptions } from "@ikeofficial/liquid-glass-js";

const controllers = new WeakMap<HTMLElement, LiquidGlassController>();

export const vLiquidGlass: ObjectDirective<HTMLElement, LiquidGlassOptions | undefined> = {
  mounted(element, { value }) {
    controllers.set(element, liquidGlass(element, value));
  },
  updated(element, { value }) {
    controllers.get(element)?.update(value ?? {}, { replace: true });
  },
  beforeUnmount(element) {
    controllers.get(element)?.destroy();
    controllers.delete(element);
  },
};
