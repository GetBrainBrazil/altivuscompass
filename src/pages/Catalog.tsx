import ProductsTab from "@/components/ProductsTab";

export default function Catalog() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Catálogo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Produtos reutilizáveis (hospedagem, experiências, seguros, transportes, cruzeiros e outros) que podem ser puxados para dentro de uma cotação.
        </p>
      </div>
      <ProductsTab />
    </div>
  );
}
