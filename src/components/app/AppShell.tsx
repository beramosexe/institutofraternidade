import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, Calendar, CalendarCheck, Headphones, Home, LogOut, Settings, ShoppingCart,
  Users as UsersIcon, History, ShieldCheck, PanelLeft, X, UserCircle, GraduationCap, Clock,
  Package, Wrench, Banknote, HeartHandshake, ListChecks,
} from "lucide-react";

import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccess } from "@/lib/me.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { countPendingMembers } from "@/lib/members.functions";
import { countUnreadNotifications } from "@/lib/notifications.functions";

export function useMyAccess() {
  const fn = useServerFn(getMyAccess);
  const { session } = useAuth();
  return useQuery({
    queryKey: ["my-access"],
    queryFn: () => fn(),
    enabled: !!session,
    staleTime: 60_000,
    retry: false,
  });
}

type NavItem = { to: string; label: string; icon: typeof Home; need?: string; adminOnly?: boolean };
type NavSection = { label: string; items: NavItem[]; comingSoon?: boolean; accent?: string };

const SECTIONS: NavSection[] = [
  {
    label: "Área do Associado",
    accent: "var(--area-associado)",
    items: [
      { to: "/app", label: "Painel", icon: Home },
      { to: "/app/audios", label: "Áudios", icon: Headphones },
      { to: "/app/trabalhos", label: "Agenda dos trabalhos", icon: Calendar },
      { to: "/app/notificacoes", label: "Notificações", icon: Bell },
    ],
  },
  {
    label: "Painel da Casa",
    accent: "var(--area-casa)",
    items: [
      { to: "/app/casa", label: "Cuidar da casa", icon: HeartHandshake },
    ],
  },
  {
    label: "Minha Conta",
    accent: "var(--area-conta)",
    items: [
      { to: "/app/conta", label: "Minha conta e formação", icon: UserCircle },
      { to: "/app/perfil", label: "Meus dados", icon: Settings },
    ],
  },
  {
    label: "Associados",
    accent: "var(--area-associados)",
    items: [
      { to: "/app/associados", label: "Gestão de associados", icon: UsersIcon, need: "member.manage" },
      { to: "/app/associados/turmas", label: "Turmas e níveis", icon: GraduationCap, need: "class.manage" },
    ],
  },
  {
    label: "Gestão Áudios e Revisão",
    accent: "var(--area-audios)",
    items: [
      { to: "/app/admin/audios", label: "Gestão de áudios", icon: Headphones, need: "audio.edit_any" },
      { to: "/app/revisao", label: "Revisão de transcrições", icon: ListChecks, need: "transcription.review" },
    ],
  },
  {
    label: "Acolhimento",
    accent: "var(--area-acolhimento)",
    items: [
      { to: "/app/acolhimento", label: "Controle de presença", icon: CalendarCheck, need: "attendance.manage" },
    ],
  },
  {
    label: "Estoque e Compras",
    accent: "var(--area-estoque)",
    items: [
      { to: "/app/estoque", label: "Gestão de estoque", icon: Package, need: "stock.manage" },
      { to: "/app/compras", label: "Compras e pedidos", icon: ShoppingCart, need: "purchase.manage" },
    ],
  },
  {
    label: "Manutenção",
    accent: "var(--area-manutencao)",
    items: [
      { to: "/app/manutencao", label: "Chamados da casa", icon: Wrench, need: "maintenance.manage" },
    ],
  },
  {
    label: "Financeiro",
    accent: "var(--area-financeiro)",
    items: [
      { to: "/app/financeiro", label: "Aprovações financeiras", icon: Banknote, need: "finance.view" },
    ],
  },
  { label: "Mídias", accent: "var(--area-midias)", items: [], comingSoon: true },
  {
    label: "Administração",
    accent: "var(--area-admin)",
    items: [
      { to: "/app/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
      { to: "/app/admin/trabalhos", label: "Gestão dos trabalhos e eventos", icon: Calendar, need: "work.manage" },
      { to: "/app/admin/listas", label: "Listas configuráveis", icon: ListChecks, need: "options.manage" },
      { to: "/app/admin/logs", label: "Logs", icon: History, need: "logs.view" },
      { to: "/app/admin/usuarios", label: "Usuários", icon: UsersIcon, need: "user.manage" },
    ],
  },
];



export function AppShell({ children }: { children: ReactNode }) {
  const { data: access, isLoading } = useMyAccess();
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const canManageMembers =
    !!access?.isAdmin ||
    (access?.permissions ?? []).some((p) => p === "member.manage" || p === "member.validate");
  const pendingFn = useServerFn(countPendingMembers);
  const { data: pendingMembers } = useQuery({
    queryKey: ["pending-members-count"],
    queryFn: () => pendingFn(),
    enabled: canManageMembers,
    staleTime: 30_000,
    retry: false,
  });

  const unreadFn = useServerFn(countUnreadNotifications);
  const { data: unread } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => unreadFn(),
    enabled: !!access,
    staleTime: 30_000,
    retry: false,
  });


  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isPending = !!access?.isPending;

  const PENDING_SECTIONS: NavSection[] = [
    {
      label: "Geral",
      items: [
        { to: "/app/pendente", label: "Cadastro em análise", icon: Clock },
        { to: "/app/perfil", label: "Meus dados", icon: Settings },
      ],
    },
  ];

  const can = (item: NavItem) => {
    if (item.adminOnly) return !!access?.isAdmin;
    if (!item.need) return true;
    return (access?.permissions ?? []).includes(item.need) || !!access?.isAdmin;
  };

  const isActive = (to: string) => {
    if (to === "/app") return path === "/app";
    if (to === "/app/admin") return path === "/app/admin";
    if (to === "/app/associados") return path === "/app/associados";
    return path === to || path.startsWith(`${to}/`);
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="space-y-4">
      {(isPending ? PENDING_SECTIONS : SECTIONS).map((section) => {
        const items = section.items.filter(can);
        if (items.length === 0 && !section.comingSoon) return null;
        const accent = section.accent ?? "var(--area-associado)";
        return (
          <div key={section.label} className="pl-2.5" style={{ borderLeft: `2px solid ${accent}` }}>
            <div
              className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: accent }}
            >
              {section.label}
            </div>
            {items.length === 0 ? (
              <div className="px-2.5 pb-1 text-xs italic text-sidebar-foreground/45">Em breve</div>
            ) : (
              <div className="space-y-0.5">
                {items.map((i) => {
                  const Icon = i.icon;
                  const active = isActive(i.to);
                  return (
                    <Link
                      key={i.to}
                      to={i.to}
                      onClick={onClick}
                      className={[
                        "relative flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors md:min-h-9",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      ].join(" ")}
                    >
                      {active && (
                        <span
                          className="absolute inset-y-1 -left-[12px] w-[3px] rounded-full"
                          style={{ background: accent }}
                          aria-hidden
                        />
                      )}
                      <Icon className="h-4 w-4 shrink-0" style={active ? { color: accent } : undefined} />
                      <span className="min-w-0 flex-1 truncate">{i.label}</span>
                      {i.to === "/app/associados" && (pendingMembers?.count ?? 0) > 0 && (
                        <Badge className="shrink-0">{pendingMembers?.count}</Badge>
                      )}
                      {i.to === "/app/notificacoes" && (unread?.count ?? 0) > 0 && (
                        <Badge className="shrink-0">{unread?.count}</Badge>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );




  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop — menu de ferramentas */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <div className="border-b border-sidebar-border bg-sidebar-accent/40 px-4 py-3">
          <Link to="/app" className="flex items-center gap-2.5">
            <Logo variant="mark" className="h-12 w-12 shrink-0 ring-1 ring-sidebar-border" />
            <div className="min-w-0 leading-tight">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/60">
                Ferramentas
              </div>
              <div className="truncate text-sm font-medium text-sidebar-foreground">
                {access?.profile?.full_name ?? "Carregando…"}
              </div>
            </div>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3"><NavLinks /></div>
        <div className="border-t border-sidebar-border p-2.5">
          {access?.membershipStatus === "inactive" && (
            <div className="mb-2 px-1">
              <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
                Associado inativo
              </Badge>
            </div>
          )}

          <div className="flex gap-2">
            <Link to="/app/perfil" className="flex-1">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                <Settings className="h-4 w-4" /> Perfil
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sair" title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-top sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-3 backdrop-blur md:hidden">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-md text-blue-600 dark:text-blue-400"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <PanelLeft className="h-6 w-6" />}
          </button>
          <Link to="/app" className="flex items-center">
            <Logo variant="mark" className="h-10 w-10 shrink-0 ring-1 ring-border" />
          </Link>
          <div className="w-10" aria-hidden />
        </header>


        {/* Mobile drawer */}
        <div
          className={[
            "fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm transition-opacity md:hidden",
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
        <aside
          className={[
            "fixed inset-y-0 left-0 z-50 flex w-[86%] max-w-xs flex-col border-r border-sidebar-border bg-sidebar shadow-2xl transition-transform duration-200 md:hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="safe-top flex items-center gap-2.5 border-b border-sidebar-border bg-sidebar-accent/40 px-4 py-3">
            <Logo variant="mark" className="h-12 w-12 shrink-0 ring-1 ring-sidebar-border" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/60">
                Ferramentas
              </div>
              <div className="truncate text-sm font-medium text-sidebar-foreground">
                {access?.profile?.full_name ?? "Menu"}
              </div>
            </div>

            <button
              className="flex h-10 w-10 items-center justify-center rounded-md"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="scroll-momentum flex-1 overflow-y-auto px-3 py-4">
            <NavLinks onClick={() => setMobileOpen(false)} />
          </div>
          <div className="safe-bottom border-t border-sidebar-border p-3">
            {access?.membershipStatus === "inactive" && (
              <div className="mb-2 px-1">
                <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
                  Associado inativo
                </Badge>
              </div>
            )}
            <Button variant="ghost" onClick={signOut} className="h-11 w-full justify-start gap-2">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </aside>

        <main className="safe-bottom safe-x min-w-0 flex-1">
          {isLoading ? <div className="p-8 text-muted-foreground">Carregando…</div> : children}
        </main>
      </div>
    </div>
  );
}
