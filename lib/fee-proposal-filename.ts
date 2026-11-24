// Suggested Word filename for a fee proposal:
// `<job number>-Fire Dynamics-Fee-<project name>-Rev00` (e.g. `0715-Fire Dynamics-Fee-DIRFT III DC762-Rev00`).
// The job number is the directory row's numberFormatted (leading zeros kept). The project
// name is that row's name, not the Project Name box, which the user can edit.

const PHRASE = 'Fire Dynamics-Fee';

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
  revision?: number | null;
  now?: Date;
}): string {
  const number = sanitizeFilenamePart(input.numberFormatted);
  const name = sanitizeFilenamePart(input.projectName);
  const revNum = typeof input.revision === 'number' && input.revision >= 0 ? Math.floor(input.revision) : 0;
  const rev = `Rev${String(revNum).padStart(2, '0')}`;
  return [number, PHRASE, name, rev].filter((part) => part.length > 0).join('-');
}
