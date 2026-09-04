import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar, Headphones, Upload, ListChecks, UserCheck, ArrowRight,
  Settings, HeartHandshake, UserCircle, Users, GraduationCap, CalendarCheck,
  Package, ShoppingCart, Wrench, Banknote, ShieldCheck, History, Plus, Bell
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { countPendingMembers } from "@/lib/members.functions";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useMyAccess } from "@/components/app/AppShell";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { updateMyProfile } from "@/lib/me.functions";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

const ALL_SHORTCUTS = [
  { to: "/app/audios", label: "Biblioteca de áudios", icon: Headphones, accent: "var(--area-associado)" },
  { to: "/app/upload", label: "Enviar áudio", icon: Upload, need: "audio.upload", accent: "var(--area-associado)" },
  { to: "/app/trabalhos", label: "Agenda dos trabalhos", icon: Calendar, accent: "var(--area-associado)" },
  { to: "/app/notificacoes", label: "Notificações", icon: Bell, accent: "var(--area-associado)" },
  { to: "/app/casa", label: "Cuidar da casa", icon: HeartHandshake, accent: "var(--area-casa)" },
  { to: "/app/conta", label: "Minha conta e formação", icon: UserCircle, accent: "var(--area-conta)" },
  { to: "/app/perfil", label: "Meus dados", icon: Settings, accent: "var(--area-conta)" },
  { to: "/app/associados", label: "Gestão de associados", icon: Users, need: "member.manage", accent: "var(--area-associados)" },
  { to: "/app/associados/turmas", label: "Turmas e níveis", icon: GraduationCap, need: "class.manage", accent: "var(--area-associados)" },
  { to: "/app/admin/audios", label: "Gestão de áudios", icon: Headphones, need: "audio.edit_any", accent: "var(--area-audios)" },
  { to: "/app/revisao", label: "Revisão de transcrições", icon: ListChecks, need: "transcription.review", accent: "var(--area-audios)" },
  { to: "/app/acolhimento", label: "Controle de presença", icon: CalendarCheck, need: "attendance.manage", accent: "var(--area-acolhimento)" },
  { to: "/app/estoque", label: "Gestão de estoque", icon: Package, need: "stock.manage", accent: "var(--area-estoque)" },
  { to: "/app/compras", label: "Compras e pedidos", icon: ShoppingCart, need: "purchase.manage", accent: "var(--area-estoque)" },
  { to: "/app/manutencao", label: "Chamados da casa", icon: Wrench, need: "maintenance.manage", accent: "var(--area-manutencao)" },
  { to: "/app/financeiro", label: "Aprovações financeiras", icon: Banknote, need: "finance.view", accent: "var(--area-financeiro)" },
  { to: "/app/admin", label: "Admin Geral", icon: ShieldCheck, adminOnly: true, accent: "var(--area-admin)" },
  { to: "/app/admin/trabalhos", label: "Gerenciar trabalhos", icon: Calendar, need: "work.manage", accent: "var(--area-admin)" },
  { to: "/app/admin/listas", label: "Listas configuráveis", icon: ListChecks, need: "options.manage", accent: "var(--area-admin)" },
  { to: "/app/admin/logs", label: "Logs do sistema", icon: History, need: "logs.view", accent: "var(--area-admin)" },
  { to: "/app/admin/usuarios", label: "Acessos de usuários", icon: Users, need: "user.manage", accent: "var(--area-admin)" },
];

