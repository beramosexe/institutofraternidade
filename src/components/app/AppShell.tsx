import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar, CalendarCheck, Headphones, Home, LogOut, Settings,
  Users as UsersIcon, History, ShieldCheck, Menu, X,
} from "lucide-react";

import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccess } from "@/lib/me.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

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
type NavSection = { label: string; items: NavItem[]; comingSoon?: boolean; labelColor?: string };

const SECTIONS: NavSection[] = [
  {
    label: "Geral",
    items: [
      { to: "/app", label: "Painel", icon: Home },
      { to: "/app/audios", label: "Áudios", icon: Headphones },
      { to: "/app/trabalhos", label: "Trabalhos", icon: Calendar },
    ],
  },
  {
    label: "Gestão Áudios e Revisão",
    labelColor: "text-blue-600",
    items: [
      { to: "/app/admin/audios", label: "Gestão de áudios", icon: Headphones, need: "audio.edit_any" },
    ],
  },
  {
    label: "Acolhimento",
    labelColor: "text-emerald-600",
    items: [
      { to: "/app/acolhimento", label: "Controle de presença", icon: CalendarCheck, need: "attendance.manage" },
    ],
  },
  { label: "Estoque", labelColor: "text-amber-600", items: [], comingSoon: true },
  { label: "Manutenção", labelColor: "text-slate-500", items: [], comingSoon: true },
  { label: "Financeiro", labelColor: "text-green-700", items: [], comingSoon: true },
  { label: "Mídias", labelColor: "text-violet-600", items: [], comingSoon: true },
  {
    label: "Administração",
    items: [
      { to: "/app/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
      { to: "/app/admin/trabalhos", label: "Gestão dos trabalhos e eventos", icon: Calendar, need: "work.manage" },
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

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const can = (item: NavItem) => {
    if (item.adminOnly) return !!access?.isAdmin;
    if (!item.need) return true;
    return (access?.permissions ?? []).includes(item.need) || !!access?.isAdmin;
  };

  const isActive = (to: string) => {
    if (to === "/app") return path === "/app";
    if (to === "/app/admin") return path === "/app/admin";
    return path === to || path.startsWith(`${to}/`);
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="space-y-5">
      {SECTIONS.map((section) => {
        const items = section.items.filter(can);
        if (items.length === 0 && !section.comingSoon) return null;
        return (
          <div key={section.label}>
            <div className={[
              "px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider",
              section.labelColor || "text-sidebar-foreground/80",
            ].join(" ")}>
              {section.label}
            </div>
            {items.length === 0 ? (
              <div className="px-3 py-1.5 text-xs italic text-sidebar-foreground/40">Em breve</div>
            ) : (
              <div className="space-y-1">
                {items.map((i) => {
                  const Icon = i.icon;
                  const active = isActive(i.to);
                  return (
                    <Link
                      key={i.to}
                      to={i.to}
                      onClick={onClick}
                      className={[
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 truncate">{i.label}</span>
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
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <div className="p-5"><Link to="/"><Logo /></Link></div>
        <div className="flex-1 px-3 py-2"><NavLinks /></div>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-3 text-xs text-sidebar-foreground/70 truncate">
            {access?.profile?.full_name ?? "Carregando…"}
          </div>
          <div className="flex gap-2">
            <Link to="/app/perfil" className="flex-1">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                <Settings className="h-4 w-4" /> Perfil
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:hidden">
          <Link to="/app"><Logo /></Link>
          <button
            className="rounded-md p-2"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>
        {mobileOpen && (
          <div className="border-b border-border bg-sidebar px-3 py-3 md:hidden">
            <NavLinks onClick={() => setMobileOpen(false)} />
            <Button variant="ghost" size="sm" onClick={signOut} className="mt-3 w-full justify-start gap-2">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        )}

        <main className="min-w-0 flex-1">
          {isLoading ? <div className="p-8 text-muted-foreground">Carregando…</div> : children}
        </main>
      </div>
    </div>
  );
}
