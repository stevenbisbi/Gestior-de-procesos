import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dashboard, Batches } from '../lib/api';
import { Loading } from '../components/Common';
import { PROCESS_LABELS, PROCESS_ICONS, formatDate } from '../lib/utils';

export default function SupervisorDashboard() {
  const [stats, setStats]     = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      Dashboard.supervisor(),
      Batches.list({ exclude_dispatched: '1' })
    ]).then(([s, b]) => {
      setStats(s); setBatches(b);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <div className="space-y-5">
      {/* Process cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(PROCESS_LABELS).map(([type, label]) => {
          const s = stats.process_stats[type];
          const colors = {
            corte:   'text-blue-600',
            chaflan: 'text-violet-600',
            moleteo: 'text-amber-600',
            curvado: 'text-emerald-600',
          };
          return (
            <div key={type} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base proc-${type}`}>
                  {PROCESS_ICONS[type]}
                </div>
              </div>
              <div className={`font-mono text-2xl font-medium leading-none ${colors[type]}`}>{s.in_process}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">En proceso</div>
              <div className="flex items-center justify-between text-xs text-slate-600 pt-2 mt-2 border-t border-slate-100">
                <span>Terminados</span>
                <strong className="font-mono text-emerald-600">{s.finished}</strong>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="stat-num text-blue-600">{stats.in_basket}</div>
          <div className="stat-label">En canasta</div>
          <div className="stat-sub">Listos para iniciar</div>
        </div>
        <div className="stat-card">
          <div className="stat-num text-amber-600">{stats.in_process}</div>
          <div className="stat-label">En proceso</div>
          <div className="stat-sub">Activos en máquinas</div>
        </div>
        <div className="stat-card">
          <div className="stat-num text-emerald-600">{stats.finished}</div>
          <div className="stat-label">Terminados</div>
          <div className="stat-sub">Listos para despacho</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{stats.total}</div>
          <div className="stat-label">Total en planta</div>
          <div className="stat-sub">Lotes activos</div>
        </div>
      </div>

      {/* Batch table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Todos los lotes en planta</span>
          <Link to="/nuevo-lote" className="btn btn-primary btn-sm">+ Nuevo lote</Link>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          {batches.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <div className="text-4xl mb-2">📦</div>
              <p>No hay lotes activos en planta.</p>
              <Link to="/nuevo-lote" className="btn btn-primary mt-3">Crear primer lote</Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Lote</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Referencia</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Producto</th>
                  <th className="px-4 py-2.5 text-left font-semibold">L. Corte</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Cant.</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Prioridad</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Estado</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Proceso</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Progreso</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {batches.map(b => (
                  <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{b.batch_code}</td>
                    <td className="px-4 py-3 text-xs">{b.tube_label}</td>
                    <td className="px-4 py-3 font-semibold">{b.product_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{b.cut_length?.toFixed(0)} mm</td>
                    <td className="px-4 py-3 font-mono text-xs">{b.total_quantity} uds</td>
                    <td className="px-4 py-3">
                      <span className={`priority-${b.priority} text-xs font-semibold`}>{b.priority_display}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${b.status === 'in_basket' ? 'badge-blue' : b.status === 'in_process' ? 'badge-amber' : 'badge-green'} badge-dot`}>
                        {b.status_display}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{b.current_process?.label || '—'}</td>
                    <td className="px-4 py-3 min-w-[100px]">
                      <div className="progress-bar"><div className={`progress-fill ${b.progress_pct === 100 ? 'complete' : ''}`} style={{ width: `${b.progress_pct}%` }} /></div>
                      <span className="text-[10px] text-slate-400">{b.progress_pct}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/lote/${b.id}`} className="btn btn-outline btn-sm">Ver</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-400 flex gap-3 flex-wrap">
        <span>● En canasta</span>
        <span className="text-amber-600">● En proceso</span>
        <span className="text-emerald-600">● Terminado</span>
      </div>
    </div>
  );
}
