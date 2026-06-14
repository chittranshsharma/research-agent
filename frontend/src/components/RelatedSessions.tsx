'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getRelatedSessions } from '@/lib/api';
import { SessionSummary } from '@/lib/types';

interface RelatedSessionsProps {
  sessionId: string;
}

export function RelatedSessions({ sessionId }: RelatedSessionsProps) {
  const [related, setRelated] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    getRelatedSessions(sessionId)
      .then((data) => setRelated(data.related))
      .catch(() => setRelated([]))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="mt-6 space-y-2 px-2">
        <div className="h-3 w-32 bg-gray-800 rounded animate-pulse" />
        <div className="h-12 bg-gray-800 rounded animate-pulse" />
        <div className="h-12 bg-gray-800 rounded animate-pulse" />
      </div>
    );
  }

  if (related.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-border px-2 pb-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium px-2">
        You also researched
      </p>
      <div className="space-y-1.5">
        {related.map((session) => (
          <button
            key={session.session_id}
            onClick={() => router.push(`/research/${session.session_id}`)}
            className="w-full text-left p-3 rounded-lg border border-border hover:border-gray-600 hover:bg-gray-900 transition-all group"
          >
            <p className="text-sm text-gray-300 group-hover:text-white transition-colors line-clamp-1">
              {session.topic}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {new Date(session.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
