'use client';

import {
  AUTH_GENERIC_INVALID,
  AUTH_RESET_SENT,
  MODULE_LABELS,
  updateMeSchema,
  type AppModule,
} from '@sfcc/shared';
import {
  BellRing,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MonitorOff,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { InlineAlert } from '@/components/studio/inline-alert';
import { useAuth } from '@/contexts/auth-context';
import { avatarColor, userInitials } from '@/lib/app-nav';
import { api } from '@/services/api';
import { cn } from '@/utils/cn';
import { PasswordStrengthMeter } from '@/modules/auth/password-strength-meter';
import {
  executeLogoutAll,
  executePasswordChange,
  revalidatePasswordErrors,
  type AccountActionErrors,
  type PasswordChangeFields,
} from './account-actions';

const EMPTY_PASSWORDS: PasswordChangeFields = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

type PasswordFieldName = keyof PasswordChangeFields;

interface PasswordFieldProps {
  id: PasswordFieldName;
  label: string;
  value: string;
  visible: boolean;
  autoComplete: 'current-password' | 'new-password';
  error?: string;
  disabled: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onToggle: () => void;
}

export function PasswordField({
  id,
  label,
  value,
  visible,
  autoComplete,
  error,
  disabled,
  inputRef,
  onChange,
  onToggle,
}: PasswordFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <Lock className="size-4" aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
          minLength={8}
          maxLength={128}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            size="icon-sm"
            onClick={onToggle}
            disabled={disabled}
            aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            aria-pressed={visible}
          >
            {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function ReadOnlyDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-secondary/25 px-3 py-2.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm capitalize text-foreground">{value}</dd>
    </div>
  );
}

interface NotificationPreferences {
  emailNotifications: boolean;
  emailConfigured: boolean;
  globalEmailEnabled: boolean;
}

function EmailAlertsSection() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api<NotificationPreferences>('/notifications/preferences')
      .then((data) => {
        if (!cancelled) setPrefs(data);
      })
      .catch(() => {
        if (!cancelled) {
          setPrefs(null);
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="border-t border-border pt-5" aria-busy role="status" aria-label="Loading email alert preferences">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
    );
  }

  if (!prefs) {
    return (
      <div className="border-t border-border pt-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <BellRing className="size-4 text-primary" aria-hidden />
          Email alerts
        </h3>
        {loadFailed && (
          <div className="mt-3">
            <InlineAlert variant="warning">
              Could not load your notification preferences. Reload the page to try again.
            </InlineAlert>
          </div>
        )}
      </div>
    );
  }

  const handleToggle = async (next: boolean) => {
    setError('');
    setSaving(true);
    const previous = prefs;
    setPrefs({ ...prefs, emailNotifications: next });
    try {
      const updated = await api<NotificationPreferences>('/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ emailNotifications: next }),
      });
      setPrefs(updated);
    } catch (err) {
      setPrefs(previous);
      setError(err instanceof Error ? err.message : 'Could not save your preference.');
    } finally {
      setSaving(false);
    }
  };

  const deliveryBlocked = !prefs.emailConfigured || !prefs.globalEmailEnabled;

  return (
    <div className="border-t border-border pt-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <BellRing className="size-4 text-primary" aria-hidden />
            Email alerts
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Receive an email when your assigned work items change or your jobs finish.
          </p>
        </div>
        <Switch
          checked={prefs.emailNotifications}
          onChange={(next) => void handleToggle(next)}
          disabled={saving}
          aria-label="Toggle email alerts"
        />
      </div>
      {prefs.emailNotifications && deliveryBlocked && (
        <div className="mt-3">
          <InlineAlert variant="warning">
            {!prefs.emailConfigured
              ? 'The server has no SMTP transport configured, so no email will be sent yet.'
              : 'An administrator must also enable the email channel under Admin > Notifications.'}
          </InlineAlert>
        </div>
      )}
      {error && (
        <div className="mt-3" aria-live="assertive">
          <InlineAlert variant="error">{error}</InlineAlert>
        </div>
      )}
    </div>
  );
}

