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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Clock, Globe, MoreHorizontal, Trash } from "lucide-react";

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
        .select(`
          id, 
          title, 
          content, 
          status, 
          published_at, 
          created_at,
          profiles (full_name, avatar_url)
        `)
        .order("created_at", { ascending: false });
      
      if (error) {
        // Fallback genérico caso a relação explícita com profiles falhe
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from("site_posts")
          .select("id, title, content, status, published_at, created_at, author_id")
          .order("created_at", { ascending: false });
        if (fallbackErr) throw fallbackErr;
        return fallbackData ?? [];
      }
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const payload: any = { title, content, status: "draft" };
      if (session?.user?.id) {
        payload.author_id = session.user.id;
      }

      const { error } = await supabase.from("site_posts").insert(payload);
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
    <div className="mx-auto max-w-3xl space-y-12 p-6 md:py-12">
      <header className="flex flex-col items-center text-center pb-8 border-b border-border/50">
        <p className="text-xs uppercase tracking-[0.22em] text-brand font-semibold">Mídias</p>
        <h1 className="mt-4 font-display text-4xl text-foreground font-bold tracking-tight md:text-5xl">
          Postagens
        </h1>
        <p className="mt-5 max-w-lg font-serif text-lg text-muted-foreground/90 leading-relaxed md:text-xl">
          Compartilhe reflexões, orações e mensagens em um espaço otimizado para a leitura.
        </p>
      </header>

      <section>
        <Card className="overflow-hidden border-border/60 shadow-sm transition-all duration-300 focus-within:border-brand/40 focus-within:ring-4 focus-within:ring-brand/5">
          <div className="p-6 md:p-8">
            <Input 
              placeholder="Título da publicação" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              className="border-0 bg-transparent px-0 font-display text-3xl font-medium placeholder:text-muted-foreground/40 focus-visible:ring-0 shadow-none h-auto py-2"
            />
            <Textarea 
              rows={4} 
              placeholder="Comece a escrever o conteúdo focado em leitura..." 
              value={content} 
              onChange={(e) => setContent(e.target.value)} 
              className="mt-4 resize-none border-0 bg-transparent px-0 font-serif text-xl leading-relaxed placeholder:text-muted-foreground/40 focus-visible:ring-0 shadow-none min-h-[160px]"
            />
          </div>
          <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-6 py-4 md:px-8">
            <p className="text-sm font-serif italic text-muted-foreground hidden sm:block">
              Ficará salvo como rascunho até que seja publicado.
            </p>
            <Button 
              size="lg" 
              className="rounded-full px-8 w-full sm:w-auto font-medium"
              disabled={!title.trim() || create.isPending} 
              onClick={() => create.mutate()}
            >
              Criar rascunho
            </Button>
          </div>
        </Card>
      </section>

      <section className="space-y-6 pt-4 pb-12">
        {isLoading && (
          <div className="text-center py-16">
            <p className="font-serif text-lg italic text-muted-foreground animate-pulse">
              Carregando manuscritos…
            </p>
          </div>
        )}
        
        {posts?.length === 0 && (
          <div className="text-center py-20 opacity-80">
            <div className="mx-auto h-16 w-16 rounded-full bg-muted/40 mb-6 flex items-center justify-center">
              <span className="text-3xl opacity-40">✒️</span>
            </div>
            <p className="font-display text-2xl text-foreground font-medium">A página está em branco</p>
            <p className="mt-3 font-serif text-lg text-muted-foreground max-w-sm mx-auto">
              Nenhuma postagem foi criada ainda. Comece a redigir seu primeiro texto acima.
            </p>
          </div>
        )}

        {posts?.map((p) => {
          const author = (p as any).profiles || {};
          const isPublished = p.status === "published";
          const displayDate = p.published_at ? new Date(p.published_at) : new Date(p.created_at);
          const authorName = author.full_name || "Instituto Fraternidade";

          return (
            <article 
              key={p.id} 
              className="group relative flex flex-col gap-5 rounded-[20px] p-6 transition-colors duration-300 hover:bg-muted/30 md:-mx-8 md:p-8"
            >
              <div className="flex w-full items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <Avatar className="h-11 w-11 border border-border/50 bg-background shadow-xs">
                    <AvatarImage src={author.avatar_url} />
                    <AvatarFallback className="font-serif bg-transparent text-foreground">
                      {authorName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="font-sans font-semibold text-foreground text-sm tracking-tight">
                      {authorName}
                    </p>
                    <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground mt-0.5">
                      <span className="capitalize">{format(displayDate, "d 'de' MMM, yyyy", { locale: ptBR })}</span>
                      <span>·</span>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] font-bold uppercase tracking-widest h-5 px-1.5 border-transparent ${
                          isPublished 
                            ? "text-brand bg-brand/10" 
                            : "text-muted-foreground bg-muted-foreground/10"
                        }`}
                      >
                        {isPublished ? "Publicado" : "Rascunho"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="opacity-0 transition-opacity duration-200 group-hover:opacity-100 flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground rounded-full hover:bg-background shadow-none">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 rounded-xl">
                      <DropdownMenuItem onClick={() => toggle.mutate({ id: p.id, status: p.status })} className="py-2.5">
                        {isPublished ? (
                          <><Clock className="mr-2 h-4 w-4" /> Despublicar</>
                        ) : (
                          <><Globe className="mr-2 h-4 w-4" /> Publicar agora</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="py-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive" 
                        onClick={() => remove.mutate(p.id)}
                      >
                        <Trash className="mr-2 h-4 w-4" /> Excluir postagem
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="space-y-4 pt-1">
                <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-[32px] md:leading-tight transition-colors group-hover:text-brand">
                  {p.title}
                </h2>
                {p.content && (
                  <p className="line-clamp-4 font-serif text-[18px] leading-relaxed text-muted-foreground/90 whitespace-pre-wrap">
                    {p.content}
                  </p>
                )}
              </div>
              
              <div className="w-16 h-[2px] bg-border/60 mt-4 rounded-full" />
            </article>
          );
        })}
      </section>
    </div>
  );
}
