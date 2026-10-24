// TEMPORARY verification helper (deleted after use).
import ts from "typescript";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";

const root = process.cwd();
const outRoot = join(root, "_verify", "out");
const files = [
  "components/CandidateResearch.tsx",
  "components/CitedText.tsx",
  "components/ResearchSection.tsx",
  "lib/format.ts",
  "lib/candidates.ts",
  "lib/articles.ts",
  "lib/politicians.ts",
  "lib/candidate-profiles.ts",
  "lib/supabase/server.ts",
  "lib/types.ts",
  "_verify/render-check.tsx",
];
for (const rel of files) {
  const { outputText } = ts.transpileModule(readFileSync(join(root, rel), "utf8"), {
    fileName: rel,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const fromDir = posix.dirname(rel);
  const rewritten = outputText.replace(
    /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(["'])([^"']+)\2/g,
    (match, prefix, quote, spec) => {
      let target;
      if (spec.startsWith("@/")) target = spec.slice(2);
      else if (spec.startsWith(".")) target = posix.join(fromDir, spec);
      else return match;
      let relPath = posix.relative(fromDir, target);
      if (!relPath.startsWith(".")) relPath = `./${relPath}`;
      return `${prefix}${quote}${relPath}.mjs${quote}`;
    }
  );
  const dest = join(outRoot, rel.replace(/\.(tsx|ts)$/, ".mjs"));
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, rewritten, "utf8");
}
console.log(`Transpiled ${files.length} files`);
