"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import CitedText from "@/components/CitedText";
import { formatDate } from "@/lib/format";
import type {
  CandidateView,
  Funding,
  FundingSource,
  IssueTopic,
  Misconception,
  PoliticianNewsSummary,
  ProfileCareerEntry,
  ResearchSource,
  SourceBias,
  SourceType,
  SubIssue,
} from "@/lib/types";

/*
 * Candidate research UI, ported from the candidate-search branch
 * (index.html + script.js) to React. Data comes from Supabase merged with the
 * curated profiles; see lib/candidates.ts.
 */

type TabId =
  | "news"
  | "funding"
  | "career"
  | "opinions"
  | "sources"
  | "misconceptions";

const TABS: { id: TabId; label: string }[] = [
  { id: "news", label: "① In the News" },
  { id: "funding", label: "② Funding" },
  { id: "career", label: "③ Career" },
  { id: "opinions", label: "④ Issues" },
  { id: "sources", label: "⑤ Sources" },
  { id: "misconceptions", label: "⑥ Myths & Facts" },
];

const MAX_SUGGESTIONS = 8;

const BIAS_LABELS: Record<SourceBias, { label: string; cls: string }> = {
  nonpartisan: { label: "Nonpartisan", cls: "nonpartisan" },
  center: { label: "Center", cls: "center" },
  "center-left": { label: "Center-Left", cls: "center-left" },
  "center-right": { label: "Center-Right", cls: "center-right" },
  left: { label: "Left", cls: "left" },
  right: { label: "Right", cls: "right" },
};

const TYPE_LABELS: Record<SourceType, string> = {
  government: "Gov't record",
  nonprofit: "Nonprofit",
  factcheck: "Fact-checker",
  newspaper: "Newspaper",
  wire: "Wire service",
  academic: "Academic",
};

// ── Helpers ───────────────────────────────────────────────

