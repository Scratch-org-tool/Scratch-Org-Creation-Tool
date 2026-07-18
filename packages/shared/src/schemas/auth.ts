import { z } from 'zod';
import { APP_MODULES } from '../auth.js';
import { isDisplayNameValid, sanitizeDisplayName } from '../sanitize.js';
import {
  AUTH_PASSWORD_TOO_WEAK,
  MIN_SIGNUP_PASSWORD_SCORE,
  scorePassword,
} from '../password-strength.js';

export const AUTH_GENERIC_INVALID =
  'Unable to process your request. Please check your input and try again.';
export const AUTH_LOGIN_FAILED = 'Incorrect email or password';
export const AUTH_RESET_SENT = "If that email is registered, you'll receive a reset link";
export const AUTH_SIGNUP_FAILED = 'Unable to create account. Please try again or sign in.';
export const AUTH_EMAIL_EXISTS = 'An account with this email already exists. Please sign in instead.';
export const AUTH_UNAVAILABLE = 'Unable to sign in right now. Please try again later.';
export const AUTH_PASSWORD_MISMATCH = 'Passwords do not match';
export const AUTH_PASSWORD_SAME = 'New password must be different from current password';
export const AUTH_ACCOUNT_ACTION_FAILED =
  'Unable to complete this account request. Please try again.';
export const AUTH_RATE_LIMITED_CODE = 'AUTH_RATE_LIMITED';
export const AUTH_PASSWORD_CHANGED =
  'Password changed. Sign in again on all devices.';
export const AUTH_SESSIONS_REVOKED = 'Signed out from all devices.';
export const AUTH_ACCESS_SELF_FORBIDDEN =
  'You cannot change your own access here. Ask another administrator to make this change.';
export const AUTH_ACCESS_LAST_ADMIN =
  'At least one active administrator must remain. Assign another admin before changing this one.';
export const AUTH_USER_NOT_FOUND = 'User not found.';

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

const passwordSchema = z.string().min(8).max(128);
const signupPasswordSchema = passwordSchema.refine(
  (password) => scorePassword(password).score >= MIN_SIGNUP_PASSWORD_SCORE,
  { message: AUTH_PASSWORD_TOO_WEAK },
);

const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .transform(sanitizeDisplayName)
  .refine((value) => value.length >= 1 && value.length <= 80 && isDisplayNameValid(value), {
    message: 'invalid',
  });

const adminBootstrapTokenSchema = z.string().max(128).optional();
/** Derived from APP_MODULES so newly added modules are grantable automatically. */
const appModuleSchema = z.enum(APP_MODULES);

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  adminBootstrapToken: adminBootstrapTokenSchema,
});

export const signupSchema = loginSchema
  .extend({
    password: signupPasswordSchema,
    displayName: displayNameSchema,
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: AUTH_PASSWORD_MISMATCH,
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const registerBodySchema = z.object({
  displayName: displayNameSchema,
  adminBootstrapToken: adminBootstrapTokenSchema,
});

/** Self-service profile updates intentionally expose no privilege-bearing fields. */
export const updateMeSchema = z
  .object({
    displayName: displayNameSchema,
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: passwordSchema,
    newPassword: signupPasswordSchema,
    confirmPassword: passwordSchema,
  })
  .strict()
  .superRefine((data, context) => {
    if (data.newPassword !== data.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: AUTH_PASSWORD_MISMATCH,
        path: ['confirmPassword'],
      });
    }
    if (data.currentPassword === data.newPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: AUTH_PASSWORD_SAME,
        path: ['newPassword'],
      });
    }
  });

export const logoutAllSchema = z.preprocess(
  (value) => value === undefined ? {} : value,
  z.object({}).strict(),
);

export const meResponseSchema = z.object({
  id: z.string(),
  email: emailSchema,
  displayName: z.string(),
  role: z.enum(['admin', 'user']),
  grantedModules: z.array(appModuleSchema),
  status: z.enum(['active', 'inactive']).optional(),
  lastActiveAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  effectiveModules: z.array(appModuleSchema),
});

export const claimAdminSchema = z.object({
  adminBootstrapToken: z.string().max(128),
});

export const updateUserAccessSchema = z.object({
  role: z.enum(['admin', 'user']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  // Use the canonical module list so every grantable module (incl. `defects`)
  // stays in sync with APP_MODULES instead of a drifting hand-written subset.
  grantedModules: z.array(appModuleSchema).max(20).optional(),
});

export type UpdateUserAccessInput = z.infer<typeof updateUserAccessSchema>;

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type RegisterBodyInput = z.infer<typeof registerBodySchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type LogoutAllInput = z.infer<typeof logoutAllSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;

export function parseLoginInput(body: unknown) {
  return loginSchema.safeParse(body);
}

export function parseSignupInput(body: unknown) {
  return signupSchema.safeParse(body);
}

export function parseForgotPasswordInput(body: unknown) {
  return forgotPasswordSchema.safeParse(body);
}

export function parseRegisterBody(body: unknown) {
  return registerBodySchema.safeParse(body);
}

export function parseUpdateMeInput(body: unknown) {
  return updateMeSchema.safeParse(body);
}

export function parseChangePasswordInput(body: unknown) {
  return changePasswordSchema.safeParse(body);
}

export function parseLogoutAllInput(body: unknown) {
  return logoutAllSchema.safeParse(body);
}
