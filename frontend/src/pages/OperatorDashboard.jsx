import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dashboard } from '../lib/api';
import { Loading, ProcIcon, StatusBadge } from '../components/Common';
import { PROCESS_LABELS, PROCESS_ICONS, formatDateTime, formatDate } from '../lib/utils';

export default function OperatorDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Dashboard.operatorTasks().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  const { my_active = [], pending = [], machines = [] } = data || {};

  return (
    <div className="space-y-5">
      {machines.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {machines.map(m => (
            <span key={m.id} className="inline-flex items-center gap-1.5 bg-navy text-white px-3 py-1 rounded-full text-xs font-medium">
              {PROCESS_ICONS[m.process_type]} {m.name}
            </span>
          ))}
        </div>
      )}

      {my_active.length > 0 && (
  <section>
    <SectionTitle>En proceso ahora</SectionTitle>
    <div className="space-y-2">
      {my_active.map(rec => (
        <div key={rec.id}
          className="bg-white border border-slate-200 rounded-xl p-3.5 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3">
            <ProcIcon type={rec.process_type} />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs text-slate-400">Lote #{rec.batch}</div>
              <div className="font-semibold">{rec.process_label}</div>
              <div className="text-xs text-slate-500">{rec.qty_assigned} uds</div>
              {rec.started_at && (
                <div className="text-xs text-amber-600 mt-1">
                  ⏱ Iniciado: {formatDateTime(rec.started_at)}
                </div>
              )}
            </div>
            <StatusBadge status="in_process" />
          </div>

          {/* Acciones disponibles durante el proceso */}
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
              ✔ Terminar
            </Link>
          </div>
        </div>
      ))}
    </div>
  </section>
)}

      {pending.length > 0 && (
        <section>
          <SectionTitle>Disponibles para iniciar</SectionTitle>
          <div className="space-y-2">
            {pending.map(rec => (
              <Link key={rec.id} to={`/proceso/iniciar/${rec.id}`}
                className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3 hover:shadow-md transition">
                <ProcIcon type={rec.process_type} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-slate-400">Lote #{rec.batch}</div>
                  <div className="font-semibold">{rec.process_label}</div>
                  <div className="text-xs text-slate-500">{rec.qty_assigned} uds</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="badge badge-blue">Disponible</span>
                </div>
              </Link>
            ))}
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

function SectionTitle({ children }) {
  return (
    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
      <span className="h-px w-3 bg-slate-200" />
      {children}
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
