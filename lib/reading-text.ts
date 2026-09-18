export function splitReadingParagraphs(value: string): string[] {
  return value
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, 4);
}
