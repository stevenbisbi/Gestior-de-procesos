import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dashboard } from '../lib/api';
import { Loading } from '../components/Common';
import { PROCESS_LABELS, PROCESS_ICONS, formatDateTime } from '../lib/utils';

const PROCESS_COLORS = {
  corte:   { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    accent: 'bg-blue-500'    },
  curvado: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', accent: 'bg-emerald-500' },
  chaflan: { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  accent: 'bg-violet-500'  },
  moleteo: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   accent: 'bg-amber-500'   },
};

// Orden de aparición en planta: cortadoras primero, luego curvadoras, después las demás
const PROCESS_ORDER = ['corte', 'curvado', 'chaflan', 'moleteo'];

// ── Cronómetro live para turnos activos ─────────────────────────────────────
function useElapsed(startStr) {
  const [val, setVal] = useState('—');
  useEffect(() => {
    if (!startStr) return;
    const start = new Date(startStr).getTime();
    const tick = () => {
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setVal(`${h > 0 ? h + 'h ' : ''}${m}min ${s}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startStr]);
  return val;
}

// ── Tarjeta de máquina ─────────────────────────────────────────────────────
function MachineCard({ item }) {
  const m = item.machine;
  const c = PROCESS_COLORS[m.process_type] || PROCESS_COLORS.corte;
  const isActive = item.state === 'active';
  const elapsed  = useElapsed(item.active?.started_at);

  return (
    <div className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all
      ${isActive ? c.border + ' shadow-md' : 'border-slate-200'}`}>
      {/* Cabecera */}
      <div className={`px-4 py-3 flex items-center justify-between ${isActive ? c.bg : 'bg-slate-50'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${c.bg} ${c.text} border ${c.border}`}>
            {PROCESS_ICONS[m.process_type]}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-800 truncate">{m.name}</div>
            <div className={`text-xs ${c.text} font-medium`}>{PROCESS_LABELS[m.process_type]}</div>
          </div>
        </div>
        {/* Badge de estado */}
        <div className="flex flex-col items-end gap-0.5">
          {isActive ? (
            <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-green-300">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>
              Activa
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"/>
              Sin actividad
            </span>
          )}
        </div>
      </div>

      {/* Cuerpo */}
      <div className="p-4">
        {isActive ? (
          // ─── ACTIVA ────────────────────────────────────────────
          <div className="space-y-3">
            {/* Lote y producto */}
            <Link to={`/lote/${item.active.batch_id}`} className="block group">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-slate-400">{item.active.batch_code}</span>
                <span className="text-[10px] text-blue-500 group-hover:underline">→ ver lote</span>
              </div>
              <div className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                {item.active.product_name}
              </div>
              <div className="text-xs text-slate-400 truncate">{item.active.tube_label}</div>
            </Link>

            {/* Operario y turno */}
            <div className="bg-slate-50 rounded-lg px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-navy text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {item.active.operator?.full_name?.[0] || '?'}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate">{item.active.operator?.full_name || '—'}</div>
                  {item.active.shift && (
                    <div className="text-[10px] text-slate-400">Turno {item.active.shift}</div>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <div className="text-xs text-slate-400">⏱ Lleva</div>
                <div className="font-mono text-sm font-semibold text-slate-700">{elapsed}</div>
              </div>
            </div>

            {/* Avance */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-500">Avance del proceso</span>
                <span className="font-mono font-semibold text-slate-700">{item.active.progress_pct}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${c.accent} transition-all`} style={{ width: `${item.active.progress_pct}%` }}/>
              </div>
              <div className="flex items-center justify-between text-[11px] mt-1 font-mono">
                <span className="text-slate-400">{item.active.qty_done?.toLocaleString()} / {item.active.qty_assigned?.toLocaleString()}</span>
                <span className="text-blue-600">faltan {item.active.qty_remaining?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ) : (
          // ─── SIN ACTIVIDAD ─────────────────────────────────────
          <div className="space-y-3">
            {item.last_activity ? (
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Última actividad</div>
                <Link to={`/lote/${item.last_activity.batch_id}`} className="block group">
                  <div className="font-mono text-xs text-slate-400">{item.last_activity.batch_code}</div>
                  <div className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors truncate">
                    {item.last_activity.product_name}
                  </div>
                </Link>
                <div className="text-xs text-slate-500 mt-1">
                  {item.last_activity.operator?.full_name || '—'} · <strong>{item.last_activity.qty_done}</strong> uds
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {formatDateTime(item.last_activity.finished_at)}
                </div>
              </div>
            ) : (
              <div className="text-center py-3 text-sm text-slate-400">
                Sin actividad registrada
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pie: cola pendiente y operarios */}
      <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50/50 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-[10px] text-slate-400 uppercase font-semibold">En cola</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-bold text-slate-700">{item.queue_count}</span>
            {item.queue_paused > 0 && (
              <span className="text-blue-600 text-[10px]">({item.queue_paused} pausados)</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Operarios</div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {m.operators_data?.slice(0, 3).map(o => (
              <span key={o.id} className="text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600">
                {o.full_name?.split(' ')[0]}
              </span>
            ))}
            {m.operators_data?.length > 3 && (
              <span className="text-[10px] text-slate-400">+{m.operators_data.length - 3}</span>
            )}
            {m.operators_data?.length === 0 && (
              <span className="text-[10px] text-slate-400">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────
export default function MachinesStatus() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const load = async () => {
    try {
      const d = await Dashboard.machinesStatus();
      setData(d);
      setLastUpdate(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <Loading />;

  // Agrupar por process_type
  const byType = (data || []).reduce((acc, item) => {
    const t = item.machine.process_type;
    (acc[t] = acc[t] || []).push(item);
    return acc;
  }, {});

  const totalActive = data.filter(d => d.state === 'active').length;
  const totalIdle   = data.filter(d => d.state === 'idle').length;

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🏭 Estado de la planta</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {totalActive} {totalActive === 1 ? 'máquina activa' : 'máquinas activas'} · {totalIdle} sin actividad
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            Actualizado: {lastUpdate.toLocaleTimeString('es-CO')}
          </span>
          <button onClick={load} className="btn btn-outline btn-sm text-xs">
            🔄 Refrescar
          </button>
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {PROCESS_ORDER.map(type => {
          const machines = byType[type] || [];
          const active   = machines.filter(m => m.state === 'active').length;
          const c        = PROCESS_COLORS[type];
          return (
            <div key={type} className={`rounded-xl p-3 border ${c.border} ${c.bg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{PROCESS_LABELS[type]}</div>
                  <div className={`font-mono text-xl font-bold ${c.text}`}>
                    {active} <span className="text-sm text-slate-400">/ {machines.length}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">activas</div>
                </div>
                <div className="text-2xl">{PROCESS_ICONS[type]}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid de máquinas agrupadas por proceso, en el orden definido */}
      {PROCESS_ORDER.map(type => {
        const machines = byType[type] || [];
        if (machines.length === 0) return null;
        return (
          <section key={type}>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span>{PROCESS_ICONS[type]}</span>
              <span>{PROCESS_LABELS[type]}</span>
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-slate-500">{machines.length} {machines.length === 1 ? 'máquina' : 'máquinas'}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {machines.map(item => <MachineCard key={item.machine.id} item={item} />)}
            </div>
          </section>
        );
      })}

      {data.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-4">🏭</div>
          <p>No hay máquinas activas en el sistema.</p>
        </div>
      )}
    </div>
  );
}
