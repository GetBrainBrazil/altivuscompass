import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { canAccess } from "@/lib/permissions";
import logoAltivus from "@/assets/logo-altivus.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";

const allNav = [
  {
    group: "Principal",
    items: [
      { title: "Painel", url: "/", icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg> },
      { title: "Clientes", url: "/clients", icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M5 20c0-4 3.5-7 7-7s7 3 7 7" /></svg> },
      { title: "Cotações", url: "/quotes", icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" /><path d="M14 2v6h6" /><path d="M9 15h6" /><path d="M9 11h6" /></svg> },
    ],
  },
  {
    group: "Operações",
    items: [
      { title: "Campanhas", url: "/campaigns", icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12L3 20l4-8-4-8 19 8z" /></svg> },
      { title: "Financeiro", url: "/finance", icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 17l4-4 4 4 4-6 4 2 4-4" /><path d="M2 21h20" /></svg> },
      { title: "Milhas", url: "/miles", icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L2 8.5l7 3.5 3.5 7L22 2z" /></svg> },
    ],
  },
  {
    group: "Administração",
    items: [
      { title: "Usuários", url: "/users", icon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, userRole, signOut } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center justify-center">
          {collapsed ? (
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <span className="text-xs font-bold text-sidebar-primary-foreground font-display">A</span>
            </div>
          ) : (
            <img src={logoAltivus} alt="Altivus Turismo" className="h-10 object-contain" />
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        {allNav.map((section) => {
          const visibleItems = section.items.filter((item) => canAccess(userRole, item.url));
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={section.group} className="mt-4 first:mt-0">
              <SidebarGroupLabel className="text-[10px] tracking-widest uppercase text-sidebar-foreground/40 font-body px-3 mb-2">
                {section.group}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild className="h-10 rounded-lg">
                        <NavLink to={item.url} end={item.url === "/"} className="flex items-center gap-3 px-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors rounded-lg" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon />
                          {!collapsed && <span className="text-sm font-body">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <span className="text-xs font-medium text-sidebar-accent-foreground font-body">
              {user?.email?.[0]?.toUpperCase() ?? "U"}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-accent-foreground font-body truncate">{user?.email ?? ""}</p>
              <button onClick={signOut} className="text-[10px] text-sidebar-foreground/50 font-body hover:text-sidebar-foreground transition-colors">
                Sair
              </button>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
