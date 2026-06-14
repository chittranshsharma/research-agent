'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, Lock, Mail, UserPlus, LogIn, AlertCircle } from 'lucide-react';

export function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        if (data?.user && data.session === null) {
          setInfo('Registration successful! Please check your email for the confirmation link.');
        } else {
          setInfo('Account created and logged in successfully!');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred during authentication.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#090a0f] p-4 relative overflow-hidden font-sans">
      {/* Autofill and Input Focus overrides to prevent browsers from turning inputs white */}
      <style jsx global>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #121318 inset !important;
          -webkit-text-fill-color: #f4f4f5 !important;
          transition: background-color 5000s ease-in-out 0s;
          caret-color: #ffffff;
        }
        input {
          background-color: #121318 !important;
          color: #ffffff !important;
        }
        input::placeholder {
          color: #71717a !important;
        }
      `}</style>

      {/* Decorative blurred background shapes */}
      <div className="absolute top-1/4 left-1/3 -z-10 h-[350px] w-[350px] rounded-full bg-violet-600/10 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/3 -z-10 h-[350px] w-[350px] rounded-full bg-blue-500/10 blur-[120px]" />

      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-violet-600/15 border border-violet-500/30 text-violet-400 font-bold text-2xl mb-4 shadow-inner shadow-violet-500/10">
            M
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2 bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Mnemox
          </h1>
          <p className="text-zinc-400 text-sm">
            AI-powered research with persistent memory.
          </p>
        </div>

        <Card className="border border-white/5 bg-[#0f1015]/60 backdrop-blur-2xl shadow-2xl relative rounded-2xl overflow-hidden">
          <CardHeader className="space-y-2 pt-8 pb-6">
            <CardTitle className="text-2xl font-bold text-center text-white tracking-tight">
              {isSignUp ? 'Create an Account' : 'Welcome Back'}
            </CardTitle>
            <CardDescription className="text-center text-sm text-zinc-400">
              {isSignUp
                ? 'Sign up to start saving and querying your research memory'
                : 'Sign in to access your research sessions'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider" htmlFor="email">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-zinc-400" />
                  <input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 bg-[#121318] border border-white/5 rounded-xl pl-11 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all duration-200"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-zinc-400" />
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 bg-[#121318] border border-white/5 rounded-xl pl-11 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all duration-200"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-950/20 text-red-400 text-xs p-3.5 rounded-xl border border-red-500/10">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {info && (
                <div className="flex items-start gap-2.5 bg-emerald-950/20 text-emerald-400 text-xs p-3.5 rounded-xl border border-emerald-500/10">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{info}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-violet-600/20 active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isSignUp ? (
                  <>
                    <UserPlus className="h-4 w-4" /> Sign Up
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" /> Sign In
                  </>
                )}
              </button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2 pb-8 px-6">
            <div className="text-xs text-center text-zinc-400">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                  setInfo(null);
                }}
                className="text-violet-400 hover:text-violet-300 hover:underline font-semibold transition-colors"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
