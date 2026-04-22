import esbuild from "esbuild";
import fs from "fs/promises";
import path from "path";

const SRC = path.resolve("extension");
const DIST = path.resolve("dist/fishink-extension");

async function copyDir(srcDir, destDir) {
    await fs.mkdir(destDir, { recursive: true });
    const entries = await fs.readdir(srcDir, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

async function copyFile(name) {
    await fs.copyFile(path.join(SRC, name), path.join(DIST, name));
}

await fs.rm(DIST, { recursive: true, force: true });
await fs.mkdir(DIST, { recursive: true });

await esbuild.build({
    entryPoints: [
        path.join(SRC, "background.js"),
        path.join(SRC, "loader.js"),
        path.join(SRC, "warning.js"),
        path.join(SRC, "popup.js"),
    ],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["chrome114"],
    outdir: DIST,
    sourcemap: true,
    logLevel: "info",
});

await copyDir(path.join(SRC, "model"), path.join(DIST, "model"));
await copyDir(path.join(SRC, "data"), path.join(DIST, "data"));

for (const file of [
    "manifest.json",
    "loader.html",
    "loader.css",
    "warning.html",
    "warning.css",
    "popup.html",
    "popup.css",
]) {
    await copyFile(file);
}

console.log(`Extension built at ${DIST}`);