import {
  ResearchResponse,
  SessionSummary,
  MemoryInsight,
  MemoryItem,
  AskResponse,
  Entity,
  Relationship,
  Citation,
} from './types';
import { supabase } from './supabase';

// Use the actual backend URL directly to avoid Next.js proxy timeouts on long requests.
// FastAPI has CORS enabled for all origins, so this is safe.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Utility function to generate headers containing the active Supabase JWT token.
 */
async function getHeaders(customHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const headers: Record<string, string> = { ...customHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Trigger a new research session or continue an existing one (blocking).
 */
export async function startResearch(
  topic: string,
  sessionId?: string
): Promise<ResearchResponse> {
  const response = await fetch(`${BASE_URL}/research`, {
    method: 'POST',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ topic, session_id: sessionId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to start research');
  }

  return response.json();
}

/**
 * Stream a new research session via Server-Sent Events.
 * Calls onStatus for status updates, onChunk for report text chunks,
 * and onComplete once the full result arrives.
 */
export async function streamResearch(
  topic: string,
  onStatus: (message: string) => void,
  onChunk: (chunk: string) => void,
  onComplete: (data: {
    session_id: string;
    entities: Entity[];
    relationships: Relationship[];
    citations: Citation[];
  }) => void
): Promise<void> {
  const response = await fetch(`${BASE_URL}/research/stream`, {
    method: 'POST',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ topic }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to start streaming research');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) throw new Error('No response body');

  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'status') onStatus(data.message);
          else if (data.type === 'chunk') onChunk(data.content);
          else if (data.type === 'complete') onComplete(data);
          else if (data.type === 'error') throw new Error(data.message);
        } catch (e) {
          console.error('SSE parse error:', e);
        }
      }
    }
  }
}

/**
 * Get all past sessions.
 */
export async function getSessions(): Promise<SessionSummary[]> {
  const response = await fetch(`${BASE_URL}/sessions`, {
    headers: await getHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch sessions');
  }

  return response.json();
}

/**
 * Get a specific research session with full report.
 */
export async function getResearchSession(sessionId: string): Promise<ResearchResponse> {
  const response = await fetch(`${BASE_URL}/research/${sessionId}`, {
    headers: await getHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch research session');
  }

  return response.json();
}

/**
 * Get memory insights for a specific session.
 */
export async function getSessionMemory(
  sessionId: string
): Promise<MemoryInsight[]> {
  const response = await fetch(`${BASE_URL}/memory/${sessionId}`, {
    headers: await getHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch session memory');
  }

  return response.json();
}

/**
 * Search across ALL stored memory insights using vector similarity.
 */
export async function searchMemory(
  query: string,
  limit: number = 10
): Promise<{ query: string; results: MemoryItem[]; count: number }> {
  const response = await fetch(
    `${BASE_URL}/memory/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    {
      headers: await getHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error('Memory search failed');
  }

  return response.json();
}

/**
 * Ask a follow-up question.
 */
export async function askQuestion(
  question: string,
  sessionId?: string
): Promise<AskResponse> {
  const response = await fetch(`${BASE_URL}/ask`, {
    method: 'POST',
    headers: await getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question, session_id: sessionId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to ask question');
  }

  return response.json();
}

/**
 * Get freshness / decay scores for all insights in a session.
 */
export async function getMemoryFreshness(sessionId: string): Promise<{
  session_id: string;
  insights: (MemoryItem & {
    freshness_score: number;
    age_days: number;
    is_stale: boolean;
    decay_label: 'Fresh' | 'Recent' | 'Aging' | 'Stale';
  })[];
  total: number;
  stale_count: number;
  needs_refresh: boolean;
}> {
  const res = await fetch(`${BASE_URL}/memory/${sessionId}/freshness`, {
    headers: await getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch freshness data');
  return res.json();
}

/**
 * Find research sessions with topics similar to the given session.
 */
export async function getRelatedSessions(
  sessionId: string
): Promise<{ related: SessionSummary[] }> {
  const res = await fetch(`${BASE_URL}/sessions/${sessionId}/related`, {
    headers: await getHeaders(),
  });
  if (!res.ok) return { related: [] };
  return res.json();
}
