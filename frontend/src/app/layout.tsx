import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Mnemox - Research Agent',
  description: 'AI-powered research with persistent memory',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased text-foreground flex flex-col',
          inter.variable
        )}
      >
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center px-4 md:px-8 mx-auto">
            <div className="mr-4 flex">
              <Link href="/" className="mr-6 flex items-center space-x-2">
                <span className="font-bold text-xl tracking-tight text-white">Mnemox</span>
              </Link>
            </div>
            <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
              <nav className="flex items-center space-x-6 text-sm font-medium text-muted-foreground">
                <Link href="/" className="transition-colors hover:text-foreground">
                  Research
                </Link>
                <Link href="/memory" className="transition-colors hover:text-foreground">
                  Memory
                </Link>
                <Link href="/memory/search" className="transition-colors hover:text-foreground">
                  Search Memory
                </Link>
                <Link href="/sessions" className="transition-colors hover:text-foreground">
                  Sessions
                </Link>
              </nav>
            </div>
          </div>
        </header>
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
