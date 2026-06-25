import SuppliersTab from "@/components/SuppliersTab";

export default function Suppliers() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Fornecedores</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os fornecedores e parceiros utilizados nas operações financeiras e de viagem.
        </p>
      </div>
      <SuppliersTab />
    </div>
  );
}
