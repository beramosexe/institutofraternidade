import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Lock, Star, Headphones, PlayCircle } from "lucide-react";
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

function shortDate(recordedAt: string | null) {
  if (!recordedAt) return null;
  return format(new Date(`${recordedAt}T12:00:00`), "d MMM yyyy", { locale: ptBR });
}

type Variant = "grid" | "row" | "compact";

export function AudioCard({
  audio,
  onKeyword,
  variant = "grid",
}: {
  audio: AudioCardData;
  onKeyword?: (k: string) => void;
  variant?: Variant;
}) {
  const color = audio.works?.color || DEFAULT_COLOR;
  const restricted = audio.access_level !== "public";
  const duration = formatDuration(audio.duration_seconds);
  const date = shortDate(audio.recorded_at);
  const label = audio.works?.name ?? (audio.audio_type === "canalizacao" ? "Canalização" : "Áudio");

  if (variant === "compact") {
    return (
      <Card
        className="w-[240px] shrink-0 overflow-hidden transition-colors hover:bg-accent/30 sm:w-[260px]"
        style={{ borderTop: `3px solid ${color}` }}
      >
        <Link to="/app/audios/$id" params={{ id: audio.id }} className="block p-3.5">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[11px] font-medium uppercase tracking-wide" style={{ color }}>
              {label}
            </span>
            {audio.is_featured && <Star className="h-3 w-3 shrink-0 text-gold" />}
            {restricted && <Lock className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />}
          </div>
          <h3 className="mt-1.5 line-clamp-2 font-display text-base leading-snug text-foreground">
            {audio.title}
          </h3>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            {date && <span>{date}</span>}
            {duration && (
              <span className="flex items-center gap-1">
                <Headphones className="h-3 w-3" />
                {duration}
              </span>
            )}
          </div>
        </Link>
      </Card>
    );
  }

  const isRow = variant === "row";

  return (
    <Card
      className="group relative overflow-hidden transition-colors hover:bg-accent/30"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <Link
        to="/app/audios/$id"
        params={{ id: audio.id }}
        className={isRow ? "block px-4 py-3" : "block p-4"}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[11px] font-medium uppercase tracking-wide" style={{ color }}>
                {label}
              </span>
              {audio.is_featured && <Star className="h-3 w-3 shrink-0 text-gold" />}
            </div>

            <h3
              className={[
                "mt-1 font-display leading-snug text-foreground",
                isRow ? "truncate text-lg" : "line-clamp-2 text-lg",
              ].join(" ")}
            >
              {audio.title}
            </h3>

            {audio.message_source && (
              <p className="mt-0.5 truncate text-xs text-brand">{audio.message_source}</p>
            )}

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              {date && <span>{date}</span>}
              {duration && (
                <span className="flex items-center gap-1">
                  <Headphones className="h-3 w-3" />
                  {duration}
                </span>
              )}
              {(audio.play_count ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <PlayCircle className="h-3 w-3" />
                  {audio.play_count}
                </span>
              )}
              {audio.status !== "ready" && (
                <span className="text-foreground/70">
                  {audio.status === "transcribing"
                    ? "Transcrevendo…"
                    : audio.status === "error"
                      ? "Erro"
                      : audio.status}
                </span>
              )}
              {audio.review_status && audio.review_status !== "reviewed" && (
                <span className="text-foreground/70">{REVIEW_STATUS_LABELS[audio.review_status]}</span>
              )}
            </div>

            {!isRow && audio.summary && (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {audio.summary}
              </p>
            )}
          </div>

          {restricted && (
            <span
              className="shrink-0 rounded-full bg-muted p-1.5 text-muted-foreground"
              title={ACCESS_LEVEL_LABELS[audio.access_level]}
            >
              <Lock className="h-3 w-3" />
            </span>
          )}
        </div>
      </Link>

      {!isRow && audio.keywords && audio.keywords.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
          {audio.keywords.slice(0, 3).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onKeyword?.(k)}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand"
            >
              {k}
            </button>
          ))}
          {audio.keywords.length > 3 && (
            <Badge variant="outline" className="text-[11px]">
              +{audio.keywords.length - 3}
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
}
