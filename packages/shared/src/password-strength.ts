export const AUTH_PASSWORD_TOO_WEAK =
  'Choose a stronger password (at least Fair strength).';

export const MIN_SIGNUP_PASSWORD_SCORE = 2;

export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4;

export type PasswordStrengthLabel = 'Weak' | 'Fair' | 'Good' | 'Strong';

export interface PasswordStrengthCheck {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordStrengthResult {
  score: PasswordStrengthScore;
  label: PasswordStrengthLabel | null;
  percent: number;
  checks: PasswordStrengthCheck[];
}

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password12',
  'password123',
  '12345678',
  '123456789',
  'qwerty123',
  'admin123',
  'welcome1',
  'letmein1',
]);

const LABELS: Record<Exclude<PasswordStrengthScore, 0>, PasswordStrengthLabel> = {
  1: 'Weak',
  2: 'Fair',
  3: 'Good',
  4: 'Strong',
};

const PERCENTS: Record<PasswordStrengthScore, number> = {
  0: 0,
  1: 25,
  2: 50,
  3: 75,
  4: 100,
};

function countCharacterClasses(password: string): number {
  let count = 0;
  if (/[a-z]/.test(password)) count += 1;
  if (/[A-Z]/.test(password)) count += 1;
  if (/\d/.test(password)) count += 1;
  if (/[^a-zA-Z0-9]/.test(password)) count += 1;
  return count;
}

function buildChecks(password: string): PasswordStrengthCheck[] {
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  return [
    { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
    {
      id: 'case',
      label: 'Upper and lower case',
      met: hasLower && hasUpper,
    },
    { id: 'number', label: 'A number', met: hasDigit },
    { id: 'symbol', label: 'A symbol', met: hasSymbol },
  ];
}

function computeScore(password: string, classCount: number): PasswordStrengthScore {
  const len = password.length;

  if (len < 8 || classCount < 2) return 1;
  if (len >= 12 && classCount >= 4) return 4;
  if (len >= 10 && classCount >= 3) return 3;
  return 2;
}

export function scorePassword(password: string): PasswordStrengthResult {
  const checks = buildChecks(password);

  if (!password) {
    return { score: 0, label: null, percent: 0, checks };
  }

  const classCount = countCharacterClasses(password);
  let score = computeScore(password, classCount);

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    score = 1;
  }

  return {
    score,
    label: score === 0 ? null : LABELS[score],
    percent: PERCENTS[score],
    checks,
  };
}
