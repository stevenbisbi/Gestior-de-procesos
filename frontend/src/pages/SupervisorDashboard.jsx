import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dashboard } from '../lib/api';
import { Loading } from '../components/Common';
import { PROCESS_LABELS, PROCESS_ICONS } from '../lib/utils';
import MaterialEnPlanta from './MaterialEnPlanta';

export default function SupervisorDashboard() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Dashboard.supervisor().then(setStats).finally(() => setLoading(false));
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
        <Link to="/supervisor?tab=defectuosos" className="stat-card hover:bg-red-50/40 hover:border-red-200 transition cursor-pointer">
          <div className="stat-num text-red-600">{stats.with_defects || 0}</div>
          <div className="stat-label">Con defectos</div>
          <div className="stat-sub">{(stats.defective_qty || 0).toLocaleString()} pzs en rework</div>
        </Link>
        <div className="stat-card">
          <div className="stat-num">{stats.total}</div>
          <div className="stat-label">Total en planta</div>
          <div className="stat-sub">Lotes activos</div>
        </div>
      </div>

      {/* Segunda sección: Material en planta (Todo / Canasta / Defectuosos) */}
      <div className="pt-2">
        <MaterialEnPlanta />
      </div>
    </div>
  );
}
