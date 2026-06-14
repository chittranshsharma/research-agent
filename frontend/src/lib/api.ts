import {
  ResearchResponse,
  SessionSummary,
  MemoryInsight,
  AskResponse,
} from './types';

// Use the actual backend URL directly to avoid Next.js proxy timeouts on long requests.
// FastAPI has CORS enabled for all origins, so this is safe.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Trigger a new research session or continue an existing one.
 */
export async function startResearch(
  topic: string,
  sessionId?: string
): Promise<ResearchResponse> {
  const response = await fetch(`${BASE_URL}/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, session_id: sessionId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to start research');
  }

  return response.json();
}

/**
 * Get all past sessions.
 */
export async function getSessions(): Promise<SessionSummary[]> {
  const response = await fetch(`${BASE_URL}/sessions`);

  if (!response.ok) {
    throw new Error('Failed to fetch sessions');
  }

  return response.json();
}

/**
 * Get a specific research session with full report.
 */
export async function getResearchSession(sessionId: string): Promise<ResearchResponse> {
  const response = await fetch(`${BASE_URL}/research/${sessionId}`);

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
  const response = await fetch(`${BASE_URL}/memory/${sessionId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch session memory');
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, session_id: sessionId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to ask question');
  }

  return response.json();
}
