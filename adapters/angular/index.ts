import {
  afterRenderEffect, DestroyRef, Directive, ElementRef, inject, input, NgZone,
} from "@angular/core";
import { liquidGlass, type LiquidGlassController, type LiquidGlassOptions } from "@ikeofficial/liquid-glass-js";

@Directive({ selector: "[liquidGlass]", standalone: true })
export class LiquidGlassDirective {
  readonly liquidGlass = input<LiquidGlassOptions | "" | null>("");

  constructor() {
    const { nativeElement } = inject<ElementRef<HTMLElement>>(ElementRef);
    const zone = inject(NgZone);
    let controller: LiquidGlassController | undefined;

    afterRenderEffect({
      write: () => {
        const options = this.liquidGlass() || {};
        zone.runOutsideAngular(() => {
          if (controller) controller.update(options, { replace: true });
          else controller = liquidGlass(nativeElement, options);
        });
      },
    });

    inject(DestroyRef).onDestroy(() => controller?.destroy());
  }
}
