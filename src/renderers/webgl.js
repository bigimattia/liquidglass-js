const renderers = new WeakMap();

const vertex = `
  attribute vec2 position;
  varying vec2 uv;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    uv = vec2(position.x + 1.0, 1.0 - position.y) * 0.5;
  }
`;

const fragment = `
  precision mediump float;
  varying vec2 uv;
  uniform sampler2D plate;
  uniform sampler2D lens;
  uniform vec2 strength;
  uniform float chroma;
  uniform float rim;

  void main() {
    vec4 map = texture2D(lens, uv);
    vec2 offset = (map.rg * 255.0 - 128.0) / 127.0 * strength;
    vec4 color = texture2D(plate, uv + offset);
    if (chroma > 0.0) {
      color.r = texture2D(plate, uv + offset * (1.0 - chroma)).r;
      color.b = texture2D(plate, uv + offset * (1.0 + chroma)).b;
    }
    color.rgb = mix(color.rgb, vec3(1.0), map.b * rim);
    gl_FragColor = vec4(color.rgb, color.a * map.a);
  }
`;

function setup(gl) {
  const program = gl.createProgram();
  for (const [kind, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    const shader = gl.createShader(kind);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  for (const [unit, name] of ["plate", "lens"].entries()) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program, name), unit);
  }
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  return {
    strength: gl.getUniformLocation(program, "strength"),
    chroma: gl.getUniformLocation(program, "chroma"),
    rim: gl.getUniformLocation(program, "rim"),
  };
}

function createRenderer(document) {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", {
    antialias: false, depth: false, stencil: false, premultipliedAlpha: false,
  });
  if (!gl) return null;
  let uniforms = setup(gl);
  let uploadedMap;

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    uniforms = null;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    uniforms = setup(gl);
    uploadedMap = undefined;
  });

  return function draw(source, geometry, strength, { chroma, edgeHighlight }, output) {
    if (!uniforms || gl.isContextLost()) return false;
    const { width, height, columns, rows, offsets, coverage, highlights } = geometry;
    if (canvas.width !== columns || canvas.height !== rows) {
      canvas.width = columns;
      canvas.height = rows;
    }
    gl.viewport(0, 0, columns, rows);
    gl.activeTexture(gl.TEXTURE0);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch (error) {
      if (error.name !== "SecurityError") throw error;
      return false;
    }

    if (uploadedMap !== geometry) {
      const pixels = new Uint8ClampedArray(columns * rows * 4);
      for (let i = 0; i < coverage.length; i++) {
        pixels[4 * i] = 128 + 127 * offsets[2 * i];
        pixels[4 * i + 1] = 128 + 127 * offsets[2 * i + 1];
        pixels[4 * i + 2] = highlights[i];
        pixels[4 * i + 3] = coverage[i];
      }
      gl.activeTexture(gl.TEXTURE1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, columns, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      uploadedMap = geometry;
    }
    gl.uniform2f(uniforms.strength, strength / width, strength / height);
    gl.uniform1f(uniforms.chroma, chroma);
    gl.uniform1f(uniforms.rim, edgeHighlight);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    output.clearRect(0, 0, columns, rows);
    output.drawImage(canvas, 0, 0);
    return true;
  };
}

export function drawWebGl(document, source, geometry, strength, options, output) {
  if (!renderers.has(document)) renderers.set(document, createRenderer(document));
  return renderers.get(document)?.(source, geometry, strength, options, output) ?? false;
}
