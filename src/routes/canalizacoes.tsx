import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Headphones } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SiteHeader, SiteFooter } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/canalizacoes")({
  head: () => ({
    meta: [
      { title: "Canalizações — Instituto Fraternidade" },
      { name: "description", content: "Mensagens públicas recebidas nos trabalhos do Instituto." },
      { property: "og:title", content: "Canalizações — Instituto Fraternidade" },
      { property: "og:description", content: "Mensagens públicas recebidas nos trabalhos do Instituto." },
    ],
  }),
  component: PublicCanalizacoes,
});

function PublicCanalizacoes() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-audios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audios")
        .select("id, title, description, message_source, recorded_at, works(name)")
        .eq("access_level", "public")
        .eq("status", "ready")
        .order("published_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-20 sm:px-6">
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Biblioteca pública</p>
        <h1 className="mt-3 font-display text-4xl text-foreground sm:text-5xl">Canalizações</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Compartilhamos aqui mensagens recebidas em nossos trabalhos. Demais
          conteúdos estão disponíveis na área de associados.
        </p>

        <div className="mt-10 grid gap-4">
          {isLoading ? (
            <p className="text-muted-foreground">Carregando…</p>
          ) : (data?.length ?? 0) === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">
              <Headphones className="mx-auto mb-3 h-6 w-6" />
              <p>Em breve, mensagens públicas estarão disponíveis aqui.</p>
              <Button asChild className="mt-6"><Link to="/auth">Entrar como associado</Link></Button>
            </Card>
          ) : (
            data?.map((a) => (
              <Card key={a.id} className="p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-display text-xl text-foreground">{a.title}</h2>
                  {a.recorded_at && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(a.recorded_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  )}
                </div>
                <p className="mt-1 text-sm text-brand">
                  {a.message_source ?? "Mensagem"}
                  {a.works?.name ? <span className="text-muted-foreground"> · {a.works.name}</span> : null}
                </p>
                {a.description && (
                  <p className="mt-3 text-sm text-muted-foreground">{a.description}</p>
                )}
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link to="/auth">Ouvir e ler transcrição</Link>
                </Button>
              </Card>
            ))
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
