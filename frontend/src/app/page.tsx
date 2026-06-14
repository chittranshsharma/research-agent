'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Loader2, ArrowRight } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { getSessions } from '@/lib/api';
import { SessionSummary } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

export default function Home() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadSessions() {
      try {
        const data = await getSessions();
        // Just take the top 5 for the home page
        setSessions(data.slice(0, 5));
      } catch (error) {
        console.error('Failed to load sessions:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSessions();
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl text-center">
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-white">
          Research anything. <br className="hidden sm:block" />
          <span className="text-muted-foreground">Remember everything.</span>
        </h1>
        <p className="mb-10 text-lg text-muted-foreground">
          AI-powered research with persistent memory across sessions.
        </p>

        <div className="mx-auto max-w-2xl">
          <SearchBar autoFocus className="shadow-lg" />
        </div>

        <div className="mt-20">
          <h2 className="mb-6 flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="h-4 w-4" />
            Recent Sessions
          </h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
              {sessions.map((session) => (
                <Card 
                  key={session.session_id} 
                  className="cursor-pointer transition-all hover:border-primary/50 hover:bg-muted/50 text-left border-border bg-card/50"
                  onClick={() => router.push(`/research/${session.session_id}`)}
                >
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base line-clamp-1">{session.topic}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {session.session_id.substring(0, 8)}...
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 flex justify-between items-center text-xs text-muted-foreground">
                    <span>
                      {session.created_at ? formatDistanceToNow(new Date(session.created_at), { addSuffix: true }) : 'Unknown date'}
                    </span>
                    <ArrowRight className="h-3 w-3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No recent sessions found. Start a new research!</p>
          )}
        </div>
      </div>
    </div>
  );
}
