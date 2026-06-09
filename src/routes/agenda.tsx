import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SiteHeader, SiteFooter } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Instituto Fraternidade" },
      { name: "description", content: "Próximos trabalhos abertos do Instituto Fraternidade." },
      { property: "og:title", content: "Agenda — Instituto Fraternidade" },
      { property: "og:description", content: "Próximos trabalhos abertos do Instituto Fraternidade." },
    ],
  }),
  component: AgendaPage,
});

function AgendaPage() {
  const { data: works, isLoading } = useQuery({
    queryKey: ["public-works"],
    queryFn: async () => {
      const { data } = await supabase
        .from("works")
        .select("id, name, description, starts_at, location")
        .eq("visibility", "public")
        .eq("status", "published")
        .gte("starts_at", new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString())
        .order("starts_at", { ascending: true });
      return data ?? [];
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-20 sm:px-6">
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Trabalhos</p>
        <h1 className="mt-3 font-display text-4xl text-foreground sm:text-5xl">Próximos trabalhos</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Encontros abertos à comunidade. Chegue alguns minutos antes para
          acomodar-se com tranquilidade.
        </p>

        <div className="mt-10 space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground">Carregando…</p>
          ) : (works?.length ?? 0) === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">
              <Calendar className="mx-auto mb-3 h-6 w-6" />
              Nenhum trabalho público agendado no momento.
            </Card>
          ) : (
            works?.map((w) => (
              <Card key={w.id} className="p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div>
                    <h2 className="font-display text-2xl text-foreground">{w.name}</h2>
                    <p className="mt-1 text-sm text-brand">
                      {format(new Date(w.starts_at), "EEEE, d 'de' MMMM 'de' yyyy · HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  {w.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {w.location}
                    </div>
                  )}
                </div>
                {w.description && (
                  <p className="mt-4 whitespace-pre-line text-muted-foreground">{w.description}</p>
                )}
              </Card>
            ))
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