/** Only render http(s) links; anything else (e.g. javascript:) is dropped. */
function safeUrl(url: string | null | undefined): string | undefined {
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function partyKey(party: string): string {
  return party.trim().toLowerCase();
}

/** Open on the freshest tab that has data. */
function defaultTab(c: CandidateView): TabId {
  if (c.news) return "news";
  if (c.funding) return "funding";
  return "career";
}

function filterCandidates(
  list: CandidateView[],
  query: string
): CandidateView[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return list
    .filter((c) =>
      [c.name, c.role, c.party].some((field) => field.toLowerCase().includes(q))
    )
    .slice(0, MAX_SUGGESTIONS);
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function alignmentLabel(score: number): { text: string; cls: string } {
  if (score >= 80) return { text: "Strongly supports", cls: "align-strong-yes" };
  if (score >= 60) return { text: "Leans in favor", cls: "align-yes" };
  if (score >= 41) return { text: "Mixed position", cls: "align-mixed" };
  if (score >= 21) return { text: "Leans against", cls: "align-no" };
  return { text: "Strongly opposed", cls: "align-strong-no" };
}

function voteClass(vote: string): string {
  const v = vote.toLowerCase();
  if (["yes", "co-sponsor", "sponsored", "supported", "introduced"].includes(v)) {
    return "vote-yes";
  }
  if (v.startsWith("no")) return "vote-no";
  return "vote-neutral";
}

function timeOf(value: string | null): number {
  return value ? Date.parse(value) : Number.NaN;
}

// ── Main component ────────────────────────────────────────

export default function CandidateResearch({
  candidates,
  initialSlug,
}: {
  candidates: CandidateView[];
  initialSlug: string | null;
}) {
  const initial = candidates.find((c) => c.slug === initialSlug) ?? null;

  const [query, setQuery] = useState(initial?.name ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    initial?.slug ?? null
  );
  const [tab, setTab] = useState<TabId>(initial ? defaultTab(initial) : "news");
  const [scrollRequest, setScrollRequest] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(
    () => filterCandidates(candidates, query),
    [candidates, query]
  );
  const selected = candidates.find((c) => c.slug === selectedSlug) ?? null;
  const showSuggestions = open && matches.length > 0;

  // Close the suggestion list when clicking outside the search box.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Bring the profile into view after the user picks a candidate.
  useEffect(() => {
    if (scrollRequest > 0) {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [scrollRequest]);

  function selectCandidate(slug: string) {
    const c = candidates.find((x) => x.slug === slug);
    if (!c) return;
    setSelectedSlug(c.slug);
    setQuery(c.name);
    setOpen(false);
    setActiveIndex(-1);
    setTab(defaultTab(c));
    setScrollRequest((n) => n + 1);

    // Make the profile shareable (?candidate=slug) without navigating.
    const url = new URL(window.location.href);
    url.searchParams.set("candidate", c.slug);
    window.history.replaceState(null, "", url);
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const pick = activeIndex >= 0 ? matches[activeIndex] : matches[0];
      if (pick) selectCandidate(pick.slug);
      return;
    }
    if (matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
  }

  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const index = TABS.findIndex((t) => t.id === tab);
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next < 0) return;

    e.preventDefault();
    setTab(TABS[next].id);
    document.getElementById(`tab-${TABS[next].id}`)?.focus();
  }

  return (
    <>
      {/* Search bar */}
      <div className="search-wrapper" role="search" ref={wrapperRef}>
        <label htmlFor="candidateSearch" className="sr-only">
          Search candidate
        </label>
        <input
          type="search"
          id="candidateSearch"
          className="search-input"
          placeholder="Search candidate name (e.g. Maura Healey)…"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls="searchSuggestions"
          aria-activedescendant={
            showSuggestions && activeIndex >= 0
              ? `suggestion-${activeIndex}`
              : undefined
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onSearchKeyDown}
        />
        <button
          type="button"
          className="search-btn"
          aria-label="Search"
          onClick={() => {
            if (matches[0]) selectCandidate(matches[0].slug);
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
        <ul
          className="search-suggestions"
          id="searchSuggestions"
          role="listbox"
          aria-label="Candidate suggestions"
          hidden={!showSuggestions}
        >
          {matches.map((c, i) => (
            <li
              key={c.slug}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={i === activeIndex ? "suggestion-active" : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                selectCandidate(c.slug);
              }}
            >
              <strong>{c.name}</strong>
              <span>{[c.role, c.party].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="sr-only" aria-live="polite">
        {selected ? `Showing research profile for ${selected.name}.` : ""}
      </p>

      {selected ? (
        <div className="profile-panel" ref={panelRef} key={selected.slug}>
          <ProfileHeader c={selected} />

          <div className="tabs" role="tablist" aria-label="Candidate information">
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  id={`tab-${t.id}`}
                  role="tab"
                  className={`tab${active ? " active" : ""}`}
                  aria-selected={active}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  onKeyDown={onTabKeyDown}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <TabPanel id="news" active={tab}>
            <NewsPanel news={selected.news} />
          </TabPanel>
          <TabPanel id="funding" active={tab}>
            <FundingPanel funding={selected.funding} />
          </TabPanel>
          <TabPanel id="career" active={tab}>
            <CareerPanel bio={selected.bio} career={selected.career} />
          </TabPanel>
          <TabPanel id="opinions" active={tab}>
            <IssuesPanel opinions={selected.opinions} />
          </TabPanel>
          <TabPanel id="sources" active={tab}>
            <SourcesPanel sources={selected.sources} news={selected.news} />
          </TabPanel>
          <TabPanel id="misconceptions" active={tab}>
            <MythsPanel items={selected.misconceptions} />
          </TabPanel>
        </div>
      ) : (
        <div className="empty-state">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <p>Search a candidate above to get started.</p>
          {candidates.length > 0 && (
            <div
              className="candidate-browse"
              role="group"
              aria-label="Browse candidates"
            >
              {candidates.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  className="candidate-chip"
                  onClick={() => selectCandidate(c.slug)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Layout pieces ─────────────────────────────────────────

function TabPanel({
  id,
  active,
  children,
}: {
  id: TabId;
  active: TabId;
  children: ReactNode;
}) {
  return (
    <div
      className="tab-panel"
      id={`panel-${id}`}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
      hidden={id !== active}
    >
      {children}
    </div>
  );
}

function TabEmpty({ children }: { children: ReactNode }) {
  return <p className="tab-empty">{children}</p>;
}

function PlainEnglish({ text }: { text: string }) {
  return (
    <div className="plain-english-box">
      <span className="box-label">In plain English</span>
      <p>{text}</p>
    </div>
  );
}

function WhyItMatters({ text }: { text: string }) {
  return (
    <div className="why-matters-box">
      <span className="box-label">🔍 Why people are searching this</span>
      <p>{text}</p>
    </div>
  );
}

/** Official photo, falling back to party-colored initials if it fails to load. */
function Avatar({ c, party }: { c: CandidateView; party: string }) {
  const [failed, setFailed] = useState(false);
  const photo = safeUrl(c.photo);

  if (photo && !failed) {
    return (
      <div className="profile-avatar has-photo" data-party={party}>
        {/* Plain <img>: remote portrait, no next/image domain config needed. */}
        <img
          src={photo}
          alt={`Official photo of ${c.name}`}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="profile-avatar" data-party={party} aria-hidden="true">
      {initials(c.name)}
    </div>
  );
}

function ProfileHeader({ c }: { c: CandidateView }) {
  const party = partyKey(c.party);
  const openSecrets = safeUrl(c.openSecretsUrl);
  return (
    <div className="profile-header">
      <Avatar c={c} party={party} />
      <div className="profile-meta">
        <h3>{c.name}</h3>
        {c.role && <p className="profile-role">{c.role}</p>}
        {(c.party || c.status) && (
          <div className="profile-badges">
            {c.party && (
              <span className="profile-party" data-party={party}>
                {c.party}
              </span>
            )}
            {c.status && (
              <span
                className="profile-status-badge"
                data-status-type={c.status.statusType}
              >
                {c.status.statusLabel}
              </span>
            )}
          </div>
        )}
        {c.status?.termInfo && <p className="profile-term">{c.status.termInfo}</p>}
      </div>
      {openSecrets && (
        <a
          className="profile-source-link"
          href={openSecrets}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on OpenSecrets ↗
        </a>
      )}
    </div>
  );
}

// ── Tab 1: In the News ────────────────────────────────────

function NewsPanel({ news }: { news: PoliticianNewsSummary | null }) {
  if (!news) {
    return (
      <TabEmpty>
        No recent news coverage has been summarized for this candidate yet.
      </TabEmpty>
    );
  }

  const numbers = new Set(news.citations.map((c) => c.n));
  const dated = news.citations
    .filter((c) => !Number.isNaN(timeOf(c.published_at)))
    .sort((a, b) => timeOf(a.published_at) - timeOf(b.published_at));
  const from = formatDate(dated[0]?.published_at ?? null);
  const to = formatDate(dated[dated.length - 1]?.published_at ?? null);
  const range =
    from && to ? (from === to ? ` from ${from}` : ` from ${from} to ${to}`) : "";
  const updated = formatDate(news.generated_at);

  return (
    <>
      <p className="news-disclaimer">
        AI-generated summary of news coverage{range}. Verify claims using the
        linked sources.{updated && ` Updated ${updated}.`}
      </p>

      <CitedText
        text={news.summary}
        validNumbers={numbers}
        anchorPrefix="news-cite-"
      />

      {news.citations.length > 0 && (
        <>
          <h4 className="subsection-title">Sources</h4>
          <ol className="citations">
            {news.citations.map((c) => {
              const meta = [c.source, formatDate(c.published_at)]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={c.n} id={`news-cite-${c.n}`} value={c.n}>
                  <a
                    href={safeUrl(c.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {c.title}
                  </a>
                  {meta && <span className="meta-inline">{meta}</span>}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </>
  );
}

// ── Tab 2: Funding ────────────────────────────────────────

function FundingBars({
  items,
  label,
}: {
  items: FundingSource[];
  label: string;
}) {
  if (items.length === 0) return null;
  const maxPct = Math.max(...items.map((s) => s.pct));
  return (
    <ul className="funding-bars" aria-label={label}>
      {items.map((s) => (
        <li className="funding-bar-item" key={s.label}>
          <div className="funding-bar-label">
            <span>{s.label}</span>
            <span className="funding-bar-amount">{formatMoney(s.amount)}</span>
          </div>
          <div
            className="funding-bar-track"
            role="img"
            aria-label={`${s.label}: ${s.pct}% of top contributions`}
          >
            <div
              className="funding-bar-fill"
              style={{ width: `${maxPct > 0 ? (s.pct / maxPct) * 100 : 0}%` }}
              data-pct={`${s.pct}%`}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function FundingPanel({ funding }: { funding: Funding | null }) {
  if (!funding) {
    return (
      <TabEmpty>
        Campaign finance data hasn&apos;t been added for this candidate yet.
        Federal filings are on{" "}
        <a href="https://www.fec.gov/data/" target="_blank" rel="noopener noreferrer">
          FEC.gov
        </a>{" "}
        and{" "}
        <a href="https://www.opensecrets.org" target="_blank" rel="noopener noreferrer">
          OpenSecrets
        </a>
        ; Massachusetts state races are on{" "}
        <a href="https://www.ocpf.us" target="_blank" rel="noopener noreferrer">
          OCPF
        </a>
        .
      </TabEmpty>
    );
  }

  return (
    <>
      <div className="funding-summary">
        <div className="funding-stat">
          <span className="funding-stat-label">Total Raised</span>
          <span className="funding-stat-value">{funding.total}</span>
        </div>
        <div className="funding-stat">
          <span className="funding-stat-label">Top Industry</span>
          <span className="funding-stat-value">{funding.topIndustry}</span>
        </div>
        <div className="funding-stat">
          <span className="funding-stat-label">Small Donors (&lt;$200)</span>
          <span className="funding-stat-value">{funding.smallDonorPct}</span>
        </div>
      </div>

      {funding.plainEnglish && <PlainEnglish text={funding.plainEnglish} />}
      {funding.whyItMatters && <WhyItMatters text={funding.whyItMatters} />}

      <h4 className="subsection-title">Top Funding Sources by Industry</h4>
      <FundingBars items={funding.sources} label="Top funding sources breakdown" />

      {funding.foreignSources.length > 0 && (
        <>
          <h4 className="subsection-title">
            Foreign Policy &amp; Tariff-Related PAC Contributions
          </h4>
          <FundingBars
            items={funding.foreignSources}
            label="Foreign policy funding breakdown"
          />
        </>
      )}

      <p className="source-note">
        Data sourced from{" "}
        <a href="https://www.opensecrets.org" target="_blank" rel="noopener noreferrer">
          OpenSecrets.org
        </a>
        . Verify figures directly on their platform.
      </p>
    </>
  );
}

// ── Tab 3: Career ─────────────────────────────────────────

function CareerPanel({
  bio,
  career,
}: {
  bio: string | null;
  career: ProfileCareerEntry[];
}) {
  if (!bio && career.length === 0) {
    return <TabEmpty>Career history hasn&apos;t been added for this candidate yet.</TabEmpty>;
  }

  return (
    <>
      {bio && <p className="profile-bio">{bio}</p>}
      {career.length > 0 && (
        <>
          <p className="tab-intro">Roles held in chronological order, most recent first.</p>
          <ol className="career-timeline" aria-label="Career timeline">
            {career.map((entry, i) => (
              <li className="career-entry" key={`${entry.years}-${i}`}>
                <div className="career-years">{entry.years}</div>
                <div className="career-content">
                  <strong>{entry.title}</strong>
                  {entry.org && <em>{entry.org}</em>}
                  {entry.description && <p>{entry.description}</p>}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}

// ── Tab 4: Issues ─────────────────────────────────────────

function SubIssueItem({ topicId, sub }: { topicId: string; sub: SubIssue }) {
  const [expanded, setExpanded] = useState(false);
  const detailId = `sub-${topicId}-${sub.id}`;
  const score = typeof sub.alignment === "number" ? sub.alignment : null;
  const align = score === null ? null : alignmentLabel(score);

  return (
    <div className="sub-issue-item">
      <button
        type="button"
        className="sub-issue-toggle"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="sub-issue-top-row">
          <span className="sub-issue-label">{sub.label}</span>
          <span className="sub-chevron" aria-hidden="true">
            {expanded ? "▴" : "▾"}
          </span>
        </span>
        {align && (
          <span className="alignment-row">
            <span className="alignment-track" aria-hidden="true">
              <span
                className={`alignment-fill ${align.cls}`}
                style={{ width: `${score}%` }}
              />
            </span>
            <span className={`alignment-label ${align.cls}`}>
              {align.text} · {score}%
            </span>
          </span>
        )}
      </button>

      <div className="sub-issue-detail" id={detailId} hidden={!expanded}>
        {sub.plainEnglish && <PlainEnglish text={sub.plainEnglish} />}
        {sub.whyItMatters && <WhyItMatters text={sub.whyItMatters} />}

        <details className="detail-deep">
          <summary>Dig deeper</summary>
          <p>{sub.detail}</p>
        </details>

        {sub.voteRecord && sub.voteRecord.length > 0 && (
          <>
            <h5>Vote Record</h5>
            <ul className="vote-record">
              {sub.voteRecord.map((v, i) => (
                <li key={`${v.bill}-${i}`}>
                  <span className="vote-year">{v.year}</span>
                  <span className="vote-bill">{v.bill}</span>
                  <span className={`vote-badge ${voteClass(v.vote)}`}>{v.vote}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function IssuesPanel({ opinions }: { opinions: IssueTopic[] }) {
  if (opinions.length === 0) {
    return (
      <TabEmpty>
        Issue positions and voting records haven&apos;t been compiled for this
        candidate yet. The In the News tab covers positions reported in recent
        coverage.
      </TabEmpty>
    );
  }

  return (
    <>
      <p className="tab-intro">
        Select a topic, then expand any sub-issue to read the candidate&apos;s
        position and voting record.
      </p>
      <div className="opinions-list">
        {opinions.map((topic) => (
          <div className="topic-group" key={topic.id}>
            <div className="topic-header">
              <span className="topic-icon" aria-hidden="true">
                {topic.icon}
              </span>
              <h4 className="topic-title">{topic.topic}</h4>
              <span className="topic-count">
                {topic.subIssues.length} issue{topic.subIssues.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="sub-issues">
              {topic.subIssues.map((sub) => (
                <SubIssueItem key={sub.id} topicId={topic.id} sub={sub} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Tab 5: Sources ────────────────────────────────────────

function SourcesPanel({
  sources,
  news,
}: {
  sources: ResearchSource[];
  news: PoliticianNewsSummary | null;
}) {
  const cited = news?.citations ?? [];
  if (sources.length === 0 && cited.length === 0) {
    return <TabEmpty>No research sources have been added for this candidate yet.</TabEmpty>;
  }

  return (
    <>
      {sources.length > 0 ? (
        <>
          <p className="tab-intro">
            Every claim in this profile draws from the sources below. We include
            outlets across the political spectrum so you can cross-reference from
            multiple angles. Bias ratings come from{" "}
            <a href="https://adfontesmedia.com" target="_blank" rel="noopener noreferrer">
              Ad Fontes Media
            </a>{" "}
            and{" "}
            <a href="https://www.allsides.com" target="_blank" rel="noopener noreferrer">
              AllSides
            </a>
            .
          </p>
          <div className="sources-legend">
            <strong>Bias:</strong>
            <span className="bias-tag nonpartisan">Nonpartisan</span>
            <span className="bias-tag center">Center</span>
            <span className="bias-tag center-left">Center-Left</span>
            <span className="bias-tag center-right">Center-Right</span>
            <strong className="legend-gap">Type:</strong>
            <span className="type-tag government">Gov&apos;t</span>
            <span className="type-tag factcheck">Fact-check</span>
            <span className="type-tag nonprofit">Nonprofit</span>
            <span className="type-tag newspaper">Newspaper</span>
            <span className="type-tag wire">Wire</span>
            <span className="type-tag academic">Academic</span>
          </div>
          <ul className="sources-list" aria-label="Research sources">
            {sources.map((s) => {
              const bias = BIAS_LABELS[s.bias];
              return (
                <li className="source-item" key={`${s.name}-${s.url}`}>
                  <div className="source-item-header">
                    <a
                      className="source-name"
                      href={safeUrl(s.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {s.name} ↗
                    </a>
                    <div className="source-tags">
                      <span className={`bias-tag ${bias.cls}`}>{bias.label}</span>
                      <span className={`type-tag ${s.type}`}>{TYPE_LABELS[s.type]}</span>
                    </div>
                  </div>
                  <p className="source-description">{s.description}</p>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="tab-intro">
          These are the news articles behind the In the News summary. Curated
          research sources haven&apos;t been added for this candidate yet.
        </p>
      )}

      {cited.length > 0 && (
        <>
          <h4 className="subsection-title">News articles cited in “In the News”</h4>
          <ul className="sources-list" aria-label="News articles cited in the summary">
            {cited.map((c) => (
              <li className="source-item" key={c.n}>
                <div className="source-item-header">
                  <a
                    className="source-name"
                    href={safeUrl(c.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {c.title} ↗
                  </a>
                </div>
                <p className="source-description">
                  {[c.source, formatDate(c.published_at)].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

// ── Tab 6: Myths & Facts ──────────────────────────────────

function MythsPanel({ items }: { items: Misconception[] }) {
  if (items.length === 0) {
    return (
      <TabEmpty>
        No common misconceptions have been documented for this candidate yet.
      </TabEmpty>
    );
  }

  return (
    <>
      <p className="tab-intro">
        These are the most widely shared misconceptions about this candidate —
        the claims that spread fastest on social media, in debates, and in
        headlines. Each one is addressed with verifiable facts and a primary
        source you can check yourself.
      </p>
      <div className="misconceptions-list">
        {items.map((m, i) => {
          const mythUrl = safeUrl(m.mythSourceUrl);
          return (
            <div className="myth-card" key={`${m.category}-${i}`}>
              <div className="myth-category-tag">{m.category}</div>

              <div className="myth-block">
                <div className="myth-header">
                  <span className="myth-icon" aria-hidden="true">✕</span>
                  <span className="myth-heading">Common claim</span>
                </div>
                <p className="myth-text">“{m.myth}”</p>
                {mythUrl && (
                  <a
                    className="myth-source"
                    href={mythUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Where this claim comes from: {m.mythSourceLabel ?? "source"} ↗
                  </a>
                )}
              </div>

              <div className="reality-block">
                <div className="reality-header">
                  <span className="reality-icon" aria-hidden="true">✓</span>
                  <span className="reality-heading">What the record shows</span>
                </div>
                <p className="reality-text">{m.reality}</p>
                <a
                  className="reality-source"
                  href={safeUrl(m.sourceUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Verify this: {m.sourceLabel} ↗
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
