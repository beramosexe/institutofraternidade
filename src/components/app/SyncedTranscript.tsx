import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export type Segment = { start: number; end: number; text: string };

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

interface Props {
  src: string;
  segments: Segment[];
  /** When provided, segments are editable inline and onChange fires after each edit. */
  editable?: boolean;
  onChangeSegments?: (segments: Segment[]) => void;
}

export function SyncedTranscript({ src, segments, editable, onChangeSegments }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [loopSegment, setLoopSegment] = useState(false);

  const activeIdx = segments.findIndex((s) => time >= s.start && time < s.end);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onDur = () => setDuration(a.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("durationchange", onDur);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("durationchange", onDur);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, [src]);

  // Auto-scroll active segment
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-seg='${activeIdx}']`) as HTMLElement | null;
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIdx]);

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

  function toggle() { playing ? audioRef.current?.pause() : audioRef.current?.play(); }
  function seek(to: number) { if (audioRef.current) audioRef.current.currentTime = to; }

  function updateSegmentText(i: number, text: string) {
    if (!onChangeSegments) return;
    const next = segments.slice();
    next[i] = { ...next[i], text };
    onChangeSegments(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="outline" onClick={() => seek(Math.max(0, time - 5))}><SkipBack className="h-4 w-4" /></Button>
          <Button size="icon" onClick={toggle} className="h-12 w-12 rounded-full">
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button size="icon" variant="outline" onClick={() => seek(Math.min(duration, time + 5))}><SkipForward className="h-4 w-4" /></Button>
          <div className="ml-2 min-w-0 flex-1">
            <Slider
              value={[time]} min={0} max={duration || 1} step={0.1}
              onValueChange={(v) => seek(v[0])}
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(time)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Velocidade:</span>
          {[0.75, 1, 1.25, 1.5].map((r) => (
            <Button
              key={r} size="sm"
              variant={rate === r ? "default" : "outline"}
              onClick={() => setRate(r)}
            >{r}x</Button>
          ))}
          {editable && (
            <Button
              size="sm"
              variant={loopSegment ? "default" : "outline"}
              onClick={() => setLoopSegment((v) => !v)}
              className="ml-2"
            >
              <Repeat className="mr-1 h-3 w-3" /> Repetir segmento
            </Button>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        className="max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-card p-3"
      >
        {segments.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Transcrição indisponível.
          </p>
        ) : segments.map((seg, i) => (
          <div
            key={i}
            data-seg={i}
            className={[
              "group flex gap-3 rounded-md px-3 py-2 transition-colors",
              i === activeIdx ? "bg-brand/15" : "hover:bg-accent/50",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={() => seek(seg.start)}
              className="shrink-0 font-mono text-xs text-brand hover:underline"
              title="Pular para este momento"
            >
              {formatTime(seg.start)}
            </button>
            {editable ? (
              <textarea
                value={seg.text}
                onChange={(e) => updateSegmentText(i, e.target.value)}
                rows={Math.max(1, Math.ceil(seg.text.length / 70))}
                className="flex-1 resize-none rounded-md border border-transparent bg-transparent px-2 py-1 text-sm leading-relaxed text-foreground focus:border-input focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            ) : (
              <p className="flex-1 text-sm leading-relaxed text-foreground">{seg.text}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
