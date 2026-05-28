import { AlertCircle } from "lucide-react";

interface AuthAlertProps {
  message: string;
  title?: string;
}

export function AuthAlert({ message, title = "Please fix the following" }: AuthAlertProps) {
  if (!message.trim()) return null;

  const lines = message
    .split(/\n|(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div
      role="alert"
      className="mb-4 flex gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800"
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
      <div>
        <p className="font-medium text-red-900">{title}</p>
        {lines.length > 1 ? (
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-red-800">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-0.5">{message}</p>
        )}
      </div>
    </div>
  );
}
