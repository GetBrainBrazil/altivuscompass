import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { AgentEditDialog, type Agent } from "@/components/ai-agents/AgentEditDialog";

const INITIAL: Agent[] = [
  {
    id: "1",
    name: "Atendente Principal",
    model: "google/gemini-2.5-flash",
    active: true,
    tone: "amigavel",
    personality:
      "Você é o atendente principal da Altivus Turismo. Recepcione clientes com cordialidade e identifique rapidamente o tipo de demanda.",
    rules:
      "- Nunca compartilhe preços sem validação\n- Transfira para humano em reclamações\n- Não responda fora do escopo de viagens",
  },
  {
    id: "2",
    name: "Qualificador de Leads",
    model: "google/gemini-2.5-pro",
    active: true,
    tone: "consultivo",
    personality: "",
    rules: "",
  },
  {
    id: "3",
    name: "Pós-venda",
    model: "openai/gpt-5-mini",
    active: false,
    tone: "amigavel",
    personality: "",
    rules: "",
  },
];

export default function AIAgents() {
  const [agents, setAgents] = useState<Agent[]>(INITIAL);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const toggleStatus = (id: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a))
    );
  };

  const openEdit = (agent: Agent) => {
    setEditing(agent);
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing({
      id: crypto.randomUUID(),
      name: "",
      model: "google/gemini-2.5-flash",
      active: true,
      tone: "amigavel",
      personality: "",
      rules: "",
    });
    setDialogOpen(true);
  };

  const handleSave = (agent: Agent) => {
    setAgents((prev) => {
      const exists = prev.find((a) => a.id === agent.id);
      if (exists) return prev.map((a) => (a.id === agent.id ? agent : a));
      return [...prev, agent];
    });
  };

  return (
    <div className="min-h-screen bg-[hsl(220_15%_97%)]">
      <div className="max-w-[1400px] mx-auto px-8 py-10">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Agentes IA
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie seus agentes de inteligência artificial
            </p>
          </div>
          <Button
            className="bg-[hsl(220_45%_15%)] hover:bg-[hsl(220_45%_22%)] text-white h-10 px-5"
            onClick={openNew}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Agente
          </Button>
        </header>

        <div className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[hsl(220_15%_98%)] hover:bg-[hsl(220_15%_98%)] border-b border-border/60">
                <TableHead className="h-12 px-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Nome
                </TableHead>
                <TableHead className="h-12 px-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Modelo
                </TableHead>
                <TableHead className="h-12 px-6 text-xs font-medium uppercase tracking-wider text-muted-foreground w-32">
                  Status
                </TableHead>
                <TableHead className="h-12 px-6 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right w-32">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id} className="border-b border-border/40 last:border-0">
                  <TableCell
                    className="px-6 py-4 font-medium text-foreground cursor-pointer"
                    onClick={() => openEdit(agent)}
                  >
                    {agent.name}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <code className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground font-mono">
                      {agent.model}
                    </code>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={agent.active}
                        onCheckedChange={() => toggleStatus(agent.id)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {agent.active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(agent)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => toast.info(`Testar: ${agent.name}`)}
                      >
                        <FlaskConical className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {agents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-16 text-muted-foreground">
                    Nenhum agente cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AgentEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agent={editing}
        onSave={handleSave}
      />
    </div>
  );
}
