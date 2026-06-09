import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/app/revisao")({
  component: ReviewQueue,
});

function ReviewQueue() {
  const { data, isLoading } = useQuery({
    queryKey: ["review-queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audio_transcriptions")
        .select(`
          id, review_status, updated_at,
          audios!inner(id, title, message_source, recorded_at, status, works(name))
        `)
        .neq("review_status", "reviewed")
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Revisão</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Transcrições aguardando revisão</h1>
        <p className="mt-1 text-muted-foreground">
          Ouça, corrija o texto e marque como revisada.
        </p>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : (data?.length ?? 0) === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <ListChecks className="mx-auto mb-3 h-6 w-6" />
            Nenhuma transcrição pendente. Bom trabalho!
          </Card>
        ) : data?.map((t) => (
          <Card key={t.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg text-foreground">{t.audios.title}</p>
                <p className="text-sm text-muted-foreground">
                  {t.audios.message_source ?? "—"}
                  {t.audios.works?.name ? ` · ${t.audios.works.name}` : ""}
                </p>
                {t.audios.recorded_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Gravada em {format(new Date(t.audios.recorded_at), "d MMM yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="outline" className="border-gold/40 bg-gold/10 text-foreground">
                  {t.review_status === "in_review" ? "Em revisão" : "Não revisada"}
                </Badge>
                <Button asChild size="sm">
                  <Link to="/app/revisao/$id" params={{ id: t.audios.id }}>Revisar</Link>
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
