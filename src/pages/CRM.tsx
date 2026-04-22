import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CRM() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">CRM</h1>
      <Card>
        <CardHeader>
          <CardTitle>Em desenvolvimento</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Este módulo está em construção. Em breve você terá acesso ao CRM completo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}