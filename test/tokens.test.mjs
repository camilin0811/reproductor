import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const stylesDir = new URL("../styles/", import.meta.url).pathname;

function readStyles() {
  if (!existsSync(stylesDir)) return [];
  const files = readdirSync(stylesDir).filter((f) => f.endsWith(".css"));
  return files.map((f) => ({ name: f, content: readFileSync(join(stylesDir, f), "utf8") }));
}

describe("token discipline", () => {
  it("no raw hex/rgb or banned properties outside tokens.css", () => {
    const files = readStyles();
    const bannedRe = /(backdrop-filter|box-shadow|filter:\s*blur|@media\s*\(\s*prefers-color-scheme:\s*dark\s*\))/i;
    const hexRe = /#[0-9a-fA-F]{3,8}\b/;
    const rgbRe = /\brgba?\(/;
    for (const { name, content } of files) {
      if (name === "tokens.css") continue;
      assert.ok(!hexRe.test(content), `${name} contains raw hex color`);
      assert.ok(!rgbRe.test(content), `${name} contains rgb()/rgba() literal`);
      assert.ok(!bannedRe.test(content), `${name} contains banned property: ${content.match(bannedRe)?.[0]}`);
    }
  });

  it("only allowed font families appear", () => {
    const files = readStyles();
    const indexHtml = readFileSync(new URL("../index.html", import.meta.url).pathname, "utf8");
    const all = files.map((f) => f.content).join("\n") + "\n" + indexHtml;
    // todas las declaraciones de tipografia
    const re = /font-family\s*:\s*([^;{}]+)/gi;
    let m;
    const allowed = ["syne", "space grotesk", "trebuchet ms", "system-ui", "sans-serif", "var("];
    while ((m = re.exec(all)) !== null) {
      const raw = m[1].toLowerCase();
      if (raw.includes("var(")) continue;
      if (raw.trim() === "inherit" || raw.trim() === "initial") continue;
      // cada familia de la cascada por separado
      const parts = raw.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
      for (const p of parts) {
        const clean = p.replace(/^["']|["']$/g, "").trim();
        if (!clean) continue;
        if (clean === "inherit" || clean === "var(--font-text)" || clean.startsWith("var(")) continue;
        // valen las dos elegidas y los respaldos genericos
        const ok = allowed.some((a) => clean.includes(a));
        assert.ok(ok, `unexpected font family "${clean}" in "${m[0]}"`);
      }
    }
    // y la peticion de fuentes no puede traer mas de dos
    const links = [...indexHtml.matchAll(/<link[^>]+href="([^"]*fonts\.googleapis[^"]*)"/gi)].map((m) => m[1]).filter((h) => h.includes("family="));
    if (links.length > 0) {
      const href = links[0];
      const families = href.split("family=").slice(1).map((s) => s.split("&")[0].split(":")[0]);
      assert.ok(families.length <= 2, `Google Fonts link should have <=2 families, got ${families.length}: ${families.join(",")}`);
      const hasDisplay = families.some((f) => f.toLowerCase().includes("syne"));
      const hasText = families.some((f) => f.toLowerCase().replace("+", " ").includes("space grotesk"));
      assert.ok(hasDisplay, "Google Fonts should include Syne");
      assert.ok(hasText, "Google Fonts should include Space Grotesk");
    }
  });

  it("no JetBrains Mono", () => {
    const files = readStyles();
    const indexHtml = readFileSync(new URL("../index.html", import.meta.url).pathname, "utf8");
    const all = files.map((f) => f.content).join("\n") + indexHtml;
    assert.ok(!all.includes("JetBrains"), "JetBrains Mono should be removed");
  });

  it("color-scheme light meta present", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url).pathname, "utf8");
    assert.ok(html.includes('name="color-scheme"') && html.includes('content="light"'), "missing <meta name=\"color-scheme\" content=\"light\">");
    const tokensCss = readFileSync(join(stylesDir, "tokens.css"), "utf8");
    const paper = tokensCss.match(/--paper\s*:\s*(#[0-9a-fA-F]{3,8})/)?.[1];
    assert.ok(paper, "missing --paper token in tokens.css");
    assert.ok(html.includes('name="theme-color"') && html.includes(paper), `theme-color should match --paper (${paper})`);
  });
});
