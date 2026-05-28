const RULES = [
  { test: (p: string) => p.length >= 8, message: "at least 8 characters" },
  { test: (p: string) => /[a-z]/.test(p), message: "one lowercase letter (a–z)" },
  { test: (p: string) => /[A-Z]/.test(p), message: "one uppercase letter (A–Z)" },
  { test: (p: string) => /[0-9]/.test(p), message: "one number (0–9)" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), message: "one special character (!@#$%…)" }
] as const;

export function validateAuthorPassword(password: string): { valid: true } | { valid: false; message: string } {
  const missing = RULES.filter((rule) => !rule.test(password)).map((r) => r.message);
  if (missing.length === 0) return { valid: true };
  return {
    valid: false,
    message: `Password must include ${missing.join(", ")}.`
  };
}
