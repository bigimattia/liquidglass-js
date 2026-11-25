"use client";

import { useEffect, useRef, useState, type RefCallback } from "react";
import { liquidGlass, type LiquidGlassController, type LiquidGlassOptions } from "@ikeofficial/liquid-glass-js";

/** Attach the material to an ordinary DOM element using a callback ref. */
export function useLiquidGlass<T extends HTMLElement = HTMLElement>(
  options?: LiquidGlassOptions,
): RefCallback<T> {
  const [element, setElement] = useState<T | null>(null);
  const controller = useRef<LiquidGlassController | null>(null);

  useEffect(() => {
    if (!element) return;
    const glass = liquidGlass(element);
    controller.current = glass;
    return () => {
      glass.destroy();
      controller.current = null;
    };
  }, [element]);

  useEffect(() => {
    controller.current?.update(options ?? {}, { replace: true });
  }, [element, options]);

  return setElement;
}
