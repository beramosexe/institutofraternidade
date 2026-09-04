import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/midias/redes")({
  head: () => ({
    meta: [
      { title: "Redes sociais — Instituto Fraternidade" },
      { name: "description", content: "Agende e acompanhe publicações do Instituto nas redes sociais." },
      { property: "og:title", content: "Redes sociais — Instituto Fraternidade" },
      { property: "og:description", content: "Agende e acompanhe publicações do Instituto nas redes sociais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SocialPage,
});

const CHANNELS = ["instagram", "facebook", "youtube"];

function SocialPage() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [channels, setChannels] = useState<string[]>(["instagram"]);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["social-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_media_posts")
        .select("id, content_text, channels, scheduled_for, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("social_media_posts").insert({
        content_text: text,
        channels,
        scheduled_for: when ? new Date(when).toISOString() : null,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText(""); setWhen("");
      toast.success("Publicação criada.");
      qc.invalidateQueries({ queryKey: ["social-posts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar publicação."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("social_media_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-posts"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir."),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Mídias</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Redes sociais</h1>
        <p className="mt-1 text-muted-foreground">
          Rascunhos e agendamentos de lembretes de trabalhos e comunicados. Integração com APIs virá depois.
        </p>
      </div>

      <Card className="space-y-3 p-5">
        <Textarea rows={4} placeholder="Texto da publicação" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <Button
              key={c}
              type="button"
              size="sm"
              variant={channels.includes(c) ? "default" : "outline"}
              onClick={() =>
                setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
              }
            >
              {c}
            </Button>
          ))}
        </div>
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <Button disabled={!text.trim() || create.isPending} onClick={() => create.mutate()}>
          Salvar publicação
        </Button>
      </Card>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {posts?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma publicação ainda.</p>}
        {posts?.map((p) => (
          <Card key={p.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm text-foreground">{p.content_text}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(p.channels ?? []).map((c) => (
                  <Badge key={c} variant="secondary">{c}</Badge>
                ))}
                {p.scheduled_for && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(p.scheduled_for).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => remove.mutate(p.id)}>Excluir</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
