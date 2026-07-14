import { z } from 'zod';
import { isDisplayNameValid, sanitizeDisplayName } from '../sanitize.js';

export const AUTH_GENERIC_INVALID =
  'Unable to process your request. Please check your input and try again.';
export const AUTH_LOGIN_FAILED = 'Incorrect email or password';
export const AUTH_RESET_SENT = "If that email is registered, you'll receive a reset link";
export const AUTH_SIGNUP_FAILED = 'Unable to create account. Please try again or sign in.';
export const AUTH_EMAIL_EXISTS = 'An account with this email already exists. Please sign in instead.';
export const AUTH_UNAVAILABLE = 'Unable to sign in right now. Please try again later.';
export const AUTH_PASSWORD_MISMATCH = 'Passwords do not match';

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

const passwordSchema = z.string().min(8).max(128);

const adminBootstrapTokenSchema = z.string().max(128).optional();

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  adminBootstrapToken: adminBootstrapTokenSchema,
});

export const signupSchema = loginSchema
  .extend({
    displayName: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .transform(sanitizeDisplayName)
      .refine(isDisplayNameValid, { message: 'invalid' }),
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
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .transform(sanitizeDisplayName)
    .refine(isDisplayNameValid, { message: 'invalid' }),
  adminBootstrapToken: adminBootstrapTokenSchema,
});

export const claimAdminSchema = z.object({
  adminBootstrapToken: z.string().max(128),
});

export const updateUserAccessSchema = z.object({
  role: z.enum(['admin', 'user']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  grantedModules: z
    .array(z.enum([
      'dashboard',
      'environment',
      'data',
      'deployment',
      'org-setup',
      'provisioning',
      'monitoring',
      'copilot',
    ]))
    .max(20)
    .optional(),
});

export type UpdateUserAccessInput = z.infer<typeof updateUserAccessSchema>;

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type RegisterBodyInput = z.infer<typeof registerBodySchema>;

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
