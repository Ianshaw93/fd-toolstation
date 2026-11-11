// Imported (directory) address lines only: every comma starts a new line. Text the user types
// is never split. Parts keep the source spelling; only surrounding spaces and empty parts go.

export function splitAddressLines(lines: readonly string[]): string[] {
  return lines
    .flatMap((line) => line.split(','))
    .map((part) => part.trim())
    .filter((part) => part !== '');
}
