'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Search, Loader2, Calendar } from 'lucide-react';
import { getSessions } from '@/lib/api';
import { SessionSummary } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await getSessions();
        setSessions(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredSessions = sessions.filter(s => 
    s.topic.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto py-10 px-4 md:px-8 max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Research Sessions</h1>
          <p className="text-muted-foreground mt-1">Browse and filter all your past research sessions.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search topics..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 border-border bg-card/50"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSessions.length > 0 ? (
        <div className="rounded-md border border-border bg-card/20 overflow-hidden">
          <div className="grid grid-cols-12 border-b border-border bg-muted/40 p-4 text-sm font-medium text-muted-foreground">
            <div className="col-span-6 sm:col-span-8">Topic</div>
            <div className="col-span-3 sm:col-span-2 hidden sm:block">Date</div>
            <div className="col-span-6 sm:col-span-2 text-right">Action</div>
          </div>
          <div className="divide-y divide-border">
            {filteredSessions.map((session) => (
              <div key={session.session_id} className="grid grid-cols-12 items-center p-4 transition-colors hover:bg-muted/20">
                <div className="col-span-8 sm:col-span-8 pr-4">
                  <p className="font-medium text-white line-clamp-1">{session.topic}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{session.session_id}</p>
                </div>
                <div className="col-span-4 sm:col-span-2 hidden sm:flex items-center text-xs text-muted-foreground">
                  <Calendar className="mr-2 h-3 w-3" />
                  {session.created_at ? formatDistanceToNow(new Date(session.created_at), { addSuffix: true }) : 'Unknown'}
                </div>
                <div className="col-span-4 sm:col-span-2 text-right">
                  <Link href={`/research/${session.session_id}`}>
                    <Button variant="secondary" size="sm" className="w-full sm:w-auto">
                      View
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex h-64 flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/10">
          <p className="text-muted-foreground">No sessions found matching your search.</p>
          {searchQuery && (
            <Button variant="link" onClick={() => setSearchQuery('')} className="mt-2 text-primary">
              Clear search
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
