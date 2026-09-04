import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type ReactNode } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Clock, Edit3, Globe, ImagePlus, MoreHorizontal, Trash, X } from "lucide-react";

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

/* ---------- Renderização do conteúdo no estilo Substack ---------- */

function renderInline(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|==[^=]+==|~[^~]+~)/g;
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("==") && part.endsWith("==")) {
      return <mark key={index}>{part.slice(2, -2)}</mark>;
    }
    if (part.startsWith("~") && part.endsWith("~")) {
      return <small key={index}>{part.slice(1, -1)}</small>;
    }
    return part;
  });
}

function renderRichLines(content: string): ReactNode[] {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      const alt = image[1] || "";
      blocks.push(
        <figure key={`img-${index}`} className="stack-figure">
          <img src={image[2]} alt={alt} loading="lazy" />
          {alt && <figcaption>{renderInline(alt)}</figcaption>}
        </figure>
      );
      return;
    }

    const custom = line.match(/^\[\[(pullquote|epigraph|dropcap|sidenote|caption|small)\]\](?:\s*)(.*)$/);
    if (custom) {
      const type = custom[1];
      const body = custom[2];

      if (type === "epigraph") {
        const dash = body.match(/^(.*?)\s*(?:—|--)\s*(.*)$/);
        const quote = dash ? dash[1].trim() : body;
        const source = dash ? dash[2].trim() : "";
        blocks.push(
          <figure key={`block-${index}`} className="stack-epigraph">
            <blockquote>{renderInline(quote)}</blockquote>
            {source && <figcaption>— {renderInline(source)}</figcaption>}
          </figure>
        );
        return;
      }

      if (type === "pullquote") {
        blocks.push(
          <blockquote key={`block-${index}`} className="stack-pullquote">
            {renderInline(body)}
          </blockquote>
        );
        return;
      }

      if (type === "dropcap") {
        blocks.push(
          <p key={`block-${index}`} className="stack-dropcap">
            {renderInline(body)}
          </p>
        );
        return;
      }

      if (type === "sidenote") {
        blocks.push(
          <aside key={`block-${index}`} className="stack-sidenote">
            <span className="stack-sidenote-label">Nota</span>
            <div>{renderInline(body)}</div>
          </aside>
        );
        return;
      }

      if (type === "caption") {
        blocks.push(
          <p key={`block-${index}`} className="stack-caption">
            {renderInline(body)}
          </p>
        );
        return;
      }

      if (type === "small") {
        blocks.push(
          <p key={`block-${index}`} className="stack-small">
            {renderInline(body)}
          </p>
        );
        return;
      }

      return;
    }

    if (line.startsWith(">")) {
      blocks.push(
        <blockquote key={`quote-${index}`} className="stack-quote">
          {renderInline(line.replace(/^>\s?/, ""))}
        </blockquote>
      );
      return;
    }

    blocks.push(<p key={`p-${index}`}>{renderInline(line)}</p>);
  });

  return blocks;
}

