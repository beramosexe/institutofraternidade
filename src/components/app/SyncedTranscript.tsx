import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Pause, Play, SkipBack, SkipForward, Repeat, Crosshair, AlertTriangle, Search, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { reportSystemError } from "@/lib/system-error-logs.functions";

export type Segment = { start: number; end: number; text: string };

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

/** mm:ss.mmm for editing */
function formatPrecise(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  const ms = Math.round((s - Math.floor(s)) * 1000).toString().padStart(3, "0");
  return `${m}:${sec}.${ms}`;
}

/** Accepts "mm:ss.mmm", "mm:ss", "ss.mmm" or plain seconds. Returns null when invalid. */
function parsePrecise(v: string): number | null {
  const raw = v.trim();
  if (!raw) return null;
  const m = raw.match(/^(?:(\d+):)?(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (!m) return null;
  const mins = m[1] ? parseInt(m[1], 10) : 0;
  const secs = parseInt(m[2], 10);
  const frac = m[3] ? parseInt(m[3].padEnd(3, "0"), 10) / 1000 : 0;
  return mins * 60 + secs + frac;
}


function findSegmentAtTime(segments: Segment[], time: number): number {
  let low = 0;
  let high = segments.length - 1;
  let candidate = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (segments[mid].start <= time) {
      candidate = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (
    candidate >= 0 &&
    time >= segments[candidate].start &&
    time < segments[candidate].end
  ) {
    return candidate;
  }

  return -1;
}

function findLastStartedSegment(segments: Segment[], time: number): number {
  let low = 0;
  let high = segments.length - 1;
  let candidate = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (segments[mid].start <= time) {
      candidate = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return candidate;
}

interface Props {
  src: string;
  segments: Segment[];
  /** When provided, segments are editable inline and onChange fires after each edit. */
  editable?: boolean;
  /** Enables the start/end timestamp editor (requires `editable`). */
  editableTimestamps?: boolean;
  onChangeSegments?: (segments: Segment[]) => void;
  /** Shown when there are no segments (e.g. provider returned text only). */
  fallbackText?: string;
  /** Fires once the real audio duration is known. */
  onDurationKnown?: (duration: number) => void;
  /** Fires na primeira reprodução (para contabilizar audiência). */
  onFirstPlay?: () => void;
  /** Cor do trabalho, usada nos destaques do player. */
  accentColor?: string;
  /** Oculta a lista de transcrição (quando o pai controla a exibição). */
  hideTranscript?: boolean;
  /** Altura máxima da lista de transcrição. */
  listMaxHeight?: string;
  /** Exibe somente o trecho atual e seus vizinhos em uma faixa horizontal. */
  compactTranscript?: boolean;
  /** Conteúdo exibido entre o player e a transcrição. */
  transcriptHeader?: ReactNode;
}



function TimeField({
  value,
  onCommit,
  label,
  invalid,
  onFocus,
}: {
  value: number;
  onCommit: (v: number) => void;
  label: string;
  invalid?: boolean;
  onFocus?: () => void;
}) {
  const [draft, setDraft] = useState(formatPrecise(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(formatPrecise(value));
  }, [value, editing]);

  return (
    <input
      aria-label={label}
      title={label}
      value={draft}
      onFocus={() => { setEditing(true); onFocus?.(); }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const parsed = parsePrecise(draft);
        if (parsed === null) setDraft(formatPrecise(value));
        else onCommit(parsed);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") { setDraft(formatPrecise(value)); setEditing(false); (e.target as HTMLInputElement).blur(); }
      }}
      className={[
        "w-[86px] rounded border bg-background px-1.5 py-0.5 text-center font-mono text-[11px] tabular-nums focus:outline-none focus:ring-2 focus:ring-ring/30",
        invalid ? "border-destructive text-destructive" : "border-input text-muted-foreground",
      ].join(" ")}
    />
  );
}

export function SyncedTranscript({
  src, segments, editable, editableTimestamps, onChangeSegments, fallbackText,
  onDurationKnown, onFirstPlay, accentColor, hideTranscript, listMaxHeight,
  compactTranscript = false, transcriptHeader,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [rate, setRate] = useState(1);
  const [loopSegment, setLoopSegment] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const timeRef = useRef(0);
  const lastUiTimeUpdateRef = useRef(0);
  const onDurationKnownRef = useRef(onDurationKnown);
  useEffect(() => { onDurationKnownRef.current = onDurationKnown; }, [onDurationKnown]);
  const firstPlayRef = useRef(false);
  const onFirstPlayRef = useRef(onFirstPlay);
  useEffect(() => { onFirstPlayRef.current = onFirstPlay; }, [onFirstPlay]);
  const accent = accentColor || "hsl(var(--brand))";
  const reportError = useServerFn(reportSystemError);



  const timeEditing = !!(editable && editableTimestamps);
  // O player pode ter milhares de segmentos. Use busca binária em vez de
  // percorrer toda a transcrição a cada atualização do currentTime.
  const activeIdx = useMemo(
    () => findSegmentAtTime(segments, time),
    [segments, time],
  );
  // No modo compacto, durante um silêncio entre segmentos, mantenha o último
  // trecho já iniciado. Antes do primeiro trecho, use o primeiro como fallback.
  const compactIdx = useMemo(
    () => findLastStartedSegment(segments, time),
    [segments, time],
  );
  const compactFocusIdx = compactIdx >= 0 ? compactIdx : 0;

  useEffect(() => { timeRef.current = time; }, [time]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      const now = performance.now();
      // A reprodução não depende do React. Limitamos apenas as atualizações
      // visuais para evitar rerenders excessivos em áudios longos.
      if (now - lastUiTimeUpdateRef.current < 200) return;
      lastUiTimeUpdateRef.current = now;
      setTime(a.currentTime);
    };
    const onDur = () => {
      const d = a.duration || 0;
      setDuration(d);
      if (d && isFinite(d)) onDurationKnownRef.current?.(d);
    };

    const onPlay = () => {
      setPlaying(true);
      setBuffering(a.readyState < HTMLMediaElement.HAVE_FUTURE_DATA);
      if (!firstPlayRef.current) {
        firstPlayRef.current = true;
        onFirstPlayRef.current?.();
      }
    };
    const onPause = () => {
      setPlaying(false);
      setBuffering(false);
      setTime(a.currentTime);
    };
    const onWaiting = () => {
      setBuffering(true);
      console.warn("[PLAYER] aguardando dados do áudio", {
        currentTime: a.currentTime,
        readyState: a.readyState,
        networkState: a.networkState,
        duration: Number.isFinite(a.duration) ? a.duration : null,
      });
    };
    const onPlaying = () => setBuffering(false);
    const onCanPlay = () => setBuffering(false);
    const onWaiting = () => {
      console.warn("[PLAYER] aguardando dados do áudio", {
        currentTime: a.currentTime,
        readyState: a.readyState,
        networkState: a.networkState,
        duration: Number.isFinite(a.duration) ? a.duration : null,
      });
    };
    const onCanPlay = () => {
      console.log("[PLAYER] áudio pronto para reprodução", {
        currentTime: a.currentTime,
        readyState: a.readyState,
        networkState: a.networkState,
        duration: Number.isFinite(a.duration) ? a.duration : null,
      });
    };
    const onLoadedMetadata = () => {
      console.log("[PLAYER] metadata carregada", {
        currentTime: a.currentTime,
        readyState: a.readyState,
        networkState: a.networkState,
        duration: Number.isFinite(a.duration) ? a.duration : null,
        src: a.currentSrc || src,
      });
    };
    const onError = () => {
      const mediaError = a.error;
      const details = {
        stage: "html_audio_error",
        code: mediaError?.code ?? null,
        message: mediaError?.message ?? null,
        networkState: a.networkState,
        readyState: a.readyState,
        currentTime: a.currentTime,
        duration: Number.isFinite(a.duration) ? a.duration : null,
        srcHost: (() => {
          try { return new URL(a.currentSrc || src).hostname; } catch { return null; }
        })(),
      };
      console.error("[SyncedTranscript] Falha na reprodução", details);
      void reportError({ data: {
        category: "audio_playback",
        event: "media_error",
        message: mediaError?.message || "Falha ao reproduzir o áudio.",
        metadata: details,
      } }).catch((error) => console.error("[SyncedTranscript] erro ao registrar log", error));
    };
    const onStalled = () => {
      const details = {
        stage: "html_audio_stalled",
        networkState: a.networkState,
        readyState: a.readyState,
        currentTime: a.currentTime,
      };
      console.warn("[SyncedTranscript] Reprodução interrompida pelo carregamento", details);
      void reportError({ data: {
        category: "audio_playback",
        event: "media_stalled",
        message: "A reprodução foi interrompida pelo carregamento do áudio.",
        metadata: details,
      } }).catch((error) => console.error("[SyncedTranscript] erro ao registrar log", error));
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("durationchange", onDur);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("waiting", onWaiting);
    a.addEventListener("playing", onPlaying);
    a.addEventListener("canplay", onCanPlay);
    a.addEventListener("loadedmetadata", onLoadedMetadata);
    a.addEventListener("error", onError);
    a.addEventListener("stalled", onStalled);
    a.load();
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("durationchange", onDur);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("waiting", onWaiting);
      a.removeEventListener("playing", onPlaying);
      a.removeEventListener("canplay", onCanPlay);
      a.removeEventListener("loadedmetadata", onLoadedMetadata);
      a.removeEventListener("error", onError);
      a.removeEventListener("stalled", onStalled);
    };
  }, [src]);

  const showCompactTranscript = compactTranscript && !editable;

  // Keep the relevant segment centered inside either transcript view.
  useEffect(() => {
    const targetIdx = showCompactTranscript ? compactFocusIdx : activeIdx;
    if (targetIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-seg='${targetIdx}']`) as HTMLElement | null;
    if (!el) return;
    const list = listRef.current;
    if (showCompactTranscript) {
      const listRect = list.getBoundingClientRect();
      const itemRect = el.getBoundingClientRect();
      const target = list.scrollLeft + itemRect.left - listRect.left - list.clientWidth / 2 + itemRect.width / 2;
      list.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
      return;
    }
    const target = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
    list.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [activeIdx, compactFocusIdx, showCompactTranscript]);

  // Loop the active segment
  useEffect(() => {
    if (!loopSegment) return;
    const a = audioRef.current;
    if (!a || activeIdx < 0) return;
    const seg = segments[activeIdx];
    if (time >= seg.end) {
      a.currentTime = seg.start;
    }
  }, [time, loopSegment, activeIdx, segments]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  async function toggle() {
    const audio = audioRef.current;

    console.log("[PLAYER] toggle", {
      audio,
      src: audio?.currentSrc || src,
      paused: audio?.paused,
      readyState: audio?.readyState,
      networkState: audio?.networkState,
      duration: audio?.duration,
    });

    if (!audio) {
      console.error("[PLAYER] elemento <audio> não encontrado");
      return;
    }

    if (playing) {
      audio.pause();
      return;
    }

    try {
      await audio.play();
      console.log("[PLAYER] play() executado com sucesso");
    } catch (error) {
      console.error("[PLAYER] play() falhou", {
        error,
        src: audio.currentSrc || src,
        readyState: audio.readyState,
        networkState: audio.networkState,
        errorCode: audio.error?.code,
        errorMessage: audio.error?.message,
      });
    }
  }
  function seek(to: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = to;
    timeRef.current = to;
    setTime(to);
  }
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const visibleSegments = useMemo(
    () =>
      segments
        .map((segment, index) => ({ segment, index }))
        .filter(
          ({ segment }) =>
            !normalizedSearch ||
            segment.text.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
        ),
    [segments, normalizedSearch],
  );

  function updateSegmentText(i: number, text: string) {
    if (!onChangeSegments) return;
    const next = segments.slice();
    next[i] = { ...next[i], text };
    onChangeSegments(next);
  }

  function updateSegmentTime(i: number, field: "start" | "end", value: number) {
    if (!onChangeSegments) return;
    const v = Math.max(0, Math.round(value * 1000) / 1000);
    if (segments[i][field] === v) return;
    const next = segments.slice();
    next[i] = { ...next[i], [field]: v };
    onChangeSegments(next);
  }

  /** Shift every segment from `from` onwards by `delta` seconds. */
  function shiftAll(delta: number, from = 0) {
    if (!onChangeSegments) return;
    const next = segments.map((s, i) =>
      i < from ? s : {
        ...s,
        start: Math.max(0, Math.round((s.start + delta) * 1000) / 1000),
        end: Math.max(0, Math.round((s.end + delta) * 1000) / 1000),
      },
    );
    onChangeSegments(next);
  }

  // Keyboard shortcuts: [ sets start, ] sets end on focused segment
  useEffect(() => {
    if (!timeEditing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "[" && e.key !== "]") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      const idx = focusedIdx ?? activeIdx;
      if (idx == null || idx < 0) return;
      e.preventDefault();
      updateSegmentTime(idx, e.key === "[" ? "start" : "end", timeRef.current);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeEditing, focusedIdx, activeIdx, segments]);

  return (
    <div className="flex flex-col gap-3">
      <audio ref={audioRef} src={src} preload="auto" crossOrigin="anonymous" />

      <div
        className="sticky top-14 z-10 rounded-lg border border-border bg-card/95 p-3 shadow-sm backdrop-blur md:top-2"
        style={{ borderTop: `3px solid ${accent}` }}
      >
        <Slider
          value={[time]} min={0} max={duration || 1} step={0.1}
          onValueChange={(v) => seek(v[0])}
        />
        <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground">
          <span>{formatTime(time)}</span>
          <span>-{formatTime(Math.max(0, duration - time))}</span>
        </div>

        <div className="mt-2 flex items-center justify-center gap-3">
          <Button
            size="icon" variant="outline" className="h-10 w-10"
            aria-label="Voltar 15 segundos"
            onClick={() => seek(Math.max(0, time - 15))}
          >
            <SkipBack className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            onClick={toggle}
            aria-label={playing ? "Pausar" : "Reproduzir"}
            className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            {buffering
              ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              : playing
                ? <Pause className="h-6 w-6 fill-current" aria-hidden="true" />
                : <Play className="h-6 w-6 fill-current" aria-hidden="true" />}
          </Button>
          <Button
            size="icon" variant="outline" className="h-10 w-10"
            aria-label="Avançar 15 segundos"
            onClick={() => seek(Math.min(duration, time + 15))}
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">Velocidade</span>
          {[0.75, 1, 1.25, 1.5, 2].map((r) => (
            <Button
              key={r} size="sm"
              variant={rate === r ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => setRate(r)}
            >{r}x</Button>
          ))}
          {editable && (
            <Button
              size="sm"
              variant={loopSegment ? "default" : "outline"}
              onClick={() => setLoopSegment((v) => !v)}
              className="h-8"
            >
              <Repeat className="mr-1 h-3 w-3" /> Repetir segmento
            </Button>
          )}
        </div>


        {timeEditing && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Ajuste global de tempo:</span>
            {[-1, -0.5, -0.25, 0.25, 0.5, 1].map((d) => (
              <Button key={d} size="sm" variant="outline" onClick={() => shiftAll(d)}>
                {d > 0 ? `+${d}` : d}s
              </Button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              Atalhos: <kbd className="rounded border border-border px-1">[</kbd> define início ·{" "}
              <kbd className="rounded border border-border px-1">]</kbd> define fim (no segmento selecionado)
            </span>
          </div>
        )}
      </div>

      {transcriptHeader}

      {!hideTranscript && (
        <div className="space-y-2">
          {segments.length > 3 && !editable && !showCompactTranscript && (
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar na transcrição"
                  className="h-9 pl-9 pr-9 text-sm"
                />
                {search && (
                  <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2" onClick={() => setSearch("")} aria-label="Limpar busca">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {normalizedSearch && <span className="shrink-0 text-xs text-muted-foreground">{visibleSegments.length} trechos</span>}
            </div>
          )}
          {showCompactTranscript && segments.length > 0 ? (
            <div
              ref={listRef}
              aria-label="Trechos sincronizados do áudio"
              className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-lg border border-border bg-card px-[9%] py-4 scroll-smooth md:px-[16%]"
            >
              {segments
                .slice(
                  Math.max(0, compactFocusIdx - 1),
                  Math.min(segments.length, compactFocusIdx + 2),
                )
                .map((seg, offset) => {
                const i = Math.max(0, compactFocusIdx - 1) + offset;
                const distance = Math.abs(i - compactFocusIdx);
                const visible = distance <= 1;
                return (
                  <button
                    key={i}
                    type="button"
                    data-seg={i}
                    aria-current={i === compactIdx ? "true" : undefined}
                    aria-hidden={!visible}
                    tabIndex={visible ? 0 : -1}
                    onClick={() => seek(seg.start)}
                    className={[
                      "min-h-28 w-[82%] shrink-0 snap-center self-stretch px-2 py-3 text-left transition-[opacity,transform] duration-500 md:w-[68%]",
                      i === compactFocusIdx
                        ? "scale-100 opacity-100"
                        : visible
                          ? "scale-95 opacity-35"
                          : "pointer-events-none scale-90 opacity-0",
                    ].join(" ")}
                  >
                    <span className="mb-2 block font-mono text-[11px] text-muted-foreground">{formatTime(seg.start)}</span>
                    <span className={i === compactIdx
                      ? "block font-display text-lg leading-relaxed text-foreground md:text-xl"
                      : "line-clamp-3 block text-sm leading-relaxed text-muted-foreground"}
                    >
                      {seg.text}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
          <div
            ref={listRef}
            style={{ maxHeight: listMaxHeight ?? "60vh" }}
            className="overflow-y-auto rounded-lg border border-border bg-card p-2 md:p-3"
          >

        {segments.length === 0 ? (
          fallbackText ? (
            <div className="space-y-2 p-4">
              <p className="text-xs text-muted-foreground">
                Transcrição sem marcações de tempo — preparando sincronização…
              </p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{fallbackText}</p>
            </div>
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Transcrição indisponível.
            </p>
          )

        ) : visibleSegments.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum trecho encontrado.</p>
        ) : visibleSegments.map(({ segment: seg, index: i }) => {
          const invalid = seg.end <= seg.start;
          const overlaps = i > 0 && seg.start < segments[i - 1].end;
          return (
            <div
              key={i}
              data-seg={i}
              onClick={() => timeEditing && setFocusedIdx(i)}
              className={[
                "group flex gap-2 rounded-md px-2 py-2 transition-colors md:gap-3 md:px-3",
                i === activeIdx ? "bg-brand/15" : "hover:bg-accent/50",
                timeEditing && focusedIdx === i ? "ring-1 ring-brand/40" : "",
              ].join(" ")}
            >
              {timeEditing ? (
                <div className="flex shrink-0 flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <TimeField
                      label="Início do segmento"
                      value={seg.start}
                      invalid={invalid || overlaps}
                      onFocus={() => setFocusedIdx(i)}
                      onCommit={(v) => updateSegmentTime(i, "start", v)}
                    />
                    <Button
                      size="icon" variant="ghost" className="h-6 w-6"
                      title="Usar tempo atual do player como início"
                      onClick={() => { setFocusedIdx(i); updateSegmentTime(i, "start", time); }}
                    >
                      <Crosshair className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <TimeField
                      label="Fim do segmento"
                      value={seg.end}
                      invalid={invalid}
                      onFocus={() => setFocusedIdx(i)}
                      onCommit={(v) => updateSegmentTime(i, "end", v)}
                    />
                    <Button
                      size="icon" variant="ghost" className="h-6 w-6"
                      title="Usar tempo atual do player como fim"
                      onClick={() => { setFocusedIdx(i); updateSegmentTime(i, "end", time); }}
                    >
                      <Crosshair className="h-3 w-3" />
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => seek(seg.start)}
                    className="text-[11px] text-brand hover:underline"
                  >
                    ouvir
                  </button>
                  {(invalid || overlaps) && (
                    <span className="flex items-center gap-1 text-[10px] text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      {invalid ? "fim ≤ início" : "sobrepõe anterior"}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => seek(seg.start)}
                  className="shrink-0 font-mono text-xs text-brand hover:underline"
                  title="Pular para este momento"
                >
                  {formatTime(seg.start)}
                </button>
              )}
              {editable ? (
                <textarea
                  value={seg.text}
                  onFocus={() => setFocusedIdx(i)}
                  onChange={(e) => updateSegmentText(i, e.target.value)}
                  rows={Math.max(1, Math.ceil(seg.text.length / 70))}
                  className="flex-1 resize-none rounded-md border border-transparent bg-transparent px-2 py-1 text-sm leading-relaxed text-foreground focus:border-input focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              ) : (
                <p className="flex-1 text-sm leading-relaxed text-foreground">{seg.text}</p>
              )}
            </div>
          );
        })}
          </div>
          )}
        </div>
      )}
    </div>
  );
}
