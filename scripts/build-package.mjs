import { cp, readdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { build, transform } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

await rm("build", { recursive: true, force: true });

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(path) : path.endsWith(".js") ? [path] : [];
  }));
  return files.flat();
}

await build({
  entryPoints: await javascriptFiles("src"),
  outbase: "src",
  outdir: "build/core",
  format: "esm",
  target: "es2022",
  minify: true,
  legalComments: "none",
});
await build({ entryPoints: ["src/liquid-glass.css"], outfile: "build/core/liquid-glass.css", minify: true, legalComments: "none" });
await cp("src/liquid-glass.d.ts", "build/core/liquid-glass.d.ts");

execFileSync(process.execPath, ["node_modules/@angular/compiler-cli/bundles/src/bin/ngc.js", "-p", "tsconfig.adapters.json"], { stdio: "inherit" });
for (const file of await javascriptFiles("build")) {
  if (file.startsWith("build/core/")) continue;
  const source = await readFile(file, "utf8");
  const result = await transform(source, { loader: "js", format: "esm", target: "es2022", minify: true, legalComments: "none" });
  await writeFile(file, result.code);
}
