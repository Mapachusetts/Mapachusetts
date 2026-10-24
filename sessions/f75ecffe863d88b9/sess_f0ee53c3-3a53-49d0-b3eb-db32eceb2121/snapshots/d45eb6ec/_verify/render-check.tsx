// TEMPORARY verification script (deleted after use).
// Stubs Supabase REST responses with the seed data, runs the real
// getCandidates() merge, and server-renders the research UI.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import CandidateResearch from "../components/CandidateResearch";
import { getCandidates } from "../lib/candidates";
import { formatDate } from "../lib/format";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stub.supabase.local";
process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-key";

interface SeedFile {
  politician: Record<string, unknown> & { slug: string; name: string };
  summary: string;
  citations: { n: number; title: string; url: string; source: string; published_at: string }[];
}

const dir = join(process.cwd(), "supabase", "seed-data");
const seeds: SeedFile[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as SeedFile);

const politicians = seeds.map((s, i) => ({
  id: `00000000-0000-0000-0000-00000000000${i}`,
  created_at: "2026-10-24T00:00:00Z",
  ...s.politician,
}));
const summaries = seeds.map((s, i) => ({
  politician_id: `00000000-0000-0000-0000-00000000000${i}`,
  summary: s.summary,
  citations: s.citations.map(({ n, title, url, source, published_at }) => ({ n, title, url, source, published_at })),
  article_count: s.citations.length,
  model: "test",
  generated_at: "2026-10-24T18:00:00Z",
}));

const requested: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input instanceof Request ? input.url : input);
  requested.push(url);
  const rows = url.includes("/rest/v1/politicians")
    ? politicians
    : url.includes("/rest/v1/politician_news_summaries")
      ? summaries
      : null;
  if (!rows) return new Response("not stubbed", { status: 404 });
  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch;

let failures = 0;
function check(label: string, ok: boolean) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}

const candidates = await getCandidates();
check("both Supabase tables were queried", requested.length === 2);
check(
  `candidate list = 4 seeded + Warren profile-only (got ${candidates.map((c) => c.slug).join(", ")})`,
  candidates.length === 5 && candidates.some((c) => c.slug === "elizabeth-warren")
);

const markey = candidates.find((c) => c.slug === "ed-markey");
check("Markey merged: Supabase row + curated funding", markey?.funding?.total === "$11,200,000");
check("Markey merged: Supabase news summary attached", (markey?.news?.citations.length ?? 0) === 8);
check("Markey career sorted newest first", markey?.career[0]?.years === "2025-present");
check(
  "Markey career: curated description joined by years (2013-present)",
  markey?.career.find((e) => e.years === "2013-present")?.description.includes("Green New Deal") ?? false
);
check("Markey party normalized to 'Democratic'", markey?.party === "Democratic");

for (const seed of seeds) {
  const html = renderToString(
    <CandidateResearch candidates={candidates} initialSlug={seed.politician.slug} />
  );
  const name = seed.politician.name;
  const firstTitle = seed.citations[0].title.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
  check(`${name}: profile header rendered`, html.includes(`<h3>${name}</h3>`));
  check(`${name}: In the News tab active by default`, /id="tab-news"[^>]*aria-selected="true"/.test(html) || /aria-selected="true"[^>]*id="tab-news"/.test(html));
  check(`${name}: summary has [n] citation links`, html.includes('href="#news-cite-1"'));
  check(`${name}: numbered source list rendered`, html.includes('id="news-cite-1"') && html.includes(firstTitle));
  check(`${name}: career entries rendered`, (html.match(/class="career-entry"/g) ?? []).length === (seed.politician.career_history as unknown[]).length);
  check(`${name}: no raw [n] markers left for valid citations`, !/\[1\]<\/p>/.test(html));
}

const healeyHtml = renderToString(<CandidateResearch candidates={candidates} initialSlug="maura-healey" />);
check("Healey: Funding tab shows empty state with OCPF link", healeyHtml.includes("https://www.ocpf.us"));
check("Healey: Issues tab shows empty state", healeyHtml.includes("Issue positions and voting records haven"));

const warrenHtml = renderToString(<CandidateResearch candidates={candidates} initialSlug="elizabeth-warren" />);
check("Warren (profile only): Funding tab is default when there's no news", /id="tab-funding"[^>]*aria-selected="true"/.test(warrenHtml) || /aria-selected="true"[^>]*id="tab-funding"/.test(warrenHtml));
check("Warren: issues accordion rendered", warrenHtml.includes('class="topic-group"'));
check("Warren: myths rendered", warrenHtml.includes('class="myth-card"'));

const emptyHtml = renderToString(<CandidateResearch candidates={candidates} initialSlug={null} />);
check("No selection: empty state + 5 browse chips", (emptyHtml.match(/class="candidate-chip"/g) ?? []).length === 5);

const badSlug = renderToString(<CandidateResearch candidates={candidates} initialSlug="not-a-real-slug" />);
check("Unknown ?candidate= slug falls back to empty state", badSlug.includes("Search a candidate above"));

check("formatDate date-only is timezone-stable", formatDate("2026-10-13") === "Oct 13, 2026");
check("formatDate timestamp uses Massachusetts time", formatDate("2026-10-24T03:44:00Z") === "Oct 23, 2026");
check("formatDate falls back to raw text", formatDate("sometime") === "sometime");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
