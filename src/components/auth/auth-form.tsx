'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/store/auth';

interface AuthFormProps {
  onSuccess?: () => void;
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setUser } = useAuthStore();

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register state
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password. Please check your credentials.');
      } else if (result?.ok) {
        // Successfully authenticated — immediately set user in Zustand
        // so page.tsx transitions to workspace without waiting for useSession refetch
        setUser({
          id: '', // Will be properly filled when useSession refetches
          email: loginEmail,
          name: null,
        });
        onSuccess?.();
      } else {
        // signIn returned neither error nor ok — unexpected state
        setError('Login failed. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerEmail,
          password: registerPassword,
          name: registerName,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error);
        return;
      }

      // Auto-login after registration
      const result = await signIn('credentials', {
        email: registerEmail,
        password: registerPassword,
        redirect: false,
      });

      if (result?.error) {
        setError('Registration succeeded but login failed. Please try logging in.');
        setActiveTab('login');
      } else {
        // Immediately set user in Zustand so page.tsx transitions to workspace
        setUser({
          id: data.data.id || '',
          email: registerEmail,
          name: registerName || null,
        });
        onSuccess?.();
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 p-4 sm:p-6 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[420px] sm:max-w-[460px] md:max-w-[520px] lg:max-w-[560px]"
      >
        {/* Logo / Brand */}
        <div className="text-center mb-8 md:mb-10">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring' }}
            className="inline-flex items-center justify-center w-16 h-16 md:w-18 md:h-18 rounded-2xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 mb-4"
          >
            <ArrowRight className="w-8 h-8 md:w-9 md:h-9 rotate-[-45deg]" />
          </motion.div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Unified Workspace</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">Drive + Notes + Calculator</p>
        </div>

        <Card className="shadow-xl border-neutral-200 dark:border-neutral-800 rounded-xl md:rounded-2xl">
          <CardHeader className="pb-4 md:pb-6 px-6 md:px-8 pt-6 md:pt-8">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'register')}>
              <TabsList className="grid w-full grid-cols-2 h-11 md:h-12">
                <TabsTrigger value="login" className="text-sm md:text-base">Sign In</TabsTrigger>
                <TabsTrigger value="register" className="text-sm md:text-base">Register</TabsTrigger>
              </TabsList>

              <AnimatePresence mode="wait">
                {activeTab === 'login' ? (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <TabsContent value="login" className="mt-0">
                      <CardTitle className="text-lg md:text-xl">Welcome back</CardTitle>
                      <CardDescription className="text-sm md:text-base">Sign in to access your workspace</CardDescription>
                    </TabsContent>
                  </motion.div>
                ) : (
                  <motion.div
                    key="register"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <TabsContent value="register" className="mt-0">
                      <CardTitle className="text-lg md:text-xl">Create account</CardTitle>
                      <CardDescription className="text-sm md:text-base">Get started with your workspace</CardDescription>
                    </TabsContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Tabs>
          </CardHeader>

          <CardContent className="px-6 md:px-8 pb-6 md:pb-8">
            <AnimatePresence mode="wait">
              {activeTab === 'login' ? (
                <motion.form
                  key="login-form"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleLogin}
                  className="space-y-4 md:space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm md:text-base">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="pl-10 h-11 md:h-12 text-sm md:text-base"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm md:text-base">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="Enter your password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="pl-10 h-11 md:h-12 text-sm md:text-base"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-destructive text-center"
                    >
                      {error}
                    </motion.p>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 md:h-12 text-sm md:text-base"
                    disabled={isLoading}
                    size="lg"
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                    ) : null}
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </motion.form>
              ) : (
                <motion.form
                  key="register-form"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleRegister}
                  className="space-y-4 md:space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="register-name" className="text-sm md:text-base">Name (optional)</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                      <Input
                        id="register-name"
                        type="text"
                        placeholder="Your name"
                        value={registerName}
                        onChange={(e) => setRegisterName(e.target.value)}
                        className="pl-10 h-11 md:h-12 text-sm md:text-base"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-sm md:text-base">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="you@example.com"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        className="pl-10 h-11 md:h-12 text-sm md:text-base"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-sm md:text-base">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="Min. 6 characters"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        className="pl-10 h-11 md:h-12 text-sm md:text-base"
                        disabled={isLoading}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-destructive text-center"
                    >
                      {error}
                    </motion.p>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 md:h-12 text-sm md:text-base"
                    disabled={isLoading}
                    size="lg"
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                    ) : null}
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* Sticky footer for auth page */}
      <footer className="mt-auto pt-8 pb-4 text-center text-sm text-muted-foreground">
        <p>Unified Workspace &copy; 2024 — Drive + Notes + Calculator</p>
      </footer>
    </div>
  );
}
