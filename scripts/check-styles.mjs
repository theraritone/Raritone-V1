/**
 * Verifies that every Tailwind class used in the source actually produced CSS.
 *
 * Tailwind silently drops a class it does not recognise — a typo, or a utility
 * that needs a theme entry that does not exist — and the result is an element
 * with no background, no text colour, or no layout. That is invisible to a
 * typecheck and easy to miss in a screenshot, so this reads the built stylesheet
 * and cross-checks it against the classes the app really uses.
 *
 * Run after a build:  node scripts/check-styles.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const DIST = "dist";
const SRC = "src";

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if ([".ts", ".tsx", ".html"].includes(extname(path))) out.push(path);
  }
  return out;
}

const cssFile = readdirSync(join(DIST, "assets")).find((name) => name.endsWith(".css"));
if (!cssFile) {
  console.error("No built stylesheet. Run `npm run build` first.");
  process.exit(1);
}
const css = readFileSync(join(DIST, "assets", cssFile), "utf8");

/**
 * Collects class names from `className`/`class` attributes only. Anything else in
 * the source — SVG path data, import specifiers, URLs — is not a class, and
 * matching those produces pure noise.
 */
function classesFrom(source) {
  const found = [];
  const attribute = /(?:className|class)\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g;
  for (const match of source.matchAll(attribute)) {
    // Only the literal segments of a template literal are static classes;
    // anything inside ${...} is a runtime value and cannot be checked here.
    found.push((match[1] ?? match[2] ?? match[3] ?? "").replace(/\$\{[^}]*\}/g, " "));
  }
  return found;
}

const candidates = new Set();
for (const file of [...walk(SRC), "index.html"]) {
  for (const chunk of classesFrom(readFileSync(file, "utf8"))) {
    for (const token of chunk.split(/\s+/)) {
      if (token.length > 120) continue;
      candidates.add(token);
    }
  }
}

/**
 * Tailwind escapes exactly the characters that are special in a CSS selector.
 * Hyphen and underscore are not special and are left alone, so escaping them
 * here would make every class look absent.
 */
function escapeClass(name) {
  return name.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}]/g, (char) => `\\${char}`);
}

const missing = [];
for (const token of candidates) {
  // Tailwind writes the variant into the selector (`.disabled\:opacity-40:disabled`),
  // so the full token is what has to be present. Checking a stripped base instead
  // would wrongly pass a class that only exists bare, and wrongly fail one whose
  // base is never used on its own.
  if (!css.includes(`.${escapeClass(token)}`)) missing.push(token);
}

const total = candidates.size;
if (missing.length === 0) {
  console.log(`all ${total} classes are present in the built stylesheet`);
  process.exit(0);
}

console.error(`${missing.length} of ${total} classes produced no CSS:`);
for (const token of missing.sort()) console.error(`  ${token}`);
process.exit(1);
