import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { canAccess } from "@/lib/permissions";
import logoAltivus from "@/assets/logo-altivus.png";
import logoSymbol from "@/assets/logo-altivus-symbol.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

type NavItem = {
  title: string;
  url: string;
  icon: () => JSX.Element;
  group: number;
  subItems?: { title: string; url: string }[];
};

const navItems: NavItem[] = [
  // Group 1 — Operação principal
  {
    title: "Painel", url: "/", group: 1,
    icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
    subItems: [
      { title: "Tarefas", url: "/tasks" },
    ],
  },
  { title: "Clientes", url: "/clients", group: 1, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M5 20c0-4 3.5-7 7-7s7 3 7 7" /></svg> },
  { title: "Cotações", url: "/quotes", group: 1, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" /><path d="M14 2v6h6" /><path d="M9 15h6" /><path d="M9 11h6" /></svg> },
  { title: "Vendas", url: "/sales", group: 1, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
  { title: "Roteiros", url: "/itineraries", group: 1, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z" /><path d="M9 4v13" /><path d="M15 7v13" /></svg> },

  // Group 2 — Relacionamento
  { title: "Campanhas", url: "/campaigns", group: 2, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12L3 20l4-8-4-8 19 8z" /></svg> },
  { title: "Central de Atendimento", url: "/service-center", group: 2, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.56 12.56 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.56 12.56 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg> },
  { title: "CRM", url: "/crm", group: 2, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },

  // Group 3 — Financeiro
  {
    title: "Financeiro", url: "/finance", group: 3,
    icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 17l4-4 4 4 4-6 4 2 4-4" /><path d="M2 21h20" /></svg>,
    subItems: [
      { title: "Cadastros Financeiros", url: "/finance/registrations" },
      { title: "Relatórios", url: "/finance/reports" },
    ],
  },
  { title: "Milhas", url: "/miles", group: 3, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L2 8.5l7 3.5 3.5 7L22 2z" /></svg> },

  // Group 4 — Configuração
  { title: "Cadastros", url: "/registrations", group: 4, icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z" /><path d="M4 9h16" /><path d="M9 4v16" /></svg> },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { userRole } = useAuth();
  const location = useLocation();

  const visibleItems = navItems.filter((item) => canAccess(userRole, item.url));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-3 border-b border-sidebar-border">
        <Link to="/" className="flex items-center justify-center">
          {collapsed ? (
            <img src={logoSymbol} alt="Altivus" className="h-8 w-8 object-contain" />
          ) : (
            <img src={logoAltivus} alt="Altivus Turismo" className="h-9 object-contain" />
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
            <TooltipProvider delayDuration={0}>
              {visibleItems.map((item, idx) => {
                const hasSubItems = 'subItems' in item && item.subItems && item.subItems.length > 0;
                const isParentActive = location.pathname === item.url || (hasSubItems && item.subItems!.some(s => location.pathname === s.url));
                const prev = visibleItems[idx - 1];
                const showDivider = !collapsed && prev && prev.group !== item.group;

                const activeBase = "data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium";
                const linkBase = "flex items-center gap-3 px-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors rounded-lg";
                const linkActive = "bg-primary/10 text-primary font-medium hover:bg-primary/15 hover:text-primary";

                const renderItem = () => {
                  if (hasSubItems && !collapsed) {
                    return (
                      <Collapsible key={item.title} defaultOpen={isParentActive} className="group/collapsible">
                        <SidebarMenuItem>
                          <div className="flex items-center">
                            <SidebarMenuButton asChild className={cn("h-10 rounded-lg flex-1", activeBase)}>
                              <NavLink to={item.url} end className={linkBase} activeClassName={linkActive}>
                                <item.icon />
                                <span className="text-[13px] font-body flex-1">{item.title}</span>
                              </NavLink>
                            </SidebarMenuButton>
                            <CollapsibleTrigger asChild>
                              <button className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-sidebar-accent">
                                <ChevronRight size={14} className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
                              </button>
                            </CollapsibleTrigger>
                          </div>
                        </SidebarMenuItem>
                        <CollapsibleContent>
                          <SidebarMenuSub className="gap-1">
                            {item.subItems!.filter(s => canAccess(userRole, s.url)).map((sub) => (
                              <SidebarMenuSubItem key={sub.title}>
                                <SidebarMenuSubButton asChild>
                                  <NavLink to={sub.url} className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors rounded-md text-[12px] font-body" activeClassName="bg-primary/10 text-primary font-medium">
                                    {sub.title}
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.title}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton asChild className={cn("h-10 rounded-lg", activeBase)}>
                            <NavLink to={item.url} end={item.url === "/"} className={linkBase} activeClassName={linkActive}>
                              <item.icon />
                              {!collapsed && <span className="text-[13px] font-body">{item.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        {collapsed && (
                          <TooltipContent side="right" className="font-body">
                            {item.title}
                            {hasSubItems && (
                              <div className="mt-1 space-y-1">
                                {item.subItems!.filter(s => canAccess(userRole, s.url)).map(s => (
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
                      <div className="my-2 mx-2 border-t border-sidebar-border/50" aria-hidden />
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
    </Sidebar>
  );
}
