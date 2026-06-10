import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Upload as UploadIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { registerAudio } from "@/lib/audios.functions";
import { listEntitiesForWork } from "@/lib/entities.functions";
import { useMyAccess } from "@/components/app/AppShell";
import { useAuth } from "@/lib/auth-context";

const OTHER_VALUE = "__other__";
const NONE_VALUE = "__none__";

const ACCEPT = ".mp3,.m4a,.wav,.webm,.ogg,.aac,audio/*";
const MAX_BYTES = 500 * 1024 * 1024;

export const Route = createFileRoute("/_authenticated/app/upload")({
  component: UploadPage,
});

function UploadPage() {
  const { data: access } = useMyAccess();
  const { user } = useAuth();
  const navigate = useNavigate();
  const register = useServerFn(registerAudio);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workId, setWorkId] = useState<string>("none");
  const [recordedAt, setRecordedAt] = useState<string>("");
  const [audioType, setAudioType] = useState<"canalizacao" | "outro">("canalizacao");
  const [messageSource, setMessageSource] = useState("");
  const [accessLevel, setAccessLevel] = useState<"public" | "associates" | "work_participants" | "attendees_only">("associates");
  const [busy, setBusy] = useState(false);

  const { data: works } = useQuery({
    queryKey: ["works-options"],
    queryFn: async () => (await supabase.from("works").select("id, name").order("starts_at", { ascending: false })).data ?? [],
  });

  const canUpload = access?.isAdmin || access?.permissions.includes("audio.upload");

  if (access && !canUpload) {
    return (
      <div className="mx-auto max-w-2xl p-10">
        <Card className="p-8 text-center">
          <p className="text-foreground">Você não possui permissão para enviar áudios.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Solicite ao administrador o cargo de "Disponibilizador".
          </p>
        </Card>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !user) return;
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo maior que 500 MB.");
      return;
    }
    if (!title.trim()) { toast.error("Informe um título."); return; }

    setBusy(true);
    const ext = file.name.split(".").pop() || "mp3";
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    try {
      const { error: upErr } = await supabase.storage
        .from("audios")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const row = await register({
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          work_id: workId === "none" ? null : workId,
          recorded_at: recordedAt || null,
          audio_type: audioType,
          message_source: messageSource.trim() || undefined,
          access_level: accessLevel,
          storage_path: path,
          file_size_bytes: file.size,
          mime_type: file.type || `audio/${ext}`,
        },
      });

      toast.success("Áudio enviado. Transcrição iniciada.");
      navigate({ to: "/app/audios/$id", params: { id: row.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar áudio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Disponibilizar</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Enviar áudio</h1>
        <p className="mt-1 text-muted-foreground">
          O arquivo é salvo com segurança e a transcrição automática é iniciada em seguida.
        </p>
      </div>

      <form onSubmit={onSubmit}>
        <Card className="space-y-5 p-6">
          <div>
            <Label htmlFor="file">Arquivo de áudio *</Label>
            <Input
              id="file" type="file" accept={ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
            {file && (
              <p className="mt-1 text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="title">Título *</Label>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </div>
            <div>
              <Label htmlFor="source">Mensagem de quem</Label>
              <Input id="source" placeholder="Ex.: Mentor X, Espírito amigo…" value={messageSource} onChange={(e) => setMessageSource(e.target.value)} maxLength={200} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Trabalho</Label>
              <Select value={workId} onValueChange={setWorkId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem trabalho vinculado —</SelectItem>
                  {works?.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="recorded">Data da gravação</Label>
              <Input id="recorded" type="date" value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Tipo</Label>
              <Select value={audioType} onValueChange={(v) => setAudioType(v as "canalizacao" | "outro")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="canalizacao">Canalização</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nível de acesso</Label>
              <Select value={accessLevel} onValueChange={(v) => setAccessLevel(v as typeof accessLevel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Público geral</SelectItem>
                  <SelectItem value="associates">Restrito aos associados</SelectItem>
                  <SelectItem value="work_participants">Restrito aos participantes do trabalho</SelectItem>
                  <SelectItem value="attendees_only">Apenas presentes no dia (check-in)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="desc">Descrição (opcional)</Label>
            <Textarea id="desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
          </div>

          <Button type="submit" disabled={busy || !file} className="w-full md:w-auto">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadIcon className="mr-2 h-4 w-4" />}
            Enviar áudio
          </Button>
        </Card>
      </form>
    </div>
  );
}
