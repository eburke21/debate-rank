// Mirrors backend Pydantic schemas — this is the frontend's contract with the API.

export type Rubric = "logic" | "evidence" | "persuasion" | "originality";

export const RUBRICS: Rubric[] = ["logic", "evidence", "persuasion", "originality"];

export const RUBRIC_META: Record<Rubric, { name: string; icon: string }> = {
  logic: { name: "Logical Rigor", icon: "🔬" },
  evidence: { name: "Evidence Quality", icon: "📊" },
  persuasion: { name: "Persuasiveness", icon: "🎭" },
  originality: { name: "Originality", icon: "💡" },
};

export type ArgumentStatus =
  | "pending"
  | "scoring"
  | "scored"
  | "partial"
  | "failed";

export type ScoreMap = Partial<Record<Rubric, number>>;

export interface TopicResponse {
  id: string;
  title: string;
  description: string | null;
  argument_count: number;
}

export interface ArgumentSummary {
  id: string;
  body: string;
  author_name: string | null;
  status: ArgumentStatus;
  scores: ScoreMap;
  composite_score: number | null;
  submitted_at: string;
}

export interface ScoreResponse {
  rubric: Rubric;
  score: number;
  rationale: string;
}

export interface ArgumentDetail {
  id: string;
  body: string;
  author_name: string | null;
  status: ArgumentStatus;
  scores: ScoreResponse[];
  composite_score: number | null;
  submitted_at: string;
  scored_at: string | null;
}

export interface ArgumentSubmitResponse {
  id: string;
  status: ArgumentStatus;
  message: string;
}

export interface LeaderboardResponse {
  topic: TopicResponse;
  arguments: ArgumentSummary[];
}

export type Weights = Record<Rubric, number>;
