import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Briefcase, Sparkles } from "lucide-react";

export default function CRMDashboard() {
  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display text-foreground">CRM</h1>
        <p className="text-sm font-body text-muted-foreground mt-1">
          Visão geral da jornada comercial. Use o menu lateral para acessar Cotações, Vendas e Pós-Venda.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Prospects & Leads", icon: Users },
          { title: "Cotações em andamento", icon: Briefcase },
          { title: "Vendas do mês", icon: TrendingUp },
          { title: "Pós-Venda ativo", icon: Sparkles },
        ].map(({ title, icon: Icon }) => (
          <Card key={title} className="border-dashed">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-body font-medium text-muted-foreground uppercase tracking-wide">
                {title}
              </CardTitle>
              <Icon size={16} className="text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-display text-foreground">—</p>
              <p className="text-[11px] font-body text-muted-foreground mt-1">A construir</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="border border-dashed border-border rounded-lg p-10 text-center space-y-2">
        <Sparkles className="mx-auto text-primary" size={28} />
        <p className="text-sm font-body text-foreground">Dashboard do CRM em construção.</p>
        <p className="text-xs font-body text-muted-foreground">
          Vamos definir juntos os indicadores e atalhos que aparecem aqui.
        </p>
      </div>
    </div>
  );
}
