// Suggested Word filename for a fee proposal linked to a Synergy project:
// `<job number> <project name> Fire Dynamics Group Fee Proposal <DD-MM-YY>`.
// The job number is the directory row's numberFormatted (leading zeros kept). The project
// name is that row's name, not the Project Name box, which the user can edit. The date is
// today's date in Europe/London. Office.js cannot rename a saved file; this string is what
// we put in the document Title (Save As suggestion) and what the pane offers to copy.

const PHRASE = 'Fire Dynamics Group Fee Proposal';

// Windows filenames forbid these, plus ASCII control characters. Quotes are the ASCII
// double quote. Ampersands, apostrophes, and accents are allowed and kept.
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

export function sanitizeFilenamePart(value: string | null | undefined): string {
  return (value ?? '').replace(INVALID_FILENAME_CHARS, ' ').replace(/\s+/g, ' ').trim();
}

/** DD-MM-YY in Europe/London, so a late UTC evening in summer is the next London morning. */
export function formatLondonDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const year = value('year').slice(-2).padStart(2, '0');
  return `${value('day').padStart(2, '0')}-${value('month').padStart(2, '0')}-${year}`;
}

export function buildFeeProposalFilename(input: {
  numberFormatted?: string | null;
  projectName?: string | null;
  now?: Date;
}): string {
  const number = sanitizeFilenamePart(input.numberFormatted);
  const name = sanitizeFilenamePart(input.projectName);
  const date = formatLondonDate(input.now ?? new Date());
  return [number, name, PHRASE, date].filter((part) => part.length > 0).join(' ');
}
