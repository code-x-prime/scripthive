function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text.trim());
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/\s on\w+="[^"]*"/gi, "")
    .replace(/\s on\w+='[^']*'/gi, "");
}

type RichTextContentProps = {
  html?: string | null;
  className?: string;
};

/** Renders stored abstract/HTML from the editor; plain text is shown as-is. */
export function RichTextContent({ html, className = "" }: RichTextContentProps) {
  const raw = (html ?? "").trim();
  if (!raw) {
    return <p className="text-sm text-gray-400">—</p>;
  }

  if (looksLikeHtml(raw)) {
    return (
      <div
        className={`prose prose-sm max-w-none text-gray-800 prose-p:my-2 prose-headings:text-gray-900 ${className}`}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(raw) }}
      />
    );
  }

  return <p className={`whitespace-pre-wrap text-sm leading-relaxed text-gray-800 ${className}`}>{raw}</p>;
}
