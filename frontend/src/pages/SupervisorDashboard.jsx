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
              <div className="text-[11px] text-slate-400 mt-0.5">Turnos activos</div>
              <div className="grid grid-cols-2 gap-1 text-xs text-slate-600 pt-2 mt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span>Pausados</span>
                  <strong className="font-mono text-blue-600">{s.paused || 0}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Terminados</span>
                  <strong className="font-mono text-emerald-600">{s.finished}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="stat-card">
          <div className="stat-num text-amber-600">{stats.waiting_material || 0}</div>
          <div className="stat-label">Esperando material</div>
          <div className="stat-sub">Sin recibir aún</div>
        </div>
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
                  <th className="px-4 py-2.5 text-left font-semibold">Producto</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Cant.</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Prioridad</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Estado</th>
                  <th className="px-4 py-2.5 text-left font-semibold min-w-[200px]">Proceso actual</th>
                  <th className="px-4 py-2.5 text-left font-semibold min-w-[130px]">Avance total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {batches.map(b => <BatchRow key={b.id} b={b} />)}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-400 flex gap-3 flex-wrap">
        <span>● En canasta</span>
        <span className="text-amber-600">● En proceso</span>
        <span className="text-blue-600">● Pausado (turno cerrado)</span>
        <span className="text-emerald-600">● Terminado</span>
      </div>
    </div>
  );
}

// ── Fila del lote con detalle del proceso actual ─────────────────────────────
function BatchRow({ b }) {
  const cp = b.current_process;
  const statusBadgeCls = {
    waiting_material: 'badge-amber',
    in_basket:        'badge-blue',
    in_process:       'badge-amber',
    finished:         'badge-green',
    dispatched:       'badge-gray',
  }[b.status] || 'badge-gray';

  const procStatusBadge = cp && {
    in_process: { cls: 'bg-amber-100 text-amber-700', label: 'Activo'   },
    paused:     { cls: 'bg-blue-100  text-blue-700',  label: 'Pausado'  },
    pending:    { cls: 'bg-slate-100 text-slate-500', label: 'Pendiente' },
  }[cp.status];

  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-3 font-mono text-xs">{b.batch_code}</td>
      <td className="px-4 py-3">
        <div className="font-semibold text-sm text-slate-800">{b.product_name}</div>
        <div className="text-[11px] text-slate-400">{b.tube_label} · {b.cut_length?.toFixed(0)} mm</div>
      </td>
      <td className="px-4 py-3 font-mono text-xs">{b.total_quantity?.toLocaleString()} uds</td>
      <td className="px-4 py-3">
        <span className={`priority-${b.priority} text-xs font-semibold`}>{b.priority_display}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`badge ${statusBadgeCls} badge-dot`}>{b.status_display}</span>
      </td>

      {/* Proceso actual con avance parcial */}
      <td className="px-4 py-3">
        {cp ? (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-slate-700">{cp.label}</span>
              {procStatusBadge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${procStatusBadge.cls}`}>
                  {procStatusBadge.label}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mb-1">
              <strong className="text-slate-700">{cp.qty_done?.toLocaleString()}</strong>
              <span className="text-slate-400"> / {cp.qty_assigned?.toLocaleString()}</span>
              {cp.qty_remaining > 0 && <span className="text-blue-600"> · faltan {cp.qty_remaining?.toLocaleString()}</span>}
            </div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden w-full">
              <div className={`h-full transition-all ${cp.status === 'paused' ? 'bg-blue-500' : 'bg-amber-500'}`}
                   style={{ width: `${cp.progress_pct || 0}%` }}/>
            </div>
            {cp.operator && (
              <div className="text-[10px] text-slate-400 mt-1">
                {cp.status === 'in_process' ? '👤 Activo: ' : '👤 Último turno: '}
                {cp.operator}
              </div>
            )}
          </div>
        ) : b.status === 'finished' ? (
          <span className="text-emerald-600 text-sm">✓ Listo para despacho</span>
        ) : (
          <span className="text-slate-400 text-sm">—</span>
        )}
      </td>

      {/* Avance total ponderado */}
      <td className="px-4 py-3 min-w-[120px]">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="font-mono font-semibold text-slate-700">{b.progress_pct}%</span>
        </div>
        <div className="progress-bar">
          <div className={`progress-fill ${b.progress_pct === 100 ? 'complete' : ''}`} style={{ width: `${b.progress_pct}%` }} />
        </div>
      </td>

      <td className="px-4 py-3">
        <Link to={`/lote/${b.id}`} className="btn btn-outline btn-sm">Ver</Link>
      </td>
    </tr>
  );
}
