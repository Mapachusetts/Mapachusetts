export interface CareerEntry {
  /** e.g. "2013-present" or "2005-2013" */
  period: string;
  /** e.g. "U.S. Senator" */
  role: string;
  /** optional free-text detail */
  notes?: string;
}

export interface Politician {
  id: string;
  slug: string;
  name: string;
  party: string | null;
  state: string | null;
  current_office: string | null;
  bio: string | null;
  career_history: CareerEntry[];
  created_at: string;
}

export interface Article {
  id: number;
  url: string;
  title: string;
  snippet: string | null;
  source: string | null;
  published_at: string | null;
  created_at: string;
}

/** Shape used when inserting a new article (DB fills id + created_at). */
export type NewArticle = Omit<Article, "id" | "created_at">;

/** One numbered source behind a news summary; `n` matches the [n] marker. */
export interface Citation {
  n: number;
  title: string;
  url: string;
  source: string | null;
  published_at: string | null;
}

/** Cited, AI-generated summary of recent coverage for one politician. */
export interface PoliticianNewsSummary {
  politician_id: string;
  /** Plain text with inline [n] citation markers. */
  summary: string;
  citations: Citation[];
  article_count: number;
  model: string | null;
  generated_at: string;
}

// ── Candidate research profiles (interface from the candidate-search branch) ──

/** One industry/PAC line in the Funding tab bar chart. */
export interface FundingSource {
  label: string;
  /** Dollars. */
  amount: number;
  /** Share of top contributions, 0–100. */
  pct: number;
}

export interface Funding {
  total: string;
  topIndustry: string;
  smallDonorPct: string;
  plainEnglish?: string;
  whyItMatters?: string;
  sources: FundingSource[];
  foreignSources: FundingSource[];
}

/** A role as displayed in the Career tab (most recent first). */
export interface ProfileCareerEntry {
  years: string;
  title: string;
  org: string;
  description: string;
}

export interface VoteRecordEntry {
  bill: string;
  year: number;
  vote: string;
}

export interface SubIssue {
  id: string;
  label: string;
  plainEnglish?: string;
  whyItMatters?: string;
  /** 0–100 support level (0–20 strongly opposed … 80–100 strongly supports). */
  alignment?: number;
  stance?: string;
  detail: string;
  voteRecord?: VoteRecordEntry[];
}

export interface IssueTopic {
  id: string;
  topic: string;
  icon: string;
  subIssues: SubIssue[];
}

export type SourceBias =
  | "left"
  | "center-left"
  | "center"
  | "center-right"
  | "right"
  | "nonpartisan";

export type SourceType =
  | "government"
  | "factcheck"
  | "newspaper"
  | "nonprofit"
  | "academic"
  | "wire";

export interface ResearchSource {
  name: string;
  url: string;
  bias: SourceBias;
  type: SourceType;
  description: string;
}

export interface Misconception {
  category: string;
  myth: string;
  mythSourceLabel?: string;
  mythSourceUrl?: string;
  reality: string;
  sourceLabel: string;
  sourceUrl: string;
}

/** Hand-curated research profile, keyed by the politician's slug. */
export interface CandidateProfile {
  slug: string;
  name: string;
  role: string;
  party: string;
  /** Official public-domain headshot URL (e.g. congressional bioguide). */
  photo?: string;
  openSecretsUrl?: string;
  funding?: Funding;
  career?: ProfileCareerEntry[];
  opinions?: IssueTopic[];
  sources?: ResearchSource[];
  misconceptions?: Misconception[];
}

/** Everything the research UI shows for one candidate (Supabase + curated profile). */
export interface CandidateView {
  slug: string;
  name: string;
  role: string;
  party: string;
  photo: string | null;
  bio: string | null;
  openSecretsUrl: string | null;
  career: ProfileCareerEntry[];
  funding: Funding | null;
  opinions: IssueTopic[];
  sources: ResearchSource[];
  misconceptions: Misconception[];
  news: PoliticianNewsSummary | null;
}
