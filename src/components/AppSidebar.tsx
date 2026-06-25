import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { canAccess } from "@/lib/permissions";
import logoAltivus from "@/assets/logo-altivus.png";
import logoSymbol from "@/assets/logo-altivus-symbol.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, Settings, Newspaper } from "lucide-react";
import { useChangelogUnseen } from "@/hooks/useChangelogUnseen";
import { useWaUnreadCount } from "@/hooks/useWaUnreadCount";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  url: string;
  icon: () => JSX.Element;
  group: number;
  nonNavigable?: boolean; // when true, clicking parent only toggles submenu
  subItems?: { title: string; url: string }[];
};

const navItems: NavItem[] = [
  // Group 1 — Operação principal
  {
    title: "Painel", url: "/", group: 1,
    icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  },
  {
    title: "Tarefas", url: "/tasks", group: 1,
    icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  },
  {
    title: "Clientes", url: "/clients", group: 1,
    icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M5 20c0-4 3.5-7 7-7s7 3 7 7" /></svg>,
  },

  // Group 2 — CRM (jornada comercial)
  {
    title: "CRM", url: "/crm", group: 2,
    icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    subItems: [
      { title: "Cotações", url: "/quotes" },
      { title: "Vendas", url: "/sales" },
      { title: "Pós-Venda", url: "/crm/ops?tab=ops" },
    ],
  },
  { title: "Roteiros", url: "/itineraries", group: 2, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z" /><path d="M9 4v13" /><path d="M15 7v13" /></svg> },
  { title: "Central de Atendimento", url: "/service-center", group: 2, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.56 12.56 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.56 12.56 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg> },
  { title: "Campanhas", url: "/campaigns", group: 2, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12L3 20l4-8-4-8 19 8z" /></svg> },
  { title: "Milhas", url: "/miles", group: 2, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L2 8.5l7 3.5 3.5 7L22 2z" /></svg> },

  // Group 3 — Financeiro
  {
    title: "Financeiro", url: "/finance", group: 3, nonNavigable: true,
    icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 17l4-4 4 4 4-6 4 2 4-4" /><path d="M2 21h20" /></svg>,
    subItems: [
      { title: "Dashboard Financeiro", url: "/finance/reports" },
      { title: "Extrato", url: "/finance" },
      { title: "Contas a Pagar", url: "/finance/payables" },
      { title: "Contas a Receber", url: "/finance/receivables" },
      { title: "Vendas Fechadas", url: "/finance/closed-sales" },
      { title: "Fornecedores", url: "/finance/suppliers" },
      { title: "Cadastros Financeiros", url: "/finance/registrations" },
    ],
  },

  // Group 4 — Configuração
  { title: "Cofre de Senhas", url: "/vault", group: 4, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> },
  { title: "Catálogo", url: "/catalog", group: 4, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.5" fill="currentColor" /></svg> },
  { title: "Cadastros", url: "/registrations", group: 4, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z" /><path d="M4 9h16" /><path d="M9 4v16" /></svg> },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { userRole } = useAuth();
  const location = useLocation();
  const { hasUnseen: changelogUnseen } = useChangelogUnseen();
  const waUnread = useWaUnreadCount();

  const visibleItems = navItems.filter((item) => canAccess(userRole, item.url));

  // Origem visual: quando o editor de Cotações é aberto a partir do CRM,
  // a sidebar deve continuar destacando "CRM" enquanto o usuário estiver em /quotes.
  const [quotesOrigin, setQuotesOrigin] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        const raw = sessionStorage.getItem("quotes:origin");
        if (!raw) { setQuotesOrigin(null); return; }
        const parsed = JSON.parse(raw) as { origin?: string; ts?: number };
        if (parsed?.origin && parsed?.ts && Date.now() - parsed.ts < 30 * 60_000) {
          setQuotesOrigin(parsed.origin);
        } else {
          sessionStorage.removeItem("quotes:origin");
          setQuotesOrigin(null);
        }
      } catch { setQuotesOrigin(null); }
    };
    read();
    const onChange = () => read();
    window.addEventListener("quotes:origin-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("quotes:origin-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [location.pathname, location.search]);

  // Limpa o contexto de origem se o usuário sair do /quotes para qualquer rota
  // que não seja a página de retorno ao card do CRM.
  useEffect(() => {
    if (location.pathname === "/quotes") return;
    if (location.pathname.startsWith("/crm/lead/")) return;
    try {
      if (sessionStorage.getItem("quotes:origin")) {
        sessionStorage.removeItem("quotes:origin");
        setQuotesOrigin(null);
      }
    } catch { /* ignore */ }
  }, [location.pathname]);

  // Caminho efetivo usado para destacar o item ativo na sidebar.
  // Se estiver em /quotes vindo do CRM, finge que o item ativo é o CRM.
  const effectivePath = location.pathname === "/quotes" && quotesOrigin === "crm"
    ? "/crm"
    : location.pathname;

  // Track which collapsibles are open. Auto-open whenever a parent or any of its
  // children matches the current route, while still letting the user toggle manually.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem("sidebar:openMap");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  });
  useEffect(() => {
    setOpenMap((prev) => {
      const next = { ...prev };
      for (const item of visibleItems) {
        if (!('subItems' in item) || !item.subItems?.length) continue;
        const isParentActive =
          effectivePath === item.url ||
          item.subItems.some((s) => effectivePath === s.url.split("?")[0]);
        if (isParentActive) next[item.title] = true;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePath, location.search]);
  useEffect(() => {
    try { localStorage.setItem("sidebar:openMap", JSON.stringify(openMap)); } catch { /* ignore */ }
  }, [openMap]);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/30 bg-gradient-to-b from-sidebar to-[hsl(220_55%_8%)]">
      <SidebarHeader className="p-2 border-b border-sidebar-border/30">
        <Link to="/" className="flex items-center justify-center py-1">
          {collapsed ? (
            <img src={logoSymbol} alt="Altivus" className="h-8 w-8 object-contain" />
          ) : (
            <img src={logoAltivus} alt="Altivus Turismo" className="w-full max-h-16 object-contain px-1" />
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2.5 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
            <TooltipProvider delayDuration={0}>
              {visibleItems.map((item, idx) => {
                const hasSubItems = 'subItems' in item && item.subItems && item.subItems.length > 0;
                const isParentActive = effectivePath === item.url || (hasSubItems && item.subItems!.some(s => effectivePath === s.url.split("?")[0]));
                const isItemActive = item.url === "/"
                  ? effectivePath === "/"
                  : effectivePath === item.url || effectivePath.startsWith(item.url + "/");
                const showDivider = false;
                const nonNavigable = !!item.nonNavigable;
                // Highlight parent only when parent is non-navigable and one of its
                // children is active (to mark the section visually), or when its own
                // route is active and it IS navigable.
                const parentHighlight = nonNavigable ? isParentActive : isItemActive;

                // Elegant active: subtle white-tinted bg + gold left accent bar; soft hover
                const linkBase = "relative flex items-center gap-3 px-3 text-sidebar-foreground/85 hover:bg-white/[0.04] hover:text-white transition-all duration-200 rounded-md";
                const linkActive = "bg-white/[0.06] text-white font-medium shadow-[inset_2px_0_0_0_hsl(var(--gold))] hover:bg-white/[0.08] hover:text-white";
                const activeBase = "data-[active=true]:bg-white/[0.06] data-[active=true]:text-white data-[active=true]:font-medium data-[active=true]:shadow-[inset_2px_0_0_0_hsl(var(--gold))]";

                const renderItem = () => {
                  if (hasSubItems && !collapsed) {
                    return (
                      <Collapsible
                        key={item.title}
                        open={openMap[item.title] ?? isParentActive}
                        onOpenChange={(o) => setOpenMap((p) => ({ ...p, [item.title]: o }))}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          {nonNavigable ? (
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                asChild
                                className={cn("h-9 rounded-md w-full p-0", activeBase)}
                                data-active={parentHighlight}
                              >
                                <button type="button" className={cn(linkBase, "w-full cursor-pointer", parentHighlight && linkActive)}>
                                  <item.icon />
                                  <span className="text-[13px] font-body flex-1 tracking-[0.01em] text-left">{item.title}</span>
                                  <ChevronRight size={13} className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-sidebar-foreground/50" />
                                </button>
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                          ) : (
                            <div className="flex items-center gap-0.5">
                              <SidebarMenuButton asChild className={cn("h-9 rounded-md flex-1", activeBase)} data-active={isItemActive}>
                                <Link to={item.url} className={cn(linkBase, isItemActive && linkActive)}>
                                  <item.icon />
                                  <span className="text-[13px] font-body flex-1 tracking-[0.01em]">{item.title}</span>
                                </Link>
                              </SidebarMenuButton>
                              <CollapsibleTrigger asChild>
                                <button className="h-7 w-7 flex items-center justify-center text-sidebar-foreground/50 hover:text-white transition-colors rounded-md hover:bg-white/[0.05]">
                                  <ChevronRight size={13} className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                </button>
                              </CollapsibleTrigger>
                            </div>
                          )}
                        </SidebarMenuItem>
                        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                          <ul className="mt-1 ml-[18px] pl-3 border-l border-sidebar-border/40 flex flex-col gap-0.5">
                            {item.subItems!.filter(s => canAccess(userRole, s.url.split("?")[0])).map((sub) => {
                              const [subPath, subQuery] = sub.url.split("?");
                              const isSubActive = effectivePath === subPath && (
                                subQuery ? location.search.includes(subQuery) : !location.search
                              );
                              return (
                                <li key={sub.title} className="relative">
                                  {isSubActive && (
                                    <span
                                      className="absolute -left-[13px] top-1/2 -translate-y-1/2 h-4 w-px bg-[hsl(var(--gold))]"
                                      aria-hidden
                                    />
                                  )}
                                  <Link
                                    to={sub.url}
                                    className={cn(
                                      "flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-[12px] font-body tracking-[0.01em] leading-snug transition-all duration-200",
                                      "text-sidebar-foreground/65 hover:bg-white/[0.04] hover:text-white",
                                      isSubActive && "bg-white/[0.06] text-white font-medium hover:bg-white/[0.08]"
                                    )}
                                  >
                                    {sub.url === "/changelog" && <Newspaper size={14} className="shrink-0" />}
                                    <span className="flex-1">{sub.title}</span>
                                    {sub.url === "/changelog" && changelogUnseen && (
                                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-label="Novas atualizações" />
                                    )}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.title}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton asChild className={cn("h-9 rounded-md", activeBase)} data-active={isItemActive}>
                            <Link to={item.url} className={cn(linkBase, isItemActive && linkActive)}>
                              <div className="relative">
                                <item.icon />
                                {collapsed && item.url === "/service-center" && waUnread > 0 && (
                                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center leading-none">
                                    {waUnread > 99 ? "99+" : waUnread}
                                  </span>
                                )}
                              </div>
                              {!collapsed && <span className="text-[13px] font-body tracking-[0.01em] flex-1">{item.title}</span>}
                              {!collapsed && item.url === "/service-center" && waUnread > 0 && (
                                <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none">
                                  {waUnread > 99 ? "99+" : waUnread}
                                </span>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        {collapsed && (
                          <TooltipContent side="right" className="font-body">
                            {item.title}
                            {hasSubItems && (
                              <div className="mt-1 space-y-1">
                                {item.subItems!.filter(s => canAccess(userRole, s.url.split("?")[0])).map(s => (
                                  <Link key={s.url} to={s.url} className="block text-xs text-muted-foreground hover:text-foreground">
                                    {s.title}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </SidebarMenuItem>
                  );
                };

                return (
                  <div key={item.title}>
                    {showDivider && (
                      <div className="my-2.5 mx-3 h-px bg-gradient-to-r from-transparent via-sidebar-border/60 to-transparent" aria-hidden />
                    )}
                    {renderItem()}
                  </div>
                );
              })}
            </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {canAccess(userRole, "/system") && (
        <SidebarFooter className="px-2.5 py-3 border-t border-sidebar-border/30">
          <SidebarMenu className="gap-0.5">
            <TooltipProvider delayDuration={0}>
              <SidebarMenuItem>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      className={cn(
                        "h-9 rounded-md",
                        "data-[active=true]:bg-white/[0.06] data-[active=true]:text-white data-[active=true]:font-medium data-[active=true]:shadow-[inset_2px_0_0_0_hsl(var(--gold))]",
                      )}
                      data-active={effectivePath === "/system" || effectivePath.startsWith("/system/")}
                    >
                      <Link
                        to="/system"
                        className={cn(
                          "relative flex items-center gap-3 px-3 text-sidebar-foreground/85 hover:bg-white/[0.04] hover:text-white transition-all duration-200 rounded-md",
                          (effectivePath === "/system" || effectivePath.startsWith("/system/")) &&
                            "bg-white/[0.06] text-white font-medium shadow-[inset_2px_0_0_0_hsl(var(--gold))] hover:bg-white/[0.08] hover:text-white",
                        )}
                      >
                        <Settings size={20} strokeWidth={1.2} />
                        {!collapsed && (
                          <span className="text-[13px] font-body tracking-[0.01em]">Configurações</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right" className="font-body">
                      Configurações
                    </TooltipContent>
                  )}
                </Tooltip>
              </SidebarMenuItem>
            </TooltipProvider>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
