import type { Segment } from "@/components/app/SyncedTranscript";

/**
 * Some speech-to-text providers return only the full text, without per-segment
 * timestamps. In that case we split the text into sentence-sized chunks and
 * distribute them proportionally (by character count) across the real audio
 * duration, so the synced view works and a reviewer can fine-tune the times.
 */
export function segmentsFromText(text: string, duration: number): Segment[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean || !duration || !isFinite(duration)) return [];

  // Split on sentence boundaries, then group into chunks of a readable size.
  const sentences = clean.match(/[^.!?…]+[.!?…]*\s*/g) ?? [clean];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + sentence).length > 220 && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  const totalChars = chunks.reduce((sum, c) => sum + c.length, 0) || 1;
  let cursor = 0;
  return chunks.map((chunkText) => {
    const span = (chunkText.length / totalChars) * duration;
    const start = cursor;
    cursor = Math.min(duration, cursor + span);
    return { start: round(start), end: round(cursor), text: chunkText };
  });
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}
