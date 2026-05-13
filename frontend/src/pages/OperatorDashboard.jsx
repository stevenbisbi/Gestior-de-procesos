import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dashboard } from '../lib/api';
import { Loading, ProcIcon, StatusBadge, PriorityTag } from '../components/Common';
import { PROCESS_ICONS, formatDateTime } from '../lib/utils';

const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 };
const sortByPriority = (a, b) =>
  (PRIORITY_ORDER[a.batch_priority] ?? 9) - (PRIORITY_ORDER[b.batch_priority] ?? 9);

const PRIORITY_RING = {
  alta:  'border-l-red-500',
  media: 'border-l-amber-500',
  baja:  'border-l-emerald-500',
};

export default function OperatorDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Dashboard.operatorTasks().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  const raw = data || {};
  const my_active = [...(raw.my_active || [])].sort(sortByPriority);
  const pending   = [...(raw.pending   || [])].sort(sortByPriority);
  const machines  = raw.machines || [];

  return (
    <div className="space-y-5">
      {/* Máquinas asignadas */}
      {machines.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {machines.map(m => (
            <span key={m.id} className="inline-flex items-center gap-1.5 bg-navy text-white px-3 py-1 rounded-full text-xs font-medium">
              {PROCESS_ICONS[m.process_type]} {m.name}
            </span>
          ))}
        </div>
      )}

      {/* Mis turnos activos */}
      {my_active.length > 0 && (
        <section>
          <SectionTitle>Mis turnos activos</SectionTitle>
          <div className="space-y-2">
            {my_active.map(rec => (
              <div key={rec.id}
                className={`bg-white border border-slate-200 rounded-xl p-3.5 border-l-4 ${PRIORITY_RING[rec.batch_priority] || 'border-l-amber-500'}`}>
                <div className="flex items-center gap-3">
                  <ProcIcon type={rec.process_type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-mono text-xs text-slate-400">{rec.batch_code || `#${rec.batch}`}</span>
                      <PriorityTag priority={rec.batch_priority} />
                    </div>
                    <div className="font-semibold">{rec.process_label}
                      {rec.product_name && <span className="text-sm text-slate-400 font-normal"> · {rec.product_name}</span>}
                    </div>
                    <ProgressLine record={rec} />
                    {rec.started_at && (
                      <div className="text-xs text-amber-600 mt-1">
                        ⏱ Iniciado: {formatDateTime(rec.started_at)}
                      </div>
                    )}
                  </div>
                  <StatusBadge status="in_process" />
                </div>

                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                  <Link to={rec.has_quality_check
                            ? `/calidad/ver/${rec.id}`
                            : `/calidad/nuevo/${rec.id}`}
                    className="btn btn-outline btn-sm flex-1 min-w-[100px]"
                    style={{ borderColor: rec.has_quality_check ? undefined : '#d97706' }}>
                    {rec.has_quality_check ? '🔍 Ver QC' : '+ Calidad (QC)'}
                  </Link>
                  <Link to={`/dimensional/${rec.id}/nueva`}
                    className="btn btn-outline btn-sm flex-1 min-w-[100px]">
                    📏 Medición
                  </Link>
                  <Link to={`/proceso/terminar/${rec.id}`}
                    className="btn btn-success btn-sm flex-1 min-w-[100px]">
                    ✔ Finalizar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Disponibles para iniciar / continuar */}
      {pending.length > 0 && (
        <section>
          <SectionTitle>Disponibles · ordenadas por prioridad</SectionTitle>
          <div className="space-y-2">
            {pending.map(rec => {
              const isPaused = rec.status === 'paused';
              return (
                <Link key={rec.id} to={`/proceso/iniciar/${rec.id}`}
                  className={`bg-white border rounded-xl p-3.5 flex items-center gap-3 hover:shadow-md transition border-l-4 border-slate-200
                    ${PRIORITY_RING[rec.batch_priority] || 'border-l-slate-300'}`}>
                  <ProcIcon type={rec.process_type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-mono text-xs text-slate-400">{rec.batch_code || `#${rec.batch}`}</span>
                      <PriorityTag priority={rec.batch_priority} />
                    </div>
                    <div className="font-semibold">{rec.process_label}
                      {rec.product_name && <span className="text-sm text-slate-400 font-normal"> · {rec.product_name}</span>}
                    </div>
                    <ProgressLine record={rec} />
                    {isPaused && rec.operator_data && (
                      <div className="text-xs text-blue-600 mt-1">
                        Último turno: {rec.operator_data.full_name}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {isPaused
                      ? <span className="badge bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">↻ Continuar</span>
                      : <span className="badge badge-blue">Iniciar</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {my_active.length === 0 && pending.length === 0 && (
        <div className="py-12 text-center text-slate-400">
          <div className="text-5xl mb-3">✅</div>
          <p className="font-semibold text-slate-600">Todo al día</p>
          <p className="text-sm mt-1">No tienes tareas pendientes para tus máquinas.</p>
        </div>
      )}

      {machines.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded text-sm">
          No tienes máquinas asignadas. Contacta al supervisor.
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function ProgressLine({ record }) {
  const { qty_done = 0, qty_assigned, qty_remaining, progress_pct = 0 } = record;
  const remaining = qty_remaining ?? Math.max(0, qty_assigned - qty_done);
  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span><strong className="text-slate-700">{qty_done.toLocaleString()}</strong> / {qty_assigned.toLocaleString()} uds</span>
        {remaining > 0 && <span className="text-blue-600 font-semibold">{remaining.toLocaleString()} restantes</span>}
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
             style={{ width: `${progress_pct}%` }}/>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
      <span className="h-px w-3 bg-slate-200" />
      {children}
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
