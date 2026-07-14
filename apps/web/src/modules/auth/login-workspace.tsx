'use client';

import { AtSign, Eye, EyeOff, Lock, User } from 'lucide-react';
import { AppleIcon } from '@/components/icons/apple-icon';
import { GithubIcon } from '@/components/icons/github-icon';
import { GoogleIcon } from '@/components/icons/google-icon';
import { FloatingPaths } from '@/components/floating-paths';
import { InlineAlert } from '@/components/studio/inline-alert';
import { AppLogo } from '@/components/ui/app-logo';
import { Button } from '@/components/ui/button';
import { DevopsCloudLoader } from '@/components/ui/devops-cloud-loader';
import { Label } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { PasswordStrengthMeter } from './password-strength-meter';
import { useAuthForm, type AuthMode } from './use-auth-form';

interface LoginWorkspaceProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
}

const COPY = {
  login: {
    title: 'Sign in',
    subtitle: 'Sign in to SF DevOps Command Center',
    submit: 'Sign in',
    testimonial:
      'This platform has helped our team ship Salesforce environments faster with fewer manual steps.',
    author: 'DevOps Team',
  },
  signup: {
    title: 'Create account',
    subtitle: 'Get started with deployment automation',
    submit: 'Create account',
    testimonial:
      'From scratch org creation to data seeding — everything we need in one command center.',
    author: 'Platform Engineering',
  },
} as const;

