/** Canonical public archive URL builders (lowercase journal slug). */

export const journalSlug = (journalId: string) => journalId.toLowerCase();

export const volumeIssueSlug = (volume: number, issue: number) =>
  `volume-${volume}-issue-${issue}`;

export const journalArchivePath = (journalId: string) =>
  `/journals/${journalSlug(journalId)}/archive`;

export const issueArchivePath = (journalId: string, volume: number, issue: number) =>
  `${journalArchivePath(journalId)}/${volumeIssueSlug(volume, issue)}`;

export const articleArchivePath = (
  journalId: string,
  volume: number,
  issue: number,
  articleSlug: string
) => `${issueArchivePath(journalId, volume, issue)}/${articleSlug}`;
