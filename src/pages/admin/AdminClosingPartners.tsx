import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminClosingPartners() {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin) return <Navigate to="/admin" replace />;

  return <div className="space-y-6">
    <div className="flex items-center gap-3">
      <FileText className="h-7 w-7 text-primary" />
      <div><h1 className="text-2xl font-bold sm:text-3xl">Fechamentos</h1>
        <p className="text-muted-foreground">Selecione o parceiro para consultar os demonstrativos e controlar os repasses.</p></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Link to="/admin/fechamentos/rand" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Card className="h-full transition-colors hover:border-primary">
          <CardHeader><CardTitle>RAND</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Vendas do pacote RAND, taxas, estornos e divisão dos repasses.</p>
            <span className="flex items-center gap-2 text-sm font-medium text-primary">Abrir fechamento <ArrowRight className="h-4 w-4" /></span>
          </CardContent>
        </Card>
      </Link>
    </div>
  </div>;
}
