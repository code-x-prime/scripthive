export type PasswordRuleId = "length" | "lower" | "upper" | "digit" | "special";

export interface PasswordRule {
  id: PasswordRuleId;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "lower", label: "One lowercase letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { id: "upper", label: "One uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { id: "digit", label: "One number (0–9)", test: (p) => /[0-9]/.test(p) },
  {
    id: "special",
    label: "One special character (! @ # $ % …)",
    test: (p) => /[^A-Za-z0-9]/.test(p)
  }
];

export function getPasswordRuleResults(password: string): { id: PasswordRuleId; label: string; passed: boolean }[] {
  return PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    passed: rule.test(password)
  }));
}

export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export function passwordValidationMessage(password: string): string | null {
  const failed = PASSWORD_RULES.filter((rule) => !rule.test(password));
  if (failed.length === 0) return null;
  return `Password must include: ${failed.map((r) => r.label.toLowerCase()).join(", ")}.`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
