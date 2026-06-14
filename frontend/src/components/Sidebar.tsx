'use client';

import Link from 'next/link';

import { Plus, Database, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SessionSummary } from '@/lib/types';
import { RelatedSessions } from '@/components/RelatedSessions';


interface SidebarProps {
  sessions: SessionSummary[];
  currentSessionId?: string;
  memoryInsightCount?: number;
}

export function Sidebar({ sessions, currentSessionId, memoryInsightCount }: SidebarProps) {
  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-background min-h-0">
      <div className="p-4">
        <Link href="/">
          <Button className="w-full justify-start gap-2" variant="default">
            <Plus className="h-4 w-4" />
            New Research
          </Button>
        </Link>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-2">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Clock className="h-3 w-3" />
            Recent Sessions
          </h3>
        </div>
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-1 p-2">
            {sessions.map((session) => {
              const isActive = session.session_id === currentSessionId;
              return (
                <Link key={session.session_id} href={`/research/${session.session_id}`}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={`w-full justify-start text-left font-normal ${
                      isActive ? 'bg-secondary' : 'hover:bg-muted'
                    }`}
                  >
                    <span className="truncate" title={session.topic}>
                      {session.topic.length > 25 ? `${session.topic.substring(0, 25)}...` : session.topic}
                    </span>
                  </Button>
                </Link>
              );
            })}
            {sessions.length === 0 && (
              <p className="px-2 text-xs text-muted-foreground">No sessions yet</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {currentSessionId && memoryInsightCount !== undefined && (
        <div className="p-4 border-t border-border bg-muted/30">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Database className="h-3 w-3" />
            Memory Browser
          </h3>
          <div className="flex items-center justify-between rounded-md bg-background px-3 py-2 border border-border">
            <span className="text-sm font-medium">Session Insights</span>
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
              {memoryInsightCount}
            </span>
          </div>
        </div>
      )}

      {currentSessionId && (
        <RelatedSessions sessionId={currentSessionId} />
      )}
    </div>
  );
}
