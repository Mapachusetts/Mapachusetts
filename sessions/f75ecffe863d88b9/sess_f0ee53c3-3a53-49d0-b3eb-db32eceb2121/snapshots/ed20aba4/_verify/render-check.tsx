// TEMPORARY verification script (deleted after use).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import ResearchSection from "../components/ResearchSection";
import { getCandidates } from "../lib/candidates";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stub.supabase.local";
process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-key";

interface SeedFile {
  politician: Record<string, unknown> & { slug: string; name: string };
  summary: string;
  citations: { n: number; title: string; url: string; source: string; published_at: string }[];
}
const dir = join(process.cwd(), "supabase", "seed-data");
const seeds: SeedFile[] = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as SeedFile);
const politicians = seeds.map((s, i) => ({ id: `id-${i}`, created_at: "2026-10-24T00:00:00Z", ...s.politician }));
const summaries = seeds.map((s, i) => ({
  politician_id: `id-${i}`, summary: s.summary, article_count: 8, model: "test", generated_at: "2026-10-24T18:00:00Z",
  citations: s.citations.map(({ n, title, url, source, published_at }) => ({ n, title, url, source, published_at })),
}));
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input instanceof Request ? input.url : input);
  const rows = url.includes("/rest/v1/politicians") ? politicians : url.includes("/rest/v1/politician_news_summaries") ? summaries : null;
  return rows ? new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } }) : new Response("x", { status: 404 });
}) as typeof fetch;

let failures = 0;
function check(label: string, ok: boolean) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}

const candidates = await getCandidates();
for (const slug of ["maura-healey", "mike-minogue", "ed-markey", "john-deaton", "elizabeth-warren"]) {
  const html = renderToString(<ResearchSection candidates={candidates} initialSlug={slug} />);
  const c = candidates.find((x) => x.slug === slug)!;
  check(`${c.name}: profile opens directly (/candidates/${slug})`, html.includes(`<h3>${c.name}</h3>`));
  check(`${c.name}: "on the map" link -> /?place=us-ma`, html.includes('href="/?place=us-ma"'));
}
const markey = renderToString(<ResearchSection candidates={candidates} initialSlug="ed-markey" />);
check("Markey: news, photo, status card and OpenSecrets still render", markey.includes('href="#news-cite-1"') && markey.includes("has-photo") && markey.includes('class="status-card"') && markey.includes("View on OpenSecrets"));
const none = renderToString(<ResearchSection candidates={candidates} initialSlug={null} />);
check("/candidates: search + browse chips + link back to the globe", none.includes('id="candidateSearch"') && (none.match(/class="candidate-chip"/g) ?? []).length === 5 && none.includes('<a href="/">Find your races on the globe</a>'));

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