export function AccountWorkspace() {
  const {
    profile,
    user,
    updateDisplayName,
    resetPassword,
    signOut,
  } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [nameDirty, setNameDirty] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameNotice, setNameNotice] = useState('');
  const [nameWarning, setNameWarning] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const nameAlertRef = useRef<HTMLDivElement>(null);

  const [passwords, setPasswords] = useState<PasswordChangeFields>(EMPTY_PASSWORDS);
  const [passwordVisible, setPasswordVisible] = useState<Record<PasswordFieldName, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [passwordErrors, setPasswordErrors] = useState<AccountActionErrors>({
    fields: {},
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const passwordRefs = {
    currentPassword: useRef<HTMLInputElement>(null),
    newPassword: useRef<HTMLInputElement>(null),
    confirmPassword: useRef<HTMLInputElement>(null),
  };
  const passwordAlertRef = useRef<HTMLDivElement>(null);

  const [resetting, setResetting] = useState(false);
  const [resetNotice, setResetNotice] = useState('');
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    if (profile && !nameDirty && !nameSaving) setDisplayName(profile.displayName);
  }, [profile, nameDirty, nameSaving]);

  if (!profile) return null;

  const clearSecrets = () => {
    setPasswords(EMPTY_PASSWORDS);
    setPasswordVisible({
      currentPassword: false,
      newPassword: false,
      confirmPassword: false,
    });
  };

  const changePasswordField = (field: PasswordFieldName, value: string) => {
    const next = { ...passwords, [field]: value };
    setPasswords(next);
    setPasswordErrors((current) => revalidatePasswordErrors(current, next, field));
  };

  const redirectToLogin = (notice?: string) => {
    window.location.assign(notice ? `/login?notice=${notice}` : '/login');
  };

  const handleNameSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setNameError('');
    setNameNotice('');
    setNameWarning('');

    const parsed = updateMeSchema.safeParse({ displayName });
    if (!parsed.success) {
      setNameError('Enter a display name between 1 and 80 characters.');
      requestAnimationFrame(() => nameInputRef.current?.focus());
      return;
    }
    if (parsed.data.displayName === profile.displayName) {
      setDisplayName(parsed.data.displayName);
      setNameDirty(false);
      return;
    }

    setNameSaving(true);
    try {
      const updated = await updateDisplayName(parsed.data.displayName);
      if (updated) {
        setDisplayName(updated.profile.displayName);
        setNameDirty(false);
        if (updated.syncWarning) {
          setNameWarning(updated.syncWarning);
        } else {
          setNameNotice('Display name updated.');
        }
      }
    } catch (error) {
      setNameError(error instanceof Error ? error.message : AUTH_GENERIC_INVALID);
      requestAnimationFrame(() => {
        nameAlertRef.current?.focus();
        nameInputRef.current?.focus();
      });
    } finally {
      setNameSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordErrors({ fields: {} });
    setPasswordSaving(true);

    const result = await executePasswordChange(passwords, {
      request: (fields) => api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(fields),
      }),
      clearSecrets,
      signOut,
      redirect: (href) => window.location.assign(href),
    });

    if (!result.ok) {
      setPasswordErrors(result.errors);
      const firstField = ([
        'currentPassword',
        'newPassword',
        'confirmPassword',
      ] as const).find((field) => result.errors.fields[field]);
      requestAnimationFrame(() => {
        if (firstField) passwordRefs[firstField].current?.focus();
        else passwordAlertRef.current?.focus();
      });
      setPasswordSaving(false);
    }
  };

  const handleResetEmail = async () => {
    setResetting(true);
    setResetNotice('');
    try {
      setResetNotice(await resetPassword(profile.email));
    } catch {
      setResetNotice(AUTH_RESET_SENT);
    } finally {
      setResetting(false);
    }
  };

  const handleLogoutAll = async () => {
    setSessionError('');
    setLogoutAllLoading(true);
    const result = await executeLogoutAll({
      request: () => api('/auth/logout-all', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      signOut,
      redirect: (href) => window.location.assign(href),
    });
    if (!result.ok) {
      setSessionError(result.error);
      setLogoutAllLoading(false);
    }
  };

  const handleLogout = async () => {
    setSessionError('');
    setLogoutLoading(true);
    try {
      await signOut();
      redirectToLogin();
    } catch {
      setSessionError('Could not log out. Please try again.');
      setLogoutLoading(false);
    }
  };

  const effectiveModules = profile.effectiveModules ?? [];
  const displayRole = profile.role === 'admin' ? 'Administrator' : 'User';
  const status = profile.status ?? 'active';

  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Account</h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile, password, and active sessions.
          </p>
        </header>

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-start gap-4">
                <Avatar className="size-14 shrink-0">
                  <AvatarFallback
                    className={cn('text-base font-semibold text-white', avatarColor(profile.displayName))}
                  >
                    {userInitials(profile.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <UserRound className="size-5 text-primary" aria-hidden />
                    Profile
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Your name is shown throughout the command center.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={handleNameSubmit} className="space-y-3" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="account-display-name">Display name</Label>
                  <Input
                    ref={nameInputRef}
                    id="account-display-name"
                    name="displayName"
                    value={displayName}
                    onChange={(event) => {
                      setDisplayName(event.target.value);
                      setNameDirty(true);
                      setNameError('');
                      setNameNotice('');
                      setNameWarning('');
                    }}
                    autoComplete="name"
                    maxLength={80}
                    disabled={nameSaving}
                    aria-invalid={Boolean(nameError)}
                    aria-describedby={nameError ? 'display-name-error' : undefined}
                  />
                </div>
                <div
                  ref={nameAlertRef}
                  tabIndex={-1}
                  aria-live="assertive"
                  className="outline-none"
                >
                  {nameError && (
                    <InlineAlert variant="error">
                      <span id="display-name-error">{nameError}</span>
                    </InlineAlert>
                  )}
                  {nameWarning && <InlineAlert variant="warning">{nameWarning}</InlineAlert>}
                  {nameNotice && <InlineAlert variant="success">{nameNotice}</InlineAlert>}
                </div>
                <Button
                  type="submit"
                  loading={nameSaving}
                  disabled={!nameDirty || nameSaving}
                >
                  Save display name
                </Button>
              </form>

              <div className="space-y-1.5">
                <Label htmlFor="account-email">Email</Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="account-email"
                    value={profile.email || user?.email || ''}
                    readOnly
                    aria-readonly="true"
                    className="pl-9 text-muted-foreground"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
              </div>

              <dl className="grid gap-3 sm:grid-cols-2">
                <ReadOnlyDetail label="Role" value={displayRole} />
                <ReadOnlyDetail label="Status" value={status} />
                <ReadOnlyDetail label="Last activity" value={formatDate(profile.lastActiveAt)} />
                <ReadOnlyDetail label="Account created" value={formatDate(profile.createdAt)} />
              </dl>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Effective modules
                </p>
                <ul className="mt-2 flex flex-wrap gap-2" aria-label="Effective modules">
                  {effectiveModules.map((module: AppModule) => (
                    <li
                      key={module}
                      className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs text-primary"
                    >
                      {MODULE_LABELS[module]}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" aria-hidden />
                Security
              </CardTitle>
              <CardDescription>
                Change your password or end sessions on other devices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handlePasswordSubmit} className="space-y-3" noValidate>
                <PasswordField
                  id="currentPassword"
                  label="Current password"
                  value={passwords.currentPassword}
                  visible={passwordVisible.currentPassword}
                  autoComplete="current-password"
                  error={passwordErrors.fields.currentPassword}
                  disabled={passwordSaving}
                  inputRef={passwordRefs.currentPassword}
                  onChange={(value) => changePasswordField('currentPassword', value)}
                  onToggle={() => setPasswordVisible((current) => ({
                    ...current,
                    currentPassword: !current.currentPassword,
                  }))}
                />
                <PasswordField
                  id="newPassword"
                  label="New password"
                  value={passwords.newPassword}
                  visible={passwordVisible.newPassword}
                  autoComplete="new-password"
                  error={passwordErrors.fields.newPassword}
                  disabled={passwordSaving}
                  inputRef={passwordRefs.newPassword}
                  onChange={(value) => changePasswordField('newPassword', value)}
                  onToggle={() => setPasswordVisible((current) => ({
                    ...current,
                    newPassword: !current.newPassword,
                  }))}
                />
                <PasswordStrengthMeter password={passwords.newPassword} />
                <PasswordField
                  id="confirmPassword"
                  label="Confirm new password"
                  value={passwords.confirmPassword}
                  visible={passwordVisible.confirmPassword}
                  autoComplete="new-password"
                  error={passwordErrors.fields.confirmPassword}
                  disabled={passwordSaving}
                  inputRef={passwordRefs.confirmPassword}
                  onChange={(value) => changePasswordField('confirmPassword', value)}
                  onToggle={() => setPasswordVisible((current) => ({
                    ...current,
                    confirmPassword: !current.confirmPassword,
                  }))}
                />

                <div
                  ref={passwordAlertRef}
                  tabIndex={-1}
                  aria-live="assertive"
                  className="outline-none"
                >
                  {passwordErrors.page && (
                    <InlineAlert variant="error">{passwordErrors.page}</InlineAlert>
                  )}
                </div>
                <Button type="submit" loading={passwordSaving}>
                  <KeyRound aria-hidden />
                  Change password
                </Button>
              </form>

              <div className="border-t border-border pt-5">
                <h3 className="text-sm font-semibold">Password reset email</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Send the standard reset link to your account email.
                </p>
                {resetNotice && (
                  <div className="mt-3" aria-live="polite">
                    <InlineAlert variant="success">{resetNotice}</InlineAlert>
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  loading={resetting}
                  onClick={() => void handleResetEmail()}
                >
                  <Mail aria-hidden />
                  Send reset email
                </Button>
              </div>

              <EmailAlertsSection />

              <div className="border-t border-border pt-5">
                <h3 className="text-sm font-semibold">Sessions</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sign out everywhere, or end only this session.
                </p>
                {sessionError && (
                  <div className="mt-3" aria-live="assertive">
                    <InlineAlert variant="error">{sessionError}</InlineAlert>
                  </div>
                )}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    loading={logoutAllLoading}
                    disabled={logoutLoading}
                    onClick={() => void handleLogoutAll()}
                  >
                    <MonitorOff aria-hidden />
                    Log out all devices
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    loading={logoutLoading}
                    disabled={logoutAllLoading}
                    onClick={() => void handleLogout()}
                  >
                    <LogOut aria-hidden />
                    Log out
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
