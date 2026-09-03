import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Lock, Star, Headphones, PlayCircle, Globe } from "lucide-react";
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

const DEFAULT_COLOR = "var(--brand)";

/** Tinta suave derivada da cor do trabalho (fundo do cartão). */
function tint(color: string, pct: number) {
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`;
}

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

function AccessChip({ level }: { level: AudioCardData["access_level"] }) {
  const restricted = level !== "public";
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
      title={`Disponibilidade: ${ACCESS_LEVEL_LABELS[level]}`}
    >
      {restricted ? <Lock className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
      {ACCESS_LEVEL_LABELS[level]}
    </span>
  );
}

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
  const duration = formatDuration(audio.duration_seconds);
  const date = shortDate(audio.recorded_at);
  const label = audio.works?.name ?? (audio.audio_type === "canalizacao" ? "Canalização" : "Áudio");

  if (variant === "compact") {
    return (
      <Card
        className="w-[240px] shrink-0 overflow-hidden transition-colors hover:bg-accent/30 sm:w-[260px]"
        style={{ borderTop: `4px solid ${color}`, background: tint(color, 7) }}
      >
        <Link to="/app/audios/$id" params={{ id: audio.id }} className="block p-3.5">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ color, background: tint(color, 14) }}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
              <span className="truncate">{label}</span>
            </span>
            {audio.is_featured && <Star className="h-3 w-3 shrink-0 text-gold" />}
          </div>
          <h3 className="mt-1.5 line-clamp-2 font-display text-base leading-snug text-foreground">
            {audio.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {date && <span>{date}</span>}
            {duration && (
              <span className="flex items-center gap-1">
                <Headphones className="h-3 w-3" />
                {duration}
              </span>
            )}
          </div>
          <div className="mt-2">
            <AccessChip level={audio.access_level} />
          </div>
        </Link>
      </Card>
    );
  }

  const isRow = variant === "row";

  return (
    <Card
      className="group relative overflow-hidden transition-colors hover:bg-accent/30"
      style={{ borderLeft: `5px solid ${color}`, background: tint(color, 6) }}
    >
      <Link
        to="/app/audios/$id"
        params={{ id: audio.id }}
        className={isRow ? "block px-4 py-3" : "block p-4"}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ color, background: tint(color, 14) }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                <span className="truncate">{label}</span>
              </span>
              {audio.is_featured && <Star className="h-3 w-3 shrink-0 text-gold" />}
              <AccessChip level={audio.access_level} />
            </div>

            <h3
              className={[
                "mt-1.5 font-display leading-snug text-foreground",
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
        </div>
      </Link>

      {!isRow && audio.keywords && audio.keywords.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
          {audio.keywords.slice(0, 3).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onKeyword?.(k)}
              className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand"
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
