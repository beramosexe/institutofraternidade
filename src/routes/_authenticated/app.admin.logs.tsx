import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listSystemErrorLogs, clearSystemErrorLogs } from "@/lib/system-error-logs.functions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/admin/logs")({
  component: AdminLogs,
});

const categoryLabels: Record<string, string> = {
  audio_upload: "Upload",
  audio_playback: "Playback",
  audio_processing: "Processamento",
  transcription: "Transcrição",
  authentication: "Autenticação",
  database: "Banco",
  r2: "R2",
  system: "Sistema",
};

function AdminLogs() {
  const listFn = useServerFn(listSystemErrorLogs);
  const clearFn = useServerFn(clearSystemErrorLogs);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["system-error-logs"],
    queryFn: () => listFn(),
    refetchInterval: 15000,
  });

  const clearMutation = useMutation({
    mutationFn: () => clearFn({ data: {} }),
    onSuccess: async () => {
      setSelectedId(null);
      await refetch();
      toast.success("Logs de erro apagados.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const selected = data?.find((log) => log.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand">Administração</p>
          <h1 className="mt-1 font-display text-3xl text-foreground">Logs de erro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Falhas relevantes registradas pelo sistema. Atualização automática a cada 15 segundos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
          <Button
            variant="outline"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending || !data?.length}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Limpar
          </Button>
        </div>
      </div>

      <div className={selected ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]" : ""}>
        <Card className="divide-y divide-border">
          {isLoading ? (
            <p className="p-8 text-center text-muted-foreground">Carregando…</p>
          ) : (data?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-12 text-center text-muted-foreground">
              <AlertTriangle className="h-6 w-6" />
              <p>Nenhum erro registrado.</p>
            </div>
          ) : (
            data?.map((log) => (
              <button
                key={log.id}
                type="button"
                onClick={() => setSelectedId(log.id)}
                className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{categoryLabels[log.category] ?? log.category}</Badge>
                    <span className="font-medium text-foreground">{log.event}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{log.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(log.created_at), "d MMM yyyy HH:mm:ss", { locale: ptBR })}
                    {log.audio_id ? ` · áudio ${log.audio_id.slice(0, 8)}` : ""}
                    {log.user_name ? ` · ${log.user_name}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">Ver</span>
              </button>
            ))
          )}
        </Card>

        {selected && (
          <Card className="h-fit p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-destructive">Erro</p>
                <h2 className="mt-1 text-lg font-medium text-foreground">{selected.event}</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>Fechar</Button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <Detail label="Categoria" value={categoryLabels[selected.category] ?? selected.category} />
              <Detail label="Mensagem" value={selected.message} />
              <Detail label="Data" value={format(new Date(selected.created_at), "d/MM/yyyy HH:mm:ss", { locale: ptBR })} />
              <Detail label="Usuário" value={selected.user_name ?? selected.user_id ?? "—"} mono={!selected.user_name} />
              <Detail label="Áudio" value={selected.audio_id ?? "—"} mono={!!selected.audio_id} />
              <Detail label="Request ID" value={selected.request_id ?? "—"} mono={!!selected.request_id} />
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Metadata</p>
                <pre className="mt-1 max-h-[420px] overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">
                  {JSON.stringify(selected.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-1 break-words text-foreground ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}
