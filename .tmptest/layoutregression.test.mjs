import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const stylesDir = fileURLToPath(new URL("../styles/", import.meta.url));

function readCss(name) {
  return readFileSync(join(stylesDir, name), "utf8");
}

describe("layout regression (dock + mobile topbar)", () => {
  it("dock is position: fixed with bottom:0 and height var(--dock-h)", () => {
    const css = readdirSync(stylesDir)
      .filter((f) => f.endsWith(".css"))
      .map((f) => readCss(f))
      .join("\n");
    // la regla de la barra inferior, se llame como se llame
    const hasFixed = /(?:\.player-bar|\.dock)\s*\{[^}]*position\s*:\s*fixed/i.test(css) ||
      /\.player-bar\s*,\s*\.dock\s*\{[^}]*position\s*:\s*fixed/i.test(css) ||
      /\.player-bar[\s\S]*?position\s*:\s*fixed/i.test(css);
    assert.ok(hasFixed, "expected .player-bar/.dock to have position: fixed");
    const hasBottom0 = /position\s*:\s*fixed[^}]*bottom\s*:\s*0/i.test(css) || /inset\s*:\s*auto\s+0\s+0\s+0/i.test(css);
    assert.ok(hasBottom0, "expected dock to have bottom:0 or inset: auto 0 0 0");
    const hasHeightVar = /height\s*:\s*var\(--dock-h\)/i.test(css);
    assert.ok(hasHeightVar, "expected dock height: var(--dock-h)");
    const hasZ = /z-index\s*:\s*\d+/i.test(css);
    assert.ok(hasZ, "expected dock to have z-index");
  });

  it("content has bottom padding referencing --dock-h", () => {
    const css = readdirSync(stylesDir)
      .filter((f) => f.endsWith(".css"))
      .map((f) => readCss(f))
      .join("\n");
    // el contenido necesita hueco abajo para no quedar tapado
    const hasPad = /padding-bottom\s*:\s*calc\(var\(--dock-h\)\s*\+\s*var\(--s6\)\)/i.test(css);
    assert.ok(hasPad, "expected padding-bottom: calc(var(--dock-h) + var(--s6))");
    // y la altura sale de los tokens
    const tokens = readCss("tokens.css");
    assert.ok(/--dock-h\s*:\s*88px/i.test(tokens), "tokens.css should define --dock-h: 88px");
  });

  it("mobile media query hides inline nav and shows menu button", () => {
    const css = readCss("components.css");
    const mobileBlock = css.match(/@media\s*\([^)]*max-width\s*:\s*720px[^)]*\)\s*\{([\s\S]*?)\n\}/i) ||
      css.match(/@media\s*\([^)]*max-width\s*:\s*390px[^)]*\)\s*\{([\s\S]*?)\}/i);
    // en pantalla pequena los enlaces sueltos se esconden y aparece el boton de menu
    const hasHideInline = /#openSearchBtn[\s\S]*?display\s*:\s*none/i.test(css) &&
      /#playlistsToggle[\s\S]*?display\s*:\s*none/i.test(css) &&
      /#shortcutsToggle[\s\S]*?display\s*:\s*none/i.test(css);
    assert.ok(hasHideInline, "expected mobile query to hide #openSearchBtn, #playlistsToggle, #shortcutsToggle");
    const hasShowMenu = /#menuToggle[\s\S]*?display\s*:\s*inline-flex/i.test(css);
    assert.ok(hasShowMenu, "expected mobile query to show #menuToggle as inline-flex");
    // y la barra superior no puede crecer
    const hasTopbarH = /@media[\s\S]*?\.topbar[\s\S]*?height\s*:\s*var\(--topbar-h\)/i.test(css);
    assert.ok(hasTopbarH, "expected mobile topbar to constrain height to var(--topbar-h) (<=64px)");
  });
});
