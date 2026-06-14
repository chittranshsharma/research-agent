'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { cn } from '@/lib/utils';
import { LogOut, User } from 'lucide-react';

export function Header() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const links = [
    { href: '/', label: 'Research' },
    { href: '/memory', label: 'Memory' },
    { href: '/memory/search', label: 'Search Memory' },
    { href: '/sessions', label: 'Sessions' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center px-4 md:px-8 mx-auto justify-between">
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl tracking-tight text-white">Mnemox</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'transition-colors hover:text-foreground',
                  pathname === link.href ? 'text-white font-semibold' : 'text-muted-foreground'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* User profile & sign out */}
        <div className="flex items-center space-x-4">
          <nav className="flex md:hidden items-center space-x-4 text-xs font-medium mr-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'transition-colors hover:text-foreground',
                  pathname === link.href ? 'text-white' : 'text-muted-foreground'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          
          {user && (
            <div className="flex items-center gap-3 border-l border-border pl-4">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 py-1 px-2.5 rounded-full border border-border">
                <User className="h-3 w-3" />
                <span className="max-w-[150px] truncate">{user.email}</span>
              </div>
              <button
                onClick={signOut}
                className="text-muted-foreground hover:text-destructive text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
