import { Check, X } from "lucide-react";
import { getPasswordRuleResults } from "@/utils/passwordPolicy";

interface PasswordRequirementsProps {
  password: string;
  showWhenEmpty?: boolean;
}

export function PasswordRequirements({ password, showWhenEmpty = false }: PasswordRequirementsProps) {
  if (!password && !showWhenEmpty) return null;

  const results = getPasswordRuleResults(password);
  const allPassed = results.every((r) => r.passed);

  return (
    <div
      className={`mt-2 rounded-lg border px-3 py-2.5 text-xs ${
        password && allPassed
          ? "border-green-200 bg-green-50"
          : "border-gray-200 bg-gray-50"
      }`}
      aria-live="polite"
    >
      <p className="mb-1.5 font-medium text-gray-700">Password must have:</p>
      <ul className="space-y-1">
        {results.map((rule) => (
          <li key={rule.id} className="flex items-start gap-2">
            {rule.passed ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" aria-hidden />
            ) : (
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
            )}
            <span className={rule.passed ? "text-green-800" : "text-gray-600"}>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
