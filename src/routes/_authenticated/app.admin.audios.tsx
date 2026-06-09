import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, Archive, Trash, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { updateAudio, deleteAudio, reprocessAudio } from "@/lib/audios.functions";
import { AUDIO_STATUS_LABELS, ACCESS_LEVEL_LABELS } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/app/admin/audios")({
  component: AdminAudios,
});

function AdminAudios() {
  const qc = useQueryClient();
  const update = useServerFn(updateAudio);
  const del = useServerFn(deleteAudio);
  const reproc = useServerFn(reprocessAudio);

  const { data } = useQuery({
    queryKey: ["admin-audios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audios")
        .select("id, title, status, access_level, audio_type, message_source, works(name), uploaded_by, profiles:uploaded_by(full_name), published_at")
        .order("published_at", { ascending: false });
      return data ?? [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-audios"] });
  const archiveMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "archived" | "ready" }) =>
      update({ data: { id, patch: { status } } }),
    onSuccess: () => { toast.success("Atualizado."); invalidate(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Excluído."); invalidate(); },
  });
  const reprocMut = useMutation({
    mutationFn: (id: string) => reproc({ data: { id } }),
    onSuccess: () => { toast.success("Reprocessamento iniciado."); invalidate(); },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Administração</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Gestão de áudios</h1>
      </div>

      <div className="grid gap-3">
        {(data?.length ?? 0) === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">Nenhum áudio.</Card>
        ) : data?.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {a.works?.name ?? "—"} · {a.message_source ?? "—"} · por {a.profiles?.full_name ?? "?"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{ACCESS_LEVEL_LABELS[a.access_level]}</Badge>
                <Badge variant="outline">{AUDIO_STATUS_LABELS[a.status]}</Badge>
                <Button asChild size="icon" variant="outline" title="Abrir">
                  <Link to="/app/audios/$id" params={{ id: a.id }}><ExternalLink className="h-4 w-4" /></Link>
                </Button>
                <Button size="icon" variant="outline" title="Reprocessar"
                  onClick={() => reprocMut.mutate(a.id)}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" title={a.status === "archived" ? "Republicar" : "Arquivar"}
                  onClick={() => archiveMut.mutate({ id: a.id, status: a.status === "archived" ? "ready" : "archived" })}>
                  <Archive className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" title="Excluir"
                  onClick={() => { if (confirm(`Excluir "${a.title}"?`)) deleteMut.mutate(a.id); }}>
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
