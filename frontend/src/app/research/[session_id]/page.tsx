'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Loader2, Send, BookOpen, Share2 } from 'lucide-react';
import { startResearch, getSessions, getSessionMemory, askQuestion, getResearchSession } from '@/lib/api';
import { ResearchResponse, SessionSummary, AskResponse } from '@/lib/types';
import { Sidebar } from '@/components/Sidebar';
import { ReportViewer } from '@/components/ReportViewer';
import { KnowledgeGraph } from '@/components/KnowledgeGraph';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ResearchView() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawSessionId = params.session_id as string;
  const isNew = rawSessionId === 'new';
  const topicParam = searchParams.get('topic');

  const [researchData, setResearchData] = useState<ResearchResponse | null>(null);
  const [loading, setLoading] = useState(isNew);
  const [error, setError] = useState('');
  
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [memoryCount, setMemoryCount] = useState<number>(0);

  // Follow-up chat state
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [qaHistory, setQaHistory] = useState<{q: string, a: AskResponse}[]>([]);

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        const pastSessions = await getSessions();
        setSessions(pastSessions);

        if (isNew && topicParam) {
          // Trigger new research
          const res = await startResearch(topicParam);
          setResearchData(res);
          // Refresh sessions list
          const updatedSessions = await getSessions();
          setSessions(updatedSessions);
          // Push actual URL without full reload
          window.history.replaceState({}, '', `/research/${res.session_id}`);
        } else if (!isNew) {
          const sessionData = await getResearchSession(rawSessionId);
          setResearchData(sessionData);
        }
      } catch (err: unknown) {
        setError((err as Error).message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [isNew, topicParam, rawSessionId]);

  useEffect(() => {
    if (researchData?.session_id) {
      getSessionMemory(researchData.session_id).then(mem => setMemoryCount(mem.length)).catch(console.error);
    }
  }, [researchData?.session_id]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const currentQ = question;
    setQuestion('');
    setAsking(true);

    try {
      const sessionId = researchData?.session_id !== 'new' ? researchData?.session_id : undefined;
      const res = await askQuestion(currentQ, sessionId);
      setQaHistory(prev => [...prev, { q: currentQ, a: res }]);
    } catch (err) {
      console.error(err);
    } finally {
      setAsking(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold text-destructive mb-2">Error</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left Sidebar */}
      <div className="hidden md:block shrink-0">
        <Sidebar 
          sessions={sessions} 
          currentSessionId={researchData?.session_id !== 'new' ? researchData?.session_id : undefined}
          memoryInsightCount={memoryCount}
        />
      </div>

      {/* Center Panel - Main Report */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border bg-background">
        <ScrollArea className="flex-1 px-4 py-8 md:px-8 lg:px-12">
          <div className="max-w-3xl mx-auto pb-20">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <h2 className="text-xl font-semibold text-white">Researching...</h2>
                <p className="text-muted-foreground text-center max-w-sm">
                  The Research Agent is searching the web, scraping pages, extracting insights, and synthesizing a report.
                </p>
              </div>
            ) : researchData ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="mb-8">
                  <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">
                    {researchData.topic}
                  </h1>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground border-b border-border pb-6">
                    <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> Comprehensive Report</span>
                    <span className="flex items-center gap-1.5"><Share2 className="h-4 w-4" /> Share</span>
                  </div>
                </div>
                <ReportViewer content={researchData.report} />
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Follow-up, Citations, Graph */}
      <div className="hidden xl:flex w-96 flex-col bg-muted/10 shrink-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-8">
            
            {/* Follow-up Section */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Ask Follow-up
              </h3>
              <div className="bg-card/50 border border-border rounded-lg p-3 space-y-4">
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {qaHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Ask a question about this topic based on the agent&apos;s memory.</p>
                  ) : (
                    qaHistory.map((qa, i) => (
                      <div key={i} className="space-y-2 text-sm">
                        <p className="font-medium text-white">{qa.q}</p>
                        <p className="text-gray-400 bg-background/50 p-2 rounded-md border border-border">{qa.a.answer}</p>
                      </div>
                    ))
                  )}
                  {asking && (
                    <div className="flex justify-center p-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  )}
                </div>
                <form onSubmit={handleAsk} className="relative mt-2">
                  <Input 
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask anything..."
                    className="pr-10 bg-background text-sm"
                    disabled={asking || loading}
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    variant="ghost" 
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-white"
                    disabled={asking || loading || !question.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </section>

            {/* Citations Section */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Sources
              </h3>
              {loading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-12 bg-muted/50 rounded-md animate-pulse" />)}
                </div>
              ) : researchData?.citations?.length ? (
                <div className="space-y-2">
                  {researchData.citations.map((c, i) => (
                    <a 
                      key={i} 
                      href={c.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="block p-3 rounded-md border border-border bg-card/30 hover:bg-card/80 transition-colors text-sm"
                    >
                      <p className="font-medium text-white line-clamp-2 leading-tight mb-1">{c.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{new URL(c.url).hostname}</p>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No sources available.</p>
              )}
            </section>

            {/* Knowledge Graph Section */}
            <section className="pb-8">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Knowledge Graph
              </h3>
              {loading ? (
                <div className="h-[300px] w-full bg-muted/50 rounded-md animate-pulse" />
              ) : (
                <div className="h-[300px]">
                  <KnowledgeGraph 
                    entities={researchData?.entities || []} 
                    relationships={researchData?.relationships || []} 
                  />
                </div>
              )}
            </section>
            
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
