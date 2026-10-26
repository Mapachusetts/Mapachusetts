// TEMPORARY verification script (deleted after use).
// Stubs Supabase with the seed data, runs the real getCandidates() merge, and
// server-renders the research UI for every candidate.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import CandidateResearch from "../components/CandidateResearch";
import { CANDIDATE_PROFILES } from "../lib/candidate-profiles";
import { getCandidates } from "../lib/candidates";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stub.supabase.local";
process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-key";

interface SeedFile {
  politician: Record<string, unknown> & { slug: string; name: string; career_history: unknown[] };
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

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input instanceof Request ? input.url : input);
  const rows = url.includes("/rest/v1/politicians")
    ? politicians
    : url.includes("/rest/v1/politician_news_summaries")
      ? summaries
      : null;
  if (!rows) return new Response("not stubbed", { status: 404 });
  return new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

let failures = 0;
function check(label: string, ok: boolean) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}
const count = (html: string, needle: string) => html.split(needle).length - 1;
const render = (slug: string | null) =>
  renderToString(<CandidateResearch candidates={candidates} initialSlug={slug} />);

const candidates = await getCandidates();
check("5 candidates (4 Supabase + Warren profile-only)", candidates.length === 5);

// Supabase-backed candidates still render news, career, etc.
for (const seed of seeds) {
  const html = render(seed.politician.slug);
  const name = seed.politician.name;
  check(`${name}: header + In the News default`, html.includes(`<h3>${name}</h3>`) && /id="tab-news"[^>]*aria-selected="true"|aria-selected="true"[^>]*id="tab-news"/.test(html));
  check(`${name}: citations linked`, html.includes('href="#news-cite-1"') && html.includes('id="news-cite-1"'));
  check(`${name}: career entries`, count(html, 'class="career-entry"') === seed.politician.career_history.length);
}

// New candidate-search features.
for (const profile of CANDIDATE_PROFILES) {
  const html = render(profile.slug);
  const name = profile.name;
  check(`${name}: official photo rendered`, html.includes(`src="${profile.photo}"`) && html.includes(`alt="Official photo of ${name}"`));
  check(`${name}: status badge in header`, html.includes('class="profile-status-badge"') && html.includes(`data-status-type="${profile.status?.statusType}"`));
  check(`${name}: term info in header`, html.includes('class="profile-term"'));
  check(`${name}: status card in Career tab`, html.includes('class="status-card"') && html.includes("What this means"));
  check(
    `${name}: ${profile.status?.committees?.length ?? 0} committee chips`,
    count(html, "<li>") >= (profile.status?.committees?.length ?? 0) && html.includes("Committee Assignments")
  );
  check(
    `${name}: all ${profile.opinions?.length} issue topics rendered`,
    count(html, 'class="topic-group"') === (profile.opinions?.length ?? 0)
  );
  check(
    `${name}: all ${profile.sources?.length} sources + ${profile.misconceptions?.length} myths rendered`,
    count(html, 'class="source-item"') >= (profile.sources?.length ?? 0) &&
      count(html, 'class="myth-card"') === (profile.misconceptions?.length ?? 0)
  );
}

// Candidates without curated profiles keep the initials avatar and no status UI.
const healey = render("maura-healey");
check("Healey: initials avatar (no photo)", healey.includes('class="profile-avatar"') && healey.includes(">MH<") && !healey.includes("has-photo"));
check("Healey: no status badge/card", !healey.includes("profile-status-badge") && !healey.includes('class="status-card"'));

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
