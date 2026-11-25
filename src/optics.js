const profileSteps = 192;
const glassIndex = 1.5;
const profiles = new Map();

// Sample a rounded bevel's slope and bend a vertical ray at the air/glass interface.
function refractionProfile(curvature) {
  if (profiles.has(curvature)) return profiles.get(curvature);
  const profile = new Float32Array(profileSteps + 1);
  const exponent = 1.3 + curvature * 0.55;
  const maximum = Math.tan(Math.acos(1 / glassIndex));
  profile[0] = 1;
  for (let index = 1; index < profileSteps; index++) {
    const t = 1 - index / profileSteps;
    const slope = t ** (exponent - 1) * (1 - t ** exponent) ** (1 / exponent - 1);
    const incidence = Math.atan(slope);
    const bend = Math.tan(incidence - Math.asin(Math.sin(incidence) / glassIndex));
    profile[index] = 0.72 * bend / maximum + 0.28 * t * t * (3 - 2 * t);
  }
  if (profiles.size === 32) profiles.delete(profiles.keys().next().value);
  profiles.set(curvature, profile);
  return profile;
}

export function lensGeometry(width, height, { radius, bevel: bevelSize, curvature, lightAngle = 145 }, density = 1) {
  const resolution = Math.min(density, 512 / Math.max(width, height));
  const columns = Math.max(1, Math.round(width * resolution));
  const rows = Math.max(1, Math.round(height * resolution));
  const coverage = new Uint8Array(columns * rows);
  const highlights = new Uint8Array(columns * rows);
  const offsets = new Float32Array(columns * rows * 2);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const corner = Math.min(radius, halfWidth, halfHeight);
  const bevel = Math.min(bevelSize, halfWidth, halfHeight);
  const pixelWidth = width / columns;
  const pixelHeight = height / rows;
  const feather = Math.max(pixelWidth, pixelHeight);
  const profile = refractionProfile(curvature);
  // Match CSS gradient angles. The highlight faces up and left at 145°.
  const angle = lightAngle * Math.PI / 180;
  const lightX = -Math.sin(angle);
  const lightY = Math.cos(angle);
  const quadrantWidth = Math.ceil(columns / 2);
  const quadrantHeight = Math.ceil(rows / 2);

  for (let row = 0; row < quadrantHeight; row++) {
    const cornerY = corner - (row + 0.5) * pixelHeight;
    const bottom = rows - row - 1;
    for (let col = 0; col < quadrantWidth; col++) {
      const cornerX = corner - (col + 0.5) * pixelWidth;
      const dx = Math.max(0, cornerX);
      const dy = Math.max(0, cornerY);
      const length = dx && dy ? Math.hypot(dx, dy) : dx + dy;
      const depth = corner - length - Math.min(Math.max(cornerX, cornerY), 0);
      if (depth <= -feather / 2) continue;
      const alpha = Math.min(1, 0.5 + depth / feather) * 255;
      const right = columns - col - 1;
      const normalX = right === col ? 0 : length ? dx / length : Number(cornerX > cornerY);
      const normalY = bottom === row ? 0 : length ? dy / length : Number(cornerY > cornerX);
      const inset = Math.max(0, depth);
      const sample = Math.min(profileSteps, inset * profileSteps / bevel);
      const first = Math.floor(sample);
      const bend = profile[first] + (profile[Math.min(profileSteps, first + 1)] - profile[first]) * (sample - first);
      const line = Math.max(0, 1 - inset / 2.1);
      const shoulder = Math.max(0, 1 - inset / 10);
      const shine = 255 * (0.78 * line ** 2 + 0.22 * shoulder ** 2);

      write(row, col, normalX, normalY);
      if (right !== col) write(row, right, -normalX, normalY);
      if (bottom !== row) write(bottom, col, normalX, -normalY);
      if (bottom !== row && right !== col) write(bottom, right, -normalX, -normalY);

      function write(y, x, nx, ny) {
        const index = y * columns + x;
        coverage[index] = alpha;
        if (bend) {
          offsets[2 * index] = nx * bend;
          offsets[2 * index + 1] = ny * bend;
        }
        const facing = -nx * lightX - ny * lightY;
        highlights[index] = shine * (0.19 + 0.81 * Math.max(facing, -facing * 0.64));
      }
    }
  }

  return { columns, rows, offsets, coverage, highlights };
}

export function lensStrength(refraction, chroma, width, height) {
  return Math.min(refraction, Math.min(width, height) * 0.48 / (1 + chroma));
}