function Dashboard() {
  const { data: access } = useMyAccess();
  const queryClient = useQueryClient();
  const updateProfileFn = useServerFn(updateMyProfile);

  const can = (p?: string, adminOnly?: boolean) => {
    if (adminOnly) return !!access?.isAdmin;
    if (!p) return true;
    return !!access?.isAdmin || !!access?.permissions?.includes(p);
  };

  const canManageMembers = !!can("member.manage") || !!can("member.validate");

  const pendingFn = useServerFn(countPendingMembers);
  const { data: pending } = useQuery({
    queryKey: ["pending-members-count"],
    queryFn: () => pendingFn(),
    enabled: canManageMembers,
    staleTime: 30_000,
  });

  const { data: recentAudios } = useQuery({
    queryKey: ["dashboard", "recent-audios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audios")
        .select("id, title, status, published_at, audio_type, message_source")
        .order("published_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const { data: upcoming } = useQuery({
    queryKey: ["dashboard", "upcoming"],
    queryFn: async () => {
      const { data } = await supabase
        .from("works")
        .select("id, name, starts_at, location")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(3);
      return data ?? [];
    },
  });

  const rawShortcuts = (access?.profile as any)?.shortcuts as string[] | undefined;
  
  const defaultShortcuts = ["/app/audios", "/app/trabalhos", "/app/casa", "/app/conta"];
  const userShortcutsPaths = Array.isArray(rawShortcuts)
    ? rawShortcuts
    : defaultShortcuts;

  const availableOptions = ALL_SHORTCUTS.filter(s => can(s.need, s.adminOnly));
  const activeShortcuts = availableOptions.filter(s => userShortcutsPaths.includes(s.to)).slice(0, 6);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [tempSelected, setTempSelected] = useState<string[]>([]);

  useEffect(() => {
    if (dialogOpen) {
      setTempSelected(activeShortcuts.map(s => s.to));
    }
  }, [dialogOpen]);

  const toggleShortcut = (path: string) => {
    setTempSelected(prev => {
      if (prev.includes(path)) return prev.filter(p => p !== path);
      if (prev.length >= 6) {
        toast.error("Você pode escolher no máximo 6 atalhos.");
        return prev;
      }
      return [...prev, path];
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateProfileFn({ data: { shortcuts: tempSelected } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-access"] });
      toast.success("Acesso rápido salvo com sucesso.");
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || "Erro de conexão ao salvar atalhos.")
  });

  if (access?.isPending) return <Navigate to="/app/pendente" replace />;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Painel</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">
          Olá, {access?.profile?.full_name?.split(" ")[0] ?? "associado"}.
        </h1>
        <p className="mt-1 text-muted-foreground">
          Bem-vindo à área restrita do Instituto.
        </p>
      </div>

      {canManageMembers && (pending?.count ?? 0) > 0 && (
        <Link to="/app/associados">
          <Card className="flex flex-wrap items-center justify-between gap-3 border-brand/40 bg-brand-soft/40 p-5 transition-colors hover:bg-brand-soft/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Cadastros pendentes</p>
                <p className="text-xs text-muted-foreground">
                  Há associados aguardando validação da equipe.
                </p>
              </div>
            </div>
            <Badge>{pending?.count}</Badge>
          </Card>
        </Link>
      )}

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl text-foreground">Acesso Rápido</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:bg-accent/40 hover:text-foreground">
                <Settings className="h-4 w-4" /> Editar atalhos
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Personalizar Acesso Rápido</DialogTitle>
                <DialogDescription>
                  Escolha até 6 atalhos do menu lateral para aparecerem no topo do seu painel.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-2 max-h-[60vh] space-y-6 overflow-y-auto overflow-x-hidden p-1 pb-4 scrollbar-none">
                {Object.entries(
                  availableOptions.reduce((acc, opt) => {
                    const section = (opt as { section?: string }).section ?? "Atalhos";
                    if (!acc[section]) acc[section] = [];
                    acc[section].push(opt);
                    return acc;
                  }, {} as Record<string, typeof availableOptions>)
                ).map(([section, opts], idx) => (
                  <div key={section} className={idx > 0 ? "border-t border-border pt-4" : ""}>
                    <h4 className="mb-3 text-sm font-semibold tracking-tight text-muted-foreground">{section}</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {opts.map(opt => {
                        const isSelected = tempSelected.includes(opt.to);
                        return (
                          <div
                            key={opt.to}
                            onClick={() => toggleShortcut(opt.to)}
                            className={`group flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all ${
                              isSelected 
                                ? "bg-accent/30" 
                                : "border-border hover:border-foreground/30 hover:bg-accent/40"
                            }`}
                            style={isSelected ? { borderColor: opt.accent || 'var(--brand)', boxShadow: `0 0 0 1px ${opt.accent || 'var(--brand)'}` } : undefined}
                          >
                            <div 
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors"
                              style={
                                isSelected 
                                  ? { backgroundColor: opt.accent || 'hsl(var(--primary))', color: '#fff' } 
                                  : { backgroundColor: 'hsl(var(--accent))', color: opt.accent || 'hsl(var(--muted-foreground))' }
                              }
                            >
                              <opt.icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-medium transition-colors ${isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                                {opt.label}
                              </p>
                            </div>
                            <div className="shrink-0 px-1">
                              <Checkbox 
                                checked={isSelected} 
                                onCheckedChange={() => toggleShortcut(opt.to)} 
                                className="pointer-events-none" 
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {tempSelected.length} de 6 atalhos selecionados.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Salvando..." : "Salvar atalhos"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => {
            const shortcut = activeShortcuts[idx];
            if (shortcut) {
              return (
                <QuickAction
                  key={shortcut.to}
                  to={shortcut.to}
                  icon={shortcut.icon}
                  title={shortcut.label}
                  accent={shortcut.accent}
                />
              );
            }
            return (
              <button
                key={`empty-slot-${idx}`}
                type="button"
                onClick={() => setDialogOpen(true)}
                className="group flex h-24 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border p-2 transition-colors hover:border-brand/50 hover:bg-accent/40 sm:h-[72px] sm:flex-row sm:justify-start sm:gap-3 sm:p-4"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-muted-foreground transition-colors group-hover:bg-brand-soft group-hover:text-brand sm:h-10 sm:w-10">
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <span className="w-full line-clamp-2 text-center text-[11px] font-medium leading-[1.1] text-muted-foreground group-hover:text-foreground sm:block sm:truncate sm:text-left sm:text-sm sm:leading-normal">
                  Adicionar atalho
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-foreground">Seus áudios recentes</h2>
          <Link to="/app/audios" className="flex items-center gap-1 text-sm font-medium text-brand hover:underline">
            Ver mais <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {(recentAudios ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum áudio disponível ainda.</p>
          ) : recentAudios?.map((a) => (
            <Link key={a.id} to="/app/audios/$id" params={{ id: a.id }} className="block rounded-md border border-border p-3 hover:bg-accent/40">
              <p className="text-sm font-medium text-foreground">{a.title}</p>
              <p className="text-xs text-muted-foreground">
                {a.message_source ?? "—"} · {a.status === "ready" ? "Pronto" : a.status === "transcribing" ? "Transcrevendo…" : a.status}
              </p>
            </Link>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-foreground">Próximos encontros</h2>
        </div>
        <div className="mt-4 space-y-3">
          {(upcoming ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento agendado.</p>
          ) : upcoming?.map((w) => (
            <div key={w.id} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">{w.name}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(w.starts_at), "EEEE, d 'de' MMM · HH:mm", { locale: ptBR })}
                {w.location ? ` · ${w.location}` : ""}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function QuickAction({ to, icon: Icon, title, accent }: { to: string; icon: any; title: string; accent?: string }) {
  return (
    <Link 
      to={to as any} 
      className="group relative flex h-24 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-md border border-border p-2 transition-all hover:bg-accent/50 sm:h-[72px] sm:flex-row sm:justify-start sm:gap-3 sm:p-4"
    >
      {accent && (
        <>
          <div className="absolute left-0 top-0 h-[3px] w-full sm:hidden" style={{ backgroundColor: accent }} />
          <div className="absolute bottom-0 left-0 top-0 hidden w-[3px] sm:block" style={{ backgroundColor: accent }} />
        </>
      )}
      <div 
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-muted-foreground transition-transform group-hover:scale-110 sm:h-10 sm:w-10"
        style={accent ? { color: accent } : undefined}
      >
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <span className="w-full line-clamp-2 text-center text-[11px] font-medium leading-[1.1] text-foreground sm:block sm:truncate sm:text-left sm:text-sm sm:leading-normal">
        {title}
      </span>
    </Link>
  );
}
