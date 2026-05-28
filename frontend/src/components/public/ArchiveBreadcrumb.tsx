import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  to?: string;
}

export function ArchiveBreadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-gray-500">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1">
          {i > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" /> : null}
          {item.to ? (
            <Link to={item.to} className="hover:text-green-700">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-gray-800">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
