// TEMPORARY: check that relative links and backticked repo paths in the docs exist.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

let bad = 0;
for (const doc of ["README.md", "docs/DEVELOPMENT.md"]) {
  const text = readFileSync(doc, "utf8");
  const base = dirname(doc);
  const headings = new Set(
    [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) =>
      m[1].trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s/g, "-")
    )
  );
  for (const [, target] of text.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^https?:/.test(target)) continue;
    const [path, anchor] = target.split("#");
    if (path && !existsSync(join(base, path))) { bad++; console.log(`${doc}: missing file ${target}`); }
    if (!path && anchor && !headings.has(anchor)) { bad++; console.log(`${doc}: missing anchor #${anchor}`); }
  }
  for (const [, p] of text.matchAll(/`((?:public|app|components|lib|supabase|docs)\/[\w./-]+)`/g)) {
    if (!existsSync(p.replace(/\/$/, ""))) { bad++; console.log(`${doc}: missing path ${p}`); }
  }
}
console.log(bad === 0 ? "ALL LINKS AND PATHS OK" : `${bad} PROBLEM(S)`);
process.exit(bad ? 1 : 0);