export function LoginWorkspace({ mode, onModeChange }: LoginWorkspaceProps) {
  const isLogin = mode === 'login';
  const form = useAuthForm(mode);
  const isBusy = form.isBusy;
  const copy = COPY[mode];

  return (
    <div className="overflow-x-hidden bg-background" data-auth-page>
      {isBusy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          aria-live="polite"
          aria-busy="true"
        >
          <DevopsCloudLoader
            size="md"
            label={
              form.redirecting
                ? 'Opening Command Center…'
                : isLogin
                  ? 'Signing in…'
                  : 'Creating account…'
            }
          />
        </div>
      )}

      <main className="lg:grid lg:min-h-screen lg:grid-cols-2 lg:overflow-hidden">
        <div className="relative hidden h-full min-h-screen flex-col border-r border-border bg-secondary p-10 lg:flex">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          <div className="relative z-10 mr-auto flex items-center gap-2.5">
            <AppLogo size="sm" priority />
            <span className="text-sm font-semibold tracking-tight">SF DevOps Command Center</span>
          </div>

          <div className="relative z-10 mt-auto">
            <blockquote className="space-y-2">
              <p className="text-xl leading-relaxed">&ldquo;{copy.testimonial}&rdquo;</p>
              <footer className="font-mono text-sm font-semibold">~ {copy.author}</footer>
            </blockquote>
          </div>

          <div className="absolute inset-0">
            <FloatingPaths position={1} />
            <FloatingPaths position={-1} />
          </div>
        </div>

        <div className="relative w-full px-6 py-8 sm:px-8 lg:flex lg:min-h-screen lg:flex-col lg:justify-center lg:py-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden opacity-60 lg:block"
          >
            <div className="absolute top-0 right-0 h-[320px] w-[140px] -translate-y-[87.5%] rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--foreground)/0.06)_0%,transparent_70%)]" />
            <div className="absolute top-0 right-0 h-[320px] w-60 translate-x-[5%] -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--foreground)/0.04)_0%,transparent_80%)]" />
            <div className="absolute top-0 right-0 h-[320px] w-60 -translate-y-[87.5%] rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--foreground)/0.04)_0%,transparent_80%)]" />
          </div>

          <div className="mx-auto w-full max-w-sm space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2.5 lg:hidden">
              <AppLogo size="sm" priority />
              <span className="text-sm font-semibold">SF DevOps Command Center</span>
            </div>

            <div className="flex flex-col space-y-1">
              <h1 className="text-2xl font-bold tracking-wide">{copy.title}</h1>
              <p className="text-base text-muted-foreground">{copy.subtitle}</p>
            </div>

            <form onSubmit={form.handleSubmit} className="space-y-3 [&_input]:scroll-mt-24 [&_input]:text-base">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <AtSign className="size-4" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={(e) => form.handleEmailChange(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={isBusy}
                  />
                </InputGroup>
              </div>

              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Display name</Label>
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <User className="size-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="displayName"
                      placeholder="Your name"
                      value={form.displayName}
                      onChange={(e) => form.setDisplayName(e.target.value)}
                      required
                      autoComplete="name"
                      disabled={isBusy}
                      aria-invalid={Boolean(form.fieldErrors.displayName)}
                    />
                  </InputGroup>
                  {form.fieldErrors.displayName && (
                    <p className="text-xs text-destructive">{form.fieldErrors.displayName}</p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <Lock className="size-4" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="password"
                    type={form.showPassword ? 'text' : 'password'}
                    placeholder={isLogin ? 'Enter your password' : 'Min. 8 characters'}
                    value={form.password}
                    onChange={(e) => form.setPassword(e.target.value)}
                    required
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    disabled={isBusy}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => form.setShowPassword((v) => !v)}
                      aria-label={form.showPassword ? 'Hide password' : 'Show password'}
                      disabled={isBusy}
                    >
                      {form.showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {!isLogin && <PasswordStrengthMeter password={form.password} />}
                {form.fieldErrors.password && (
                  <p className="text-xs text-destructive">{form.fieldErrors.password}</p>
                )}
              </div>

              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <Lock className="size-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="confirmPassword"
                      type={form.showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter your password"
                      value={form.confirmPassword}
                      onChange={(e) => form.setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      disabled={isBusy}
                      aria-invalid={Boolean(form.fieldErrors.confirmPassword)}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => form.setShowConfirmPassword((v) => !v)}
                        aria-label={form.showConfirmPassword ? 'Hide password' : 'Show password'}
                        disabled={isBusy}
                      >
                        {form.showConfirmPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {form.fieldErrors.confirmPassword && (
                    <p className="text-xs text-destructive">{form.fieldErrors.confirmPassword}</p>
                  )}
                </div>
              )}

              {isLogin && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <label className="flex cursor-pointer select-none items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.rememberMe}
                      onChange={(e) => form.handleRememberChange(e.target.checked)}
                      disabled={isBusy}
                      className="h-4 w-4 rounded border-border bg-background accent-primary"
                    />
                    <span className="text-sm text-muted-foreground">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={form.handleForgotPassword}
                    disabled={isBusy || form.forgotLoading}
                    className="text-sm text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
                  >
                    {form.forgotLoading ? 'Sending…' : 'Forgot password?'}
                  </button>
                </div>
              )}

              {form.error && <InlineAlert variant="error">{form.error}</InlineAlert>}
              {form.success && <InlineAlert variant="success">{form.success}</InlineAlert>}

              <Button
                type="submit"
                disabled={isBusy || (!isLogin && form.signupPasswordTooWeak)}
                className="w-full"
              >
                {isBusy ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size="sm" />
                    {form.redirecting
                      ? 'Opening Command Center…'
                      : isLogin
                        ? 'Signing in…'
                        : 'Creating account…'}
                  </span>
                ) : (
                  copy.submit
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              {isLogin ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => onModeChange('signup')}
                    disabled={isBusy}
                    className="font-medium text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => onModeChange('login')}
                    disabled={isBusy}
                    className="font-medium text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>

            <div className="flex items-center justify-center gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0"
                tabIndex={-1}
                aria-label="Continue with Google"
                aria-hidden
              >
                <GoogleIcon className="size-5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0"
                tabIndex={-1}
                aria-label="Continue with Apple"
                aria-hidden
              >
                <AppleIcon className="size-5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0"
                tabIndex={-1}
                aria-label="Continue with GitHub"
                aria-hidden
              >
                <GithubIcon className="size-5" />
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function LoginWorkspaceLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <DevopsCloudLoader size="md" label="Loading" />
    </div>
  );
}
