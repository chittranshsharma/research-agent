'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchBarProps {
  initialValue?: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchBar({
  initialValue = '',
  placeholder = 'What do you want to research?',
  className = '',
  autoFocus = false,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsNavigating(true);
    // Navigate to a new research session with the query as a URL parameter
    // We encode the query to handle special characters
    router.push(`/research/new?topic=${encodeURIComponent(query.trim())}`);
  };

  return (
    <form onSubmit={handleSubmit} className={`relative flex w-full items-center ${className}`}>
      <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={isNavigating}
        className="h-14 w-full rounded-full border-border bg-background pl-12 pr-16 text-base shadow-sm focus-visible:ring-primary"
      />
      <Button
        type="submit"
        size="icon"
        disabled={!query.trim() || isNavigating}
        className="absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full transition-all"
      >
        {isNavigating ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Search className="h-4 w-4" />
        )}
        <span className="sr-only">Search</span>
      </Button>
    </form>
  );
}
