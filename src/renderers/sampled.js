import { lensStrength } from "../optics.js";
import { drawWebGl } from "./webgl.js";

export function makeBackdropLens(document) {
  const canvas = document.createElement("canvas");
  canvas.className = "liquid-glass-backdrop";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d");
  const sample = document.createElement("canvas");
  const sampling = sample.getContext("2d");
  let output;

  function render(source, geometry, options) {
    const { columns, rows, offsets, coverage, highlights } = geometry;
    const { refraction, chroma, edgeHighlight } = options;
    if (!context || !sampling || !source.isConnected) return false;
    const sourceBounds = source.getBoundingClientRect();
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height || !sourceBounds.width || !sourceBounds.height ||
        sourceBounds.right <= bounds.left || sourceBounds.left >= bounds.right ||
        sourceBounds.bottom <= bounds.top || sourceBounds.top >= bounds.bottom) return false;

    if (source.localName === "img" && (!source.complete || !source.naturalWidth)) return false;
    if (source.localName === "canvas" && (!source.width || !source.height)) return false;

    if (source.localName === "video" && (source.readyState < 2 || !source.videoWidth)) return false;

    if (!output || canvas.width !== columns || canvas.height !== rows) {
      canvas.width = sample.width = columns;
      canvas.height = sample.height = rows;
      output = context.createImageData(columns, rows);
    }
    const scaleX = columns / bounds.width;
    const scaleY = rows / bounds.height;
    const strength = lensStrength(refraction, chroma, geometry.width, geometry.height);
    const dx = strength * columns / geometry.width;
    const dy = strength * rows / geometry.height;
    let x = sourceBounds.left;
    let y = sourceBounds.top;
    let width = sourceBounds.width;
    let height = sourceBounds.height;
    if (source.localName !== "canvas") {
      const naturalWidth = source.naturalWidth ?? source.videoWidth;
      const naturalHeight = source.naturalHeight ?? source.videoHeight;
      const fit = document.defaultView.getComputedStyle(source).objectFit;
      if (fit === "cover" || fit === "contain") {
        const fitRatio = fit === "cover" ? Math.max : Math.min;
        const ratio = fitRatio(width / naturalWidth, height / naturalHeight);
        const imageWidth = ratio * naturalWidth;
        const imageHeight = ratio * naturalHeight;
        x += (width - imageWidth) / 2;
        y += (height - imageHeight) / 2;
        width = imageWidth;
        height = imageHeight;
      } else if (fit !== "fill") {
        return false;
      }
    }

    sampling.clearRect(0, 0, columns, rows);
    // Keep a covering image cropped to its original box when the lens overlaps its edge.
    sampling.save();
    sampling.beginPath();
    sampling.rect((sourceBounds.left - bounds.left) * scaleX, (sourceBounds.top - bounds.top) * scaleY,
      sourceBounds.width * scaleX, sourceBounds.height * scaleY);
    sampling.clip();
    sampling.drawImage(source, (x - bounds.left) * scaleX, (y - bounds.top) * scaleY,
      width * scaleX, height * scaleY);
    sampling.restore();
    if (drawWebGl(document, sample, geometry, strength, options, context)) return true;

    let pixels;
    try {
      pixels = sampling.getImageData(0, 0, columns, rows).data;
    } catch (error) {
      if (error.name !== "SecurityError") throw error;
      sample.width = columns; // Reset the tainted canvas before a later source is supplied.
      return false;
    }

    for (let row = 0, index = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++, index++) {
        const dxPixel = offsets[index * 2] * dx;
        const dyPixel = offsets[index * 2 + 1] * dy;
        const light = highlights[index] * edgeHighlight / 255;
        for (let channel = 0; channel < 4; channel++) {
          const scale = channel === 0 ? 1 - chroma : channel === 2 ? 1 + chroma : 1;
          const value = sampleChannel(
            pixels, columns, rows, col + dxPixel * scale, row + dyPixel * scale, channel,
          );
          output.data[index * 4 + channel] = channel === 3
            ? value * coverage[index] / 255
            : value + (255 - value) * light;
        }
      }
    }
    context.putImageData(output, 0, 0);
    return true;
  }

  return { canvas, render };
}


function sampleChannel(pixels, width, height, x, y, channel) {
  x = Math.max(0, Math.min(width - 1, x));
  y = Math.max(0, Math.min(height - 1, y));
  const left = Math.floor(x);
  const top = Math.floor(y);
  const fx = x - left;
  const fy = y - top;
  const i = (top * width + left) * 4 + channel;
  const right = fx ? 4 : 0;
  const down = fy ? width * 4 : 0;
  const upper = pixels[i] * (1 - fx) + pixels[i + right] * fx;
  const lower = pixels[i + down] * (1 - fx) + pixels[i + down + right] * fx;
  return upper * (1 - fy) + lower * fy;
}
