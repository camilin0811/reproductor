import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

function collectJsFiles(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) collectJsFiles(p, out);
    else if (ent.isFile() && p.endsWith(".js")) out.push(p);
  }
  return out;
}

test("wiring: all dist modules reachable from main.js", () => {
  const root = join(dirname(fileURLToPath(new URL(import.meta.url))), "..");
  const dist = join(root, "dist");
  const mainPath = join(dist, "main.js");
  assert.ok(existsSync(mainPath), "dist/main.js must exist (run tsc)");

  const allFiles = collectJsFiles(dist).map((p) => p.replace(dist + "/", ""));
  // lista de excepciones: aqui solo entran los archivos que existen para las
  // pruebas y que a proposito no forman parte de lo que carga el navegador
  const whitelist = [
    "ui/rowState.js",
  ];
  const isWhitelisted = (rel) => whitelist.includes(rel);

  // se construye el grafo leyendo los import de cada archivo
  function parseImports(fileContent) {
    const out = [];
    const importFromRe = /import\s+[^;]*?from\s+["']([^"']+)["']/g;
    const exportFromRe = /export\s+[^;]*?from\s+["']([^"']+)["']/g;
    const sideRe = /import\s+["']([^"']+)["']/g;
    let m;
    while ((m = importFromRe.exec(fileContent)) !== null) out.push(m[1]);
    while ((m = exportFromRe.exec(fileContent)) !== null) out.push(m[1]);
    while ((m = sideRe.exec(fileContent)) !== null) out.push(m[1]);
    return out;
  }

  function resolveTarget(fromRel, importPath) {
    // solo interesan las rutas relativas
    if (!importPath.startsWith(".")) return null; // dependencia externa
    const fromDir = dirname(join(dist, fromRel));
    let target = importPath;
    // normalizar la extension
    // componer la ruta final
    const joined = join(fromDir, target);
    // asegurar que termina en .js
    let rel = joined.replace(dist + "/", "");
    // limpiar la ruta
    if (!rel.endsWith(".js")) {
      // segundo intento anadiendo la extension
      if (existsSync(join(dist, rel + ".js"))) rel = rel + ".js";
      else if (existsSync(join(dist, rel + "/index.js"))) rel = rel + "/index.js";
      else return null;
    }
    return rel;
  }

  const visited = new Set();
  const queue = ["main.js"];
  visited.add("main.js");
  while (queue.length) {
    const cur = queue.shift();
    const abs = join(dist, cur);
    if (!existsSync(abs)) continue;
    const content = readFileSync(abs, "utf8");
    const imps = parseImports(content);
    for (const imp of imps) {
      const target = resolveTarget(cur, imp);
      if (!target) continue;
      if (!visited.has(target) && existsSync(join(dist, target))) {
        visited.add(target);
        queue.push(target);
      }
    }
  }

  const unreachable = allFiles.filter((f) => !visited.has(f) && !isWhitelisted(f) && !f.endsWith(".d.ts"));
  // lo que no se alcance desde el arranque se denuncia
  const total = allFiles.length;
  const reachable = visited.size;
  console.log(`reachability: ${reachable}/${total} reachable, unreachable: ${unreachable.join(", ")}`);

  if (unreachable.length > 0) {
    assert.fail(`Unreachable modules from dist/main.js: ${unreachable.join(", ")}. Import them transitively from main.js.`);
  }
});