function contentExcerpt(raw: string): string {
  return raw
    .replace(/^!\[([^\]]*)\]\([^)]*\)$/gm, (_, caption: string) => ` ${caption || ""} `)
    .replace(/^\[\[(pullquote|epigraph|dropcap|sidenote|caption|small)\]\]\s?/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/(\*\*|==|~)/g, "")
    .replace(/[\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------- Helpers do editor ---------- */

type BlockKind = "quote" | "pullquote" | "dropcap" | "epigraph" | "sidenote" | "caption" | "small";

const BLOCK_ACTIONS: { kind: BlockKind; label: string }[] = [
  { kind: "quote", label: "Citação" },
  { kind: "pullquote", label: "Pull quote" },
  { kind: "dropcap", label: "Drop cap" },
  { kind: "epigraph", label: "Epígrafe" },
  { kind: "sidenote", label: "Sidenote" },
  { kind: "caption", label: "Legenda" },
  { kind: "small", label: "Texto menor" },
];

type DraftState = {
  id: string | null;
  title: string;
  subtitle: string;
  cover_image_url: string;
  content: string;
};

const emptyDraft = (): DraftState => ({
  id: null,
  title: "",
  subtitle: "",
  cover_image_url: "",
  content: "",
});

function SitePostsPage() {
  const qc = useQueryClient();
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<DraftState>(emptyDraft());
  const [mode, setMode] = useState<"write" | "preview">("write");

  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageTarget, setImageTarget] = useState<"body" | "cover">("body");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageCaption, setImageCaption] = useState("");
  const [imageUploading, setImageUploading] = useState(false);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["site-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_posts")
        .select(`
          id,
          title,
          subtitle,
          cover_image_url,
          content,
          status,
          published_at,
          created_at,
          profiles (full_name, avatar_url)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from("site_posts")
          .select("id, title, subtitle, cover_image_url, content, status, published_at, created_at, author_id")
          .order("created_at", { ascending: false });
        if (fallbackErr) throw fallbackErr;
        return fallbackData ?? [];
      }
      return data ?? [];
    },
  });

  const saveDraft = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const payload: Record<string, unknown> = {
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim() || null,
        cover_image_url: draft.cover_image_url || null,
        content: draft.content,
        status: "draft",
      };
      if (session?.user?.id && !draft.id) {
        payload.author_id = session.user.id;
      }

      if (draft.id) {
        const { error } = await supabase
          .from("site_posts")
          .update(payload)
          .eq("id", draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_posts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(draft.id ? "Alterações salvas." : "Rascunho criado.");
      setDraft(emptyDraft());
      setMode("write");
      qc.invalidateQueries({ queryKey: ["site-posts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar a postagem."),
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

  /* ---------- Ações do editor ---------- */

  const insertAtCursor = (marker: string) => {
    const el = contentRef.current;
    if (!el) return;

    const { value, selectionStart, selectionEnd } = el;
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    const before = value.slice(0, start);
    const after = value.slice(end);
    const prefix = before && !before.endsWith("\n") ? "\n" : "";
    const suffix = after && !after.startsWith("\n") ? "\n" : "";
    const next = `${before}${prefix}${marker}${suffix}${after}`;

    setDraft((d) => ({ ...d, content: next }));
    requestAnimationFrame(() => {
      el.focus();
      const caret = before.length + prefix.length + marker.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const toggleInline = (marker: string, sample: string) => {
    const el = contentRef.current;
    if (!el) return;

    const { value, selectionStart, selectionEnd } = el;
    const selected = value.slice(selectionStart, selectionEnd);
    const target = selected || sample;
    const nextValue = `${value.slice(0, selectionStart)}${marker}${target}${marker}${value.slice(selectionEnd)}`;

    setDraft((d) => ({ ...d, content: nextValue }));
    requestAnimationFrame(() => {
      el.focus();
      const start = selectionStart + marker.length;
      el.setSelectionRange(start, start + target.length);
    });
  };

  const toggleBlock = (kind: BlockKind) => {
    const el = contentRef.current;
    if (!el) return;

    const { value, selectionStart, selectionEnd } = el;
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    let lineEnd = value.indexOf("\n", selectionEnd);
    if (lineEnd === -1) lineEnd = value.length;

    const currentLine = value.slice(lineStart, lineEnd);
    const prefix = kind === "quote" ? ">" : `[[${kind}]]`;
    let nextLine = currentLine;

    const hasPrefix =
      kind === "quote"
        ? currentLine.trim().startsWith(">")
        : currentLine.includes(prefix);

    if (hasPrefix) {
      nextLine =
        kind === "quote"
          ? currentLine.replace(/^\s*>\s?/, "")
          : currentLine.replace(new RegExp(`\\[\\[${kind}\\]\\]\\s?`), "");
    } else {
      nextLine = currentLine ? `${prefix} ${currentLine}` : `${prefix} `;
    }

    const nextContent = `${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`;
    setDraft((d) => ({ ...d, content: nextContent }));

    requestAnimationFrame(() => {
      const start = lineStart + (hasPrefix ? 0 : prefix.length + (nextLine ? 1 : 0));
      el.focus();
      el.setSelectionRange(start, start + (hasPrefix ? nextLine.length : nextLine.length - (prefix ? prefix.length + 1 : 0)));
    });
  };

  const uploadImageToBucket = async (file: File) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("Sessão expirada. Entre novamente.");

    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `site-posts/${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const { error } = await supabase.storage
      .from("uploads")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;

    const { data: publicUrl } = supabase.storage.from("uploads").getPublicUrl(path);
    return publicUrl.publicUrl;
  };

  const handleImageFileChange = (file: File | null) => {
    if (!file) {
      setImageFile(null);
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("As imagens precisam ter no máximo 6 MB.");
      setImageFile(null);
      return;
    }
    setImageFile(file);
  };

  const openImageDialog = (target: "body" | "cover") => {
    setImageTarget(target);
    setImageFile(null);
    setImageCaption("");
    setImageDialogOpen(true);
  };

  const confirmImageUpload = async () => {
    if (!imageFile) {
      toast.error("Escolha uma imagem para continuar.");
      return;
    }

    setImageUploading(true);
    try {
      const url = await uploadImageToBucket(imageFile);
      if (imageTarget === "cover") {
        setDraft((d) => ({ ...d, cover_image_url: url }));
        toast.success("Imagem de capa definida.");
      } else {
        const caption = imageCaption.trim();
        insertAtCursor(`![${caption || "Imagem"}](${url})`);
        toast.success("Imagem inserida no texto.");
      }
      setImageDialogOpen(false);
      setImageFile(null);
      setImageCaption("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar imagem.");
    } finally {
      setImageUploading(false);
    }
  };

  const startEditing = (post: any) => {
    setDraft({
      id: post.id,
      title: post.title || "",
      subtitle: post.subtitle || "",
      cover_image_url: post.cover_image_url || "",
      content: post.content || "",
    });
    setMode("write");
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const canSave = draft.title.trim().length > 0 && !saveDraft.isPending;

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

      {/* ---------- Editor ---------- */}
      <section>
        <div ref={formRef} />
        <Card className="overflow-hidden border-border/60 shadow-sm focus-within:border-brand/40 focus-within:ring-4 focus-within:ring-brand/5">
          <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {draft.id ? "Editando postagem" : "Novo rascunho"}
            </p>
            <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background p-1">
              <button
                type="button"
                onClick={() => setMode("write")}
                className={cn(
                  "rounded-full px-3.5 py-1 text-xs font-medium transition-colors",
                  mode === "write" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Escrever
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={cn(
                  "rounded-full px-3.5 py-1 text-xs font-medium transition-colors",
                  mode === "preview" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Visualizar
              </button>
            </div>
          </div>

          {mode === "write" ? (
            <>
              {draft.cover_image_url && (
                <div className="relative border-b border-border/40">
                  <img
                    src={draft.cover_image_url}
                    alt="Capa da postagem"
                    className="max-h-72 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, cover_image_url: "" }))}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-destructive"
                    title="Remover capa"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="space-y-4 p-6 md:p-8">
                <Input
                  placeholder="Título da publicação"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  className="border-0 bg-transparent px-0 font-display text-3xl font-medium placeholder:text-muted-foreground/40 focus-visible:ring-0 shadow-none h-auto py-1"
                />

                <div className="flex items-start gap-2 border-b border-border/30 pb-1">
                  <span className="pt-2 font-serif text-sm italic text-muted-foreground/70 select-none">✦</span>
                  <Input
                    placeholder="Linha fina / subtítulo…"
                    value={draft.subtitle}
                    onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))}
                    className="border-0 bg-transparent px-0 font-serif text-lg italic text-muted-foreground placeholder:text-muted-foreground/40 focus-visible:ring-0 shadow-none h-auto py-2"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1 pt-3">
                  <span className="mr-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Estilos</span>
                  {BLOCK_ACTIONS.map((action) => (
                    <button
                      key={action.kind}
                      type="button"
                      onClick={() => toggleBlock(action.kind)}
                      className="h-7 rounded-full border border-border/60 bg-background px-2.5 font-sans text-xs text-muted-foreground transition-colors hover:border-brand/30 hover:bg-brand-soft hover:text-foreground"
                    >
                      {action.label}
                    </button>
                  ))}
                  <Separator orientation="vertical" className="mx-1 h-5" />
                  <button
                    type="button"
                    onClick={() => toggleInline("==", "texto destacado")}
                    className="h-7 rounded-full px-2.5 font-sans text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="Destacar texto selecionado"
                  >
                    Destaque
                  </button>
                  <Separator orientation="vertical" className="mx-1 h-5" />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => openImageDialog("body")}
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    Imagem
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => openImageDialog("cover")}
                  >
                    Capa
                  </Button>
                </div>

                <Textarea
                  ref={contentRef}
                  rows={12}
                  placeholder={`Comece a escrever…\n\nUse os botões acima para inserir pull quotes, citações, epígrafes, drop caps, legendas e textos menores.`}
                  value={draft.content}
                  onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                  className="mt-2 resize-y border-0 bg-transparent px-0 font-serif text-xl leading-relaxed placeholder:text-muted-foreground/40 focus-visible:ring-0 shadow-none min-h-[280px]"
                />
              </div>
            </>
          ) : (
            <div className="stack-body px-6 py-10 md:px-12">
              {draft.cover_image_url && (
                <figure className="stack-figure">
                  <img src={draft.cover_image_url} alt="Capa da postagem" />
                </figure>
              )}
              {draft.title && <h1 className="font-display text-4xl font-bold tracking-tight text-foreground md:text-[42px] md:leading-tight">{draft.title}</h1>}
              {draft.subtitle && <p className="stack-deck">{draft.subtitle}</p>}
              {draft.content ? (
                renderRichLines(draft.content)
              ) : (
                <p className="font-serif text-lg italic text-muted-foreground">
                  O conteúdo ainda está vazio. Volte para o modo Escrever e comece a digitar.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-6 py-4 md:px-8">
            <p className="hidden font-serif text-sm italic text-muted-foreground sm:block">
              {draft.id ? "As alterações são salvas como rascunho." : "Ficará salvo como rascunho até que seja publicado."}
            </p>
            <Button
              size="lg"
              className="w-full rounded-full px-8 font-medium sm:w-auto"
              disabled={!canSave}
              onClick={() => saveDraft.mutate()}
            >
              {draft.id ? "Salvar alterações" : "Criar rascunho"}
            </Button>
          </div>
        </Card>
      </section>

      {/* ---------- Lista de publicações ---------- */}
      <section className="space-y-6 pt-4 pb-12">
        {isLoading && (
          <div className="py-16 text-center">
            <p className="animate-pulse font-serif text-lg italic text-muted-foreground">
              Carregando manuscritos…
            </p>
          </div>
        )}

        {!isLoading && posts?.length === 0 && (
          <div className="py-20 text-center opacity-80">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted/40">
              <span className="text-3xl opacity-40">✒️</span>
            </div>
            <p className="font-display text-2xl font-medium text-foreground">A página está em branco</p>
            <p className="mx-auto mt-3 max-w-sm font-serif text-lg text-muted-foreground">
              Nenhuma postagem foi criada ainda. Comece a redigir seu primeiro texto acima.
            </p>
          </div>
        )}

        {posts?.map((p) => {
          const author = (p as any).profiles || {};
          const isPublished = p.status === "published";
          const displayDate = p.published_at ? new Date(p.published_at) : new Date(p.created_at);
          const authorName = author.full_name || "Instituto Fraternidade";
          const excerpt = p.content ? contentExcerpt(p.content) : "";

          return (
            <article
              key={p.id}
              className="group relative flex flex-col gap-5 rounded-[20px] p-6 transition-colors duration-300 hover:bg-muted/30 md:-mx-8 md:p-8"
            >
              <div className="flex w-full items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <Avatar className="h-11 w-11 border border-border/50 bg-background shadow-xs">
                    <AvatarImage src={author.avatar_url} />
                    <AvatarFallback className="border-transparent bg-transparent font-serif text-foreground">
                      {authorName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="font-sans text-sm font-semibold tracking-tight text-foreground">{authorName}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <span className="capitalize">{format(displayDate, "d 'de' MMM, yyyy", { locale: ptBR })}</span>
                      <span>·</span>
                      <Badge
                        variant="outline"
                        className={`h-5 border-transparent px-1.5 text-[10px] font-bold uppercase tracking-widest ${
                          isPublished ? "bg-brand/10 text-brand" : "bg-muted-foreground/10 text-muted-foreground"
                        }`}
                      >
                        {isPublished ? "Publicado" : "Rascunho"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground shadow-none hover:bg-background">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl">
                      <DropdownMenuItem className="py-2.5" onClick={() => startEditing(p)}>
                        <Edit3 className="mr-2 h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="py-2.5"
                        onClick={() => toggle.mutate({ id: p.id, status: p.status })}
                      >
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

              <div className="space-y-3 pt-1">
                <h2 className="font-display text-3xl font-bold tracking-tight text-foreground transition-colors group-hover:text-brand md:text-[32px] md:leading-tight">
                  {p.title}
                </h2>
                {!!p.subtitle && (
                  <p className="stack-deck max-w-2xl">{p.subtitle}</p>
                )}
                {!!p.cover_image_url && (
                  <div className="overflow-hidden rounded-2xl border border-border/40 pt-4">
                    <img src={p.cover_image_url} alt={p.title} className="max-h-80 w-full object-cover" loading="lazy" />
                  </div>
                )}
                {excerpt && (
                  <p className="line-clamp-4 font-serif text-[18px] leading-relaxed text-muted-foreground/90">
                    {excerpt}
                  </p>
                )}
              </div>

              <div className="mt-4 h-[2px] w-16 rounded-full bg-border/60" />
            </article>
          );
        })}
      </section>

      {/* ---------- Dialog de upload de imagem ---------- */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {imageTarget === "cover" ? "Imagem de capa" : "Inserir imagem no texto"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-1">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Arquivo da imagem</p>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageFileChange(e.target.files?.[0] || null)}
                className="cursor-pointer file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:text-foreground"
              />
              <p className="text-xs text-muted-foreground">JPG ou PNG, até 6&nbsp;MB.</p>
            </div>

            {imageTarget === "body" && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Legenda (opcional)</p>
                <Input
                  placeholder="Legenda exibida sob a imagem…"
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                />
              </div>
            )}

            <Button
              className="w-full rounded-full"
              disabled={!imageFile || imageUploading}
              onClick={confirmImageUpload}
            >
              {imageUploading
                ? "Enviando…"
                : imageTarget === "cover"
                  ? "Definir como capa"
                  : "Fazer upload e inserir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
