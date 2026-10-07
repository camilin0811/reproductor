import { fileURLToPath } from "node:url";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(new URL(import.meta.url))), "..");
const siteDir = join(root, "site");

function collectFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) collectFiles(p, out);
    else out.push(p);
  }
  return out;
}

describe("site pack", () => {
  before(() => {
    // el empaquetador tiene que haber generado la carpeta
    execSync("npm run build:site --silent", { cwd: root, stdio: "pipe" });
  });

  it("every script/link/import resolves inside site", () => {
    assert.ok(existsSync(join(siteDir, "index.html")), "site/index.html missing");
    const html = readFileSync(join(siteDir, "index.html"), "utf8");
    // metadatos minimos de la pagina
    assert.ok(html.includes("<title>"), "missing <title>");
    assert.ok(html.includes('lang="en"') || html.includes("lang='en'"), "missing lang");
    assert.ok(html.includes('name="viewport"'), "missing viewport");
    assert.ok(html.includes('name="description"'), "missing description meta");

    // los scripts referenciados
    const scriptRe = /<script[^>]+src="([^"]+)"/g;
    let m;
    while ((m = scriptRe.exec(html)) !== null) {
      const src = m[1];
      if (src.startsWith("http") || src.startsWith("//")) continue;
      const p = join(siteDir, src.replace(/^\//, ""));
      assert.ok(existsSync(p), `script src ${src} not found at ${p}`);
    }
    // y las hojas de estilo
    const linkRe = /<link[^>]+href="([^"]+)"/g;
    while ((m = linkRe.exec(html)) !== null) {
      const href = m[1];
      if (href.startsWith("http") || href.startsWith("//") || href.startsWith("data:") || href.includes("fonts.googleapis")) continue;
      const p = join(siteDir, href.replace(/^\//, ""));
      assert.ok(existsSync(p), `link href ${href} not found at ${p}`);
    }

    // cada import del javascript debe apuntar a algo que exista
    const jsFiles = collectFiles(join(siteDir, "dist")).filter((f) => f.endsWith(".js"));
    assert.ok(jsFiles.length > 0, "no js files in site/dist");
    const importRe = /from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g;
    for (const jf of jsFiles) {
      const content = readFileSync(jf, "utf8");
      let im;
      while ((im = importRe.exec(content)) !== null) {
        const spec = im[1] || im[2];
        if (!spec) continue;
        if (spec.startsWith("http") || spec.startsWith("data:")) continue;
        if (!spec.startsWith(".") && !spec.startsWith("/")) continue;
        // la ruta se resuelve desde el archivo que importa
        const base = dirname(jf);
        let target = resolve(base, spec);
        // sin extension se prueba anadiendola
        if (!existsSync(target) && !target.endsWith(".js")) {
          if (existsSync(target + ".js")) target = target + ".js";
        }
        // las dependencias externas no se comprueban aqui
        if (spec.startsWith(".")) {
          assert.ok(existsSync(target), `import ${spec} in ${jf} not found at ${target}`);
        }
      }
    }
  });

  it("no .map or _briefs leaked", () => {
    const all = collectFiles(siteDir);
    for (const f of all) {
      assert.ok(!f.endsWith(".map"), `leaked .map file: ${f}`);
      assert.ok(!f.includes("_briefs"), `leaked _briefs file: ${f}`);
    }
  });

  it("styles are split into 4 files", () => {
    assert.ok(existsSync(join(siteDir, "styles/tokens.css")), "tokens.css missing");
    assert.ok(existsSync(join(siteDir, "styles/base.css")), "base.css missing");
    assert.ok(existsSync(join(siteDir, "styles/components.css")), "components.css missing");
    assert.ok(existsSync(join(siteDir, "styles/motion.css")), "motion.css missing");
  });
});
