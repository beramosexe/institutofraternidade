import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Lock, Globe, Star, Headphones, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ACCESS_LEVEL_LABELS, REVIEW_STATUS_LABELS } from "@/lib/permissions";

export type AudioCardData = {
  id: string;
  title: string;
  message_source: string | null;
  audio_type: "canalizacao" | "outro";
  access_level: "public" | "associates" | "work_participants" | "attendees_only";
  recorded_at: string | null;
  status: string;
  summary?: string | null;
  keywords?: string[] | null;
  play_count?: number | null;
  is_featured?: boolean | null;
  duration_seconds?: number | null;
  work_id: string | null;
  works?: { name: string; color?: string | null } | null;
  review_status?: "unreviewed" | "in_review" | "reviewed" | null;
};

const DEFAULT_COLOR = "hsl(var(--brand))";

export function formatDuration(sec?: number | null) {
  if (!sec || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}min`;
  return `${m}min ${String(s).padStart(2, "0")}s`;
}

export function AudioCard({ audio, onKeyword }: { audio: AudioCardData; onKeyword?: (k: string) => void }) {
  const color = audio.works?.color || DEFAULT_COLOR;
  const restricted = audio.access_level !== "public";
  const duration = formatDuration(audio.duration_seconds);

  return (
    <Card
      className="relative overflow-hidden transition-colors hover:bg-accent/30"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <Link to="/app/audios/$id" params={{ id: audio.id }} className="block p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {audio.is_featured && (
                <Badge className="gap-1 bg-gold/15 text-foreground hover:bg-gold/15">
                  <Star className="h-3 w-3" /> Destaque
                </Badge>
              )}
              <Badge
                variant="outline"
                className="gap-1"
                style={{ borderColor: color, color }}
              >
                {audio.works?.name ?? (audio.audio_type === "canalizacao" ? "Canalização" : "Áudio")}
              </Badge>
            </div>

            <h3 className="mt-2 font-display text-xl text-foreground">{audio.title}</h3>

            {audio.message_source && (
              <p className="mt-1 text-sm text-brand">{audio.message_source}</p>
            )}

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {audio.recorded_at && (
                <span>{format(new Date(`${audio.recorded_at}T12:00:00`), "d 'de' MMM 'de' yyyy", { locale: ptBR })}</span>
              )}
              {duration && <span className="flex items-center gap-1"><Headphones className="h-3 w-3" />{duration}</span>}
              {(audio.play_count ?? 0) > 0 && (
                <span className="flex items-center gap-1"><PlayCircle className="h-3 w-3" />{audio.play_count} reproduções</span>
              )}
            </div>

            {audio.summary && (
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {audio.summary}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge variant={restricted ? "secondary" : "outline"} className="gap-1">
              {restricted ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
              {ACCESS_LEVEL_LABELS[audio.access_level]}
            </Badge>
            {audio.status !== "ready" && (
              <Badge variant="outline">
                {audio.status === "transcribing" ? "Transcrevendo…" : audio.status === "error" ? "Erro" : audio.status}
              </Badge>
            )}
            {audio.review_status && audio.review_status !== "reviewed" && (
              <Badge variant="outline" className="border-gold/40 bg-gold/10 text-foreground">
                {REVIEW_STATUS_LABELS[audio.review_status]}
              </Badge>
            )}
          </div>
        </div>
      </Link>

      {audio.keywords && audio.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-4">
          {audio.keywords.slice(0, 8).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onKeyword?.(k)}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand"
            >
              {k}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
