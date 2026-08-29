/** Sugestão de título para canalizações, a partir dos metadados já conhecidos. */
export function suggestAudioTitle(input: {
  audioType?: "canalizacao" | "outro";
  entityName?: string | null;
  workName?: string | null;
  recordedAt?: string | null;
}): string {
  const parts: string[] = [];
  parts.push(input.audioType === "outro" ? "Áudio" : "Canalização");
  if (input.entityName) parts.push(input.entityName);
  if (input.workName) parts.push(input.workName);
  if (input.recordedAt) {
    const d = new Date(`${input.recordedAt}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      parts.push(d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }));
    }
  }
  return parts.join(" — ");
}
