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
