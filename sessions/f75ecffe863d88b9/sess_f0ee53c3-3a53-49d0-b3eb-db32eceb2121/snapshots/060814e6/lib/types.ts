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
