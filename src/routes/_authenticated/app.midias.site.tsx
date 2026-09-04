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

export const Route = createFileRoute("/_authenticated/app/midias/site")({
  head: () => ({
    meta: [
      { title: "Postagens do site — Instituto Fraternidade" },
      { name: "description", content: "Gerencie blogs, orações, decretos e mensagens publicadas no site do Instituto." },
      { property: "og:title", content: "Postagens do site — Instituto Fraternidade" },
      { property: "og:description", content: "Gerencie blogs, orações, decretos e mensagens publicadas no site do Instituto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SitePostsPage,
});

function SitePostsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const { data: posts, isLoading } = useQuery({
    queryKey: ["site-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_posts")
        .select("id, title, content, status, published_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("site_posts").insert({ title, content, status: "draft" });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle(""); setContent("");
      toast.success("Rascunho criado.");
      qc.invalidateQueries({ queryKey: ["site-posts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar postagem."),
  });

  const toggle = useMutation({
    mutationFn: async (p: { id: string; status: string }) => {
      const next = p.status === "published" ? "draft" : "published";
      const { error } = await supabase
        .from("site_posts")
        .update({ status: next, published_at: next === "published" ? new Date().toISOString() : null })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site-posts"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("site_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site-posts"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir."),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Mídias</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Postagens do site</h1>
        <p className="mt-1 text-muted-foreground">
          Blogs, orações, decretos, mensagens escritas e registros de eventos.
        </p>
      </div>

      <Card className="space-y-3 p-5">
        <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea rows={5} placeholder="Conteúdo" value={content} onChange={(e) => setContent(e.target.value)} />
        <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>
          Criar rascunho
        </Button>
      </Card>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {posts?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma postagem ainda.</p>}
        {posts?.map((p) => (
          <Card key={p.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{p.title}</p>
                <Badge variant={p.status === "published" ? "default" : "secondary"}>
                  {p.status === "published" ? "Publicado" : "Rascunho"}
                </Badge>
              </div>
              {p.content && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.content}</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => toggle.mutate({ id: p.id, status: p.status })}>
                {p.status === "published" ? "Despublicar" : "Publicar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(p.id)}>Excluir</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
