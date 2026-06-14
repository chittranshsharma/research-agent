export interface Entity {
  name: string;
  type: string;
  description: string;
}

export interface Relationship {
  source: string;
  relation: string;
  target: string;
}

export interface Citation {
  title: string;
  url: string;
  accessed_date?: string;
}

export interface ResearchResponse {
  session_id: string;
  topic: string;
  report: string;
  citations: Citation[];
  entities: Entity[];
  relationships: Relationship[];
}

export interface SessionSummary {
  session_id: string;
  topic: string;
  created_at: string;
}

export interface MemoryInsight {
  insight: string;
  source_title: string;
  source_url: string;
  created_at?: string;
}

export interface AskResponse {
  answer: string;
  sources: Citation[];
}

export interface MemoryItem {
  id?: string;
  session_id: string;
  topic: string;
  insight: string;
  source_url: string;
  source_title: string;
  similarity?: number;
  created_at?: string;
}
