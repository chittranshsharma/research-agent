'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, ExternalLink, Brain, Loader2 } from 'lucide-react';
import { searchMemory } from '@/lib/api';
import { MemoryItem } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

function SkeletonCard() {
  return (
    <Card className="bg-card/30 border-border animate-pulse">
      <CardContent className="p-5 space-y-3">
        <div className="h-4 bg-muted/60 rounded w-full" />
        <div className="h-4 bg-muted/60 rounded w-5/6" />
        <div className="h-3 bg-muted/40 rounded w-1/3 mt-4" />
      </CardContent>
    </Card>
  );
}

export default function MemorySearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await searchMemory(q.trim(), 10);
      setResults(data.results);
      setSearched(true);
    } catch {
      setError('Search failed. Make sure you have run at least one research session.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce 500 ms
  useEffect(() => {
    const timer = setTimeout(() => {
      doSearch(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  return (
    <div className="container mx-auto py-10 px-4 md:px-8 max-w-3xl flex-1 flex flex-col">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3 mb-2">
          <Brain className="h-8 w-8 text-primary" />
          Search Memory
        </h1>
        <p className="text-muted-foreground">
          Semantically search across every insight your Research Agent has ever stored.
        </p>
      </div>

      {/* Search input */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          id="memory-search-input"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your research memory..."
          className="h-14 pl-12 pr-4 text-base rounded-full border-border bg-background shadow-sm focus-visible:ring-primary"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive mb-6">{error}</p>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : searched && results.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 rounded-md border border-dashed border-border bg-muted/10 text-center">
          <Brain className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">No matching insights found.</p>
          <p className="text-muted-foreground text-xs mt-1">Try a different search term.</p>
        </div>
      ) : !searched && !query ? (
        <div className="flex flex-col items-center justify-center h-48 rounded-md border border-dashed border-border bg-muted/10 text-center">
          <Brain className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">Start researching to build your memory.</p>
          <p className="text-muted-foreground text-xs mt-1">Type above to search across all past insights.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {results.length > 0 && (
            <p className="text-xs text-muted-foreground mb-2">
              {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
            </p>
          )}
          {results.map((item, i) => (
            <Card key={i} className="bg-card/30 border-border hover:border-primary/40 transition-colors">
              <CardContent className="p-5">
                {/* Insight text */}
                <p className="text-gray-200 text-sm leading-relaxed mb-4">{item.insight}</p>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/50">
                  <div className="flex flex-col gap-1 min-w-0">
                    {/* Source link */}
                    {item.source_url && (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors truncate max-w-xs"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{item.source_title || item.source_url}</span>
                      </a>
                    )}
                    {/* Topic badge */}
                    {item.topic && (
                      <span className="text-xs text-muted-foreground">
                        Topic: <span className="text-primary/80">{item.topic}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Similarity score */}
                    {item.similarity !== undefined && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                        {Math.round(item.similarity * 100)}% match
                      </span>
                    )}
                    {/* Date */}
                    {item.created_at && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
