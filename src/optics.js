function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function lensGeometry(width, height, { radius, refraction, bevel, curvature }, previous) {
  const corner = Math.min(radius, width / 2, height / 2);
  const maxBand = Math.min(bevel, width / 2, height / 2);
  const band = maxBand * (0.45 + 0.55 * Math.min(1, 0.625 * (refraction / maxBand)));
  const cornerBand = Math.min(corner, band);
  const extension = band - cornerBand;
  const riseFraction = 0.14 + 0.035 * curvature;
  // Smoothstep's maximum slope is 1.5. Leave headroom for map quantization.
  const peakPerPixel = 0.8 * (1 - riseFraction) / 1.5;
  const strength = Math.min(refraction, band * peakPerPixel);
  const key = [width, height, corner, band, curvature, strength].join("/");
  if (previous?.key === key) return previous;

  const resolution = Math.min(1, 512 / Math.max(width, height));
  const columns = Math.max(1, Math.round(width * resolution));
  const rows = Math.max(1, Math.round(height * resolution));
  const offsets = new Float32Array(columns * rows * 2);
  const pixelWidth = width / columns;
  const pixelHeight = height / rows;

  for (let row = 0; row < Math.ceil(rows / 2); row++) {
    const cornerY = corner - (row + 0.5) * pixelHeight;
    const bottom = rows - row - 1;
    for (let col = 0; col < Math.ceil(columns / 2); col++) {
      const cornerX = corner - (col + 0.5) * pixelWidth;
      const dx = Math.max(0, cornerX);
      const dy = Math.max(0, cornerY);
      const length = dx && dy ? Math.hypot(dx, dy) : dx + dy;
      const depth = corner - length - Math.min(Math.max(cornerX, cornerY), 0);
      const bend = bendAt(depth, Math.max(-cornerX, -cornerY));
      if (!bend) continue;

      const right = columns - col - 1;
      const normalX = right === col ? 0 : length ? dx / length : Number(cornerX > cornerY);
      const normalY = bottom === row ? 0 : length ? dy / length : Number(cornerY > cornerX);
      write(row, col, normalX, normalY);
      if (right !== col) write(row, right, -normalX, normalY);
      if (bottom !== row) write(bottom, col, normalX, -normalY);
      if (bottom !== row && right !== col) write(bottom, right, -normalX, -normalY);

      function write(y, x, nx, ny) {
        const index = 2 * (y * columns + x);
        offsets[index] = nx * bend;
        offsets[index + 1] = ny * bend;
      }
    }
  }

  function bendAt(depth, straightRun) {
    if (depth <= 0 || depth >= band || !strength) return 0;
    // Extend the band along the flats. At a nearest-edge tie, the band
    // has already tapered to zero, so switching normals cannot make a seam.
    const localBand = extension
      ? cornerBand + extension * smoothstep(straightRun / (2 * extension))
      : band;
    if (depth >= localBand) return 0;
    const rise = localBand * riseFraction;
    const peak = Math.min(strength, localBand * peakPerPixel);
    return peak / strength * smoothstep(depth / rise) *
      (1 - smoothstep((depth - rise) / (localBand - rise)));
  }

  return { width, height, columns, rows, offsets, strength, key };
}
