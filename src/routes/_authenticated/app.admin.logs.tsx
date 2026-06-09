import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listAuditLogs } from "@/lib/logs.functions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/app/admin/logs")({
  component: AdminLogs,
});

function AdminLogs() {
  const fn = useServerFn(listAuditLogs);
  const { data } = useQuery({ queryKey: ["admin-logs"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Administração</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Logs de auditoria</h1>
      </div>
      <Card className="divide-y divide-border">
        {(data?.length ?? 0) === 0 ? (
          <p className="p-8 text-center text-muted-foreground">Sem registros.</p>
        ) : data?.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm">
                <Badge variant="outline" className="mr-2">{l.entity}</Badge>
                <span className="font-medium text-foreground">{l.action}</span>
                {l.entity_id && <span className="ml-2 font-mono text-xs text-muted-foreground">{l.entity_id.slice(0, 8)}</span>}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                por {l.profiles?.full_name ?? "—"} · {format(new Date(l.created_at), "d MMM yyyy HH:mm", { locale: ptBR })}
              </p>
            </div>
            {l.diff && (
              <pre className="max-w-md overflow-hidden truncate rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                {JSON.stringify(l.diff)}
              </pre>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
