import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import UserManagement from "./UserManagement";
import Permissions from "./Permissions";
import AuditLogsTab from "@/components/system/AuditLogsTab";

export default function System() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "users";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">Sistema</h1>
          <p className="text-muted-foreground font-body mt-1 text-sm">Usuários, permissões e logs de auditoria.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="users" className="font-body">Usuários</TabsTrigger>
          <TabsTrigger value="permissions" className="font-body">Permissões</TabsTrigger>
          <TabsTrigger value="logs" className="font-body">Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <UserManagement embedded />
        </TabsContent>
        <TabsContent value="permissions" className="mt-4">
          <Permissions embedded />
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <AuditLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
