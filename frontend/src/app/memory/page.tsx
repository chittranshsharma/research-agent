'use client';

import { useEffect, useState } from 'react';
import { Loader2, ExternalLink, Database } from 'lucide-react';
import { getSessions, getSessionMemory } from '@/lib/api';
import { SessionSummary, MemoryInsight } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

export default function MemoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [insights, setInsights] = useState<MemoryInsight[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    async function loadSessions() {
      try {
        const data = await getSessions();
        setSessions(data);
        if (data.length > 0) {
          setSelectedSessionId(data[0].session_id);
        }
      } catch (err) {
        console.error('Failed to load sessions', err);
      } finally {
        setLoadingSessions(false);
      }
    }
    loadSessions();
  }, []);

  useEffect(() => {
    async function loadInsights() {
      if (!selectedSessionId) return;
      setLoadingInsights(true);
      try {
        const data = await getSessionMemory(selectedSessionId);
        setInsights(data);
      } catch (err) {
        console.error('Failed to load insights', err);
        setInsights([]);
      } finally {
        setLoadingInsights(false);
      }
    }
    loadInsights();
  }, [selectedSessionId]);

  return (
    <div className="container mx-auto py-10 px-4 md:px-8 max-w-5xl flex-1 flex flex-col">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          Memory Browser
        </h1>
        <p className="text-muted-foreground mt-1">
          Explore all insights the Research Agent has retained from past sessions.
        </p>
      </div>

      {loadingSessions ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/10">
          <p className="text-muted-foreground">No sessions available to browse.</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-8 flex-1">
          {/* Left side: Selector */}
          <div className="w-full md:w-1/3 flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Select Session
            </h2>
            <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {sessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => setSelectedSessionId(s.session_id)}
                  className={`text-left p-4 rounded-lg border transition-all ${
                    selectedSessionId === s.session_id
                      ? 'bg-primary/10 border-primary shadow-sm'
                      : 'bg-card/20 border-border hover:bg-muted/30'
                  }`}
                >
                  <p className="font-medium text-white line-clamp-2 text-sm leading-tight">{s.topic}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {s.created_at ? formatDistanceToNow(new Date(s.created_at), { addSuffix: true }) : 'Unknown date'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Right side: Insights */}
          <div className="w-full md:w-2/3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Extracted Insights
              </h2>
              <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary">
                {insights.length} Total
              </span>
            </div>

            {loadingInsights ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : insights.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/10">
                <p className="text-muted-foreground">No insights stored for this session.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {insights.map((insight, i) => (
                  <Card key={i} className="bg-card/30 border-border">
                    <CardContent className="p-5">
                      <p className="text-gray-200 text-sm leading-relaxed mb-4">{insight.insight}</p>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground pt-3 border-t border-border/50">
                        <a 
                          href={insight.source_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1 hover:text-primary transition-colors max-w-[80%] truncate"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{insight.source_title || insight.source_url}</span>
                        </a>
                        {insight.created_at && (
                          <span className="shrink-0">{new Date(insight.created_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
