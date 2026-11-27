import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const host = process.env.LIQUID_GLASS_HOST ?? "127.0.0.1";
const port = Number(process.env.LIQUID_GLASS_PORT ?? 4173);
const types = new Map([
  ["html", "text/html; charset=utf-8"],
  ["js", "text/javascript; charset=utf-8"],
  ["css", "text/css; charset=utf-8"],
  ["jpg", "image/jpeg"],
  ["svg", "image/svg+xml"],
  ["mp4", "video/mp4"],
]);
const root = fileURLToPath(new URL("../", import.meta.url));
const files = new Map();

for (const directory of ["demo", "src"]) {
  const source = join(root, directory);
  for (const file of await readdir(source, { recursive: true, withFileTypes: true })) {
    const type = types.get(file.name.split(".").at(-1));
    if (!file.isFile() || !type) continue;
    const realPath = join(file.parentPath, file.name);
    const urlPath = "/" + relative(root, realPath).split(sep).map(encodeURIComponent).join("/");
    files.set(urlPath, { realPath, type });
  }
}

const server = createServer(async (request, response) => {
  const path = request.url.split("?")[0];
  if (path === "/" || path === "/demo") {
    response.writeHead(302, { Location: "/demo/" }).end();
    return;
  }
  const file = path.endsWith("/") ? path + "index.html" : path;
  const entry = files.get(file);
  if (!entry) {
    response.writeHead(404).end();
    return;
  }
  try {
    const contents = await readFile(entry.realPath);
    const headers = { "Content-Type": entry.type, "Cache-Control": "no-store" };
    if (entry.type === "video/mp4") {
      headers["Accept-Ranges"] = "bytes";
      const range = request.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
      if (range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : Math.max(0, contents.length - Number(range[2]));
        const end = range[1] && range[2] ? Math.min(Number(range[2]), contents.length - 1) : contents.length - 1;
        if (start > end) {
          response.writeHead(416, { ...headers, "Content-Range": `bytes */${contents.length}` }).end();
          return;
        }
        response.writeHead(206, {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${contents.length}`,
          "Content-Length": end - start + 1,
        }).end(contents.subarray(start, end + 1));
        return;
      }
    }
    response.writeHead(200, { ...headers, "Content-Length": contents.length });
    response.end(contents);
  } catch {
    response.writeHead(500).end();
  }
});

server.listen(port, host, () => console.log("Playground at http://" + host + ":" + server.address().port + "/demo/"));
