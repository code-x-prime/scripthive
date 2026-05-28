import { apiJson } from "./api";

export interface ArchiveJournal {
  id: string;
  slug: string;
  name: string;
  issn?: string | null;
  eIssn?: string | null;
  description?: string | null;
}

export interface ArchiveArticleSummary {
  id: string;
  title: string;
  authorName: string;
  authors?: string;
  coAuthors?: string | null;
  country?: string;
  slug: string | null;
  pages: string | null;
  pubDate?: string | null;
  pdfUrl: string | null;
  fileSizeKb?: number | null;
  doi: string | null;
  citation?: string | null;
  viewCount?: number;
  downloadCount?: number;
}

export interface ArchiveIssueSummary {
  volume: number;
  issue: number;
  year: number;
  period?: string | null;
  slug: string;
  label: string;
  headerLabel?: string;
  articleCount: number;
  articles: ArchiveArticleSummary[];
}

export interface ArchiveIndexResponse {
  journal: ArchiveJournal;
  issues: ArchiveIssueSummary[];
}

export interface ArchiveIssueResponse {
  journal: Pick<ArchiveJournal, "id" | "slug" | "name" | "issn" | "eIssn">;
  volume: number;
  issue: number;
  year: number;
  period?: string | null;
  slug: string;
  label: string;
  headerLabel?: string;
  articles: ArchiveArticleSummary[];
}

export interface ArchiveArticleResponse {
  journal: ArchiveJournal;
  volumeIssue: {
    volume: number;
    issue: number;
    year: number;
    period?: string | null;
    slug: string;
    label: string;
  } | null;
  article: ArchiveArticleSummary & { abstract?: string; keywords?: string };
}

export const archiveService = {
  getIndex: (journalSlug: string) =>
    apiJson<ArchiveIndexResponse>(`/journals/${encodeURIComponent(journalSlug)}/archive`),

  getIssue: (journalSlug: string, volumeIssueSlug: string) =>
    apiJson<ArchiveIssueResponse>(
      `/journals/${encodeURIComponent(journalSlug)}/archive/${encodeURIComponent(volumeIssueSlug)}`
    ),

  getArticle: (journalSlug: string, volumeIssueSlug: string, articleSlug: string) =>
    apiJson<ArchiveArticleResponse>(
      `/journals/${encodeURIComponent(journalSlug)}/archive/${encodeURIComponent(volumeIssueSlug)}/${encodeURIComponent(articleSlug)}`
    )
};
