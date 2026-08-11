import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Filter } from 'lucide-react';
import { FUNNELS } from '@/lib/funnels';

const AdminFunnels: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Métricas de Funil</h1>
        <p className="text-muted-foreground">
          Acompanhe passo a passo o caminho de venda de cada estratégia.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FUNNELS.map((f) => (
          <div key={f.key} className="rounded-lg border p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">{f.name}</h2>
              </div>
              <a
                href={f.publicPath}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary inline-flex items-center gap-1 hover:underline shrink-0"
              >
                {f.publicPath} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="text-sm text-muted-foreground">{f.description}</p>
            <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-0.5">
              {f.steps.map((s) => (
                <li key={s.event}>{s.label}</li>
              ))}
            </ol>
            <Link
              to={`/admin/funis/${f.key}`}
              className="inline-flex text-sm font-medium text-primary hover:underline"
            >
              Ver métricas →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminFunnels;
