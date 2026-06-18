import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const TabsSupervisor = [
  { to: '/supervisor',     label: 'Resumen',    icon: '📊' },
  { to: '/maquinas',       label: 'Máquinas',   icon: '🏭' },
  { to: '/lotes',          label: 'Lotes',      icon: '📦' },
  { to: '/programa',       label: 'Programa',   icon: '✂️' },
  { to: '/canasta',        label: 'Canasta',    icon: '🧺' },
  { to: '/calidad/reporte',label: 'Calidad',    icon: '✓'  },
];

// Para operarios de corte (Bewo): programa + canasta de tubería
const TabsOperatorCorte = [
  { to: '/operario',       label: 'Mis tareas', icon: '🛠' },
  { to: '/corte/programa', label: 'Programa',   icon: '✂️' },
  { to: '/canasta',        label: 'Canasta',    icon: '🧺' },
];

const TabsOperator = [
  { to: '/operario', label: 'Mis tareas', icon: '🛠' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const isBewoOperator = !user.is_supervisor && user.process_types?.includes('corte');
  const tabs = user.is_supervisor
    ? TabsSupervisor
    : isBewoOperator ? TabsOperatorCorte : TabsOperator;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="bg-navy text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span className="font-mono text-sm bg-white/10 px-2.5 py-1 rounded tracking-wider">TUBOS</span>
            <div>
              <div className="text-base font-semibold leading-tight">Control de Planta</div>
              <div className="text-xs text-white/55 -mt-0.5">Planta de Tubos</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm hidden sm:inline">{user.full_name}</span>
            <button onClick={logout} className="btn btn-sm btn-outline text-white/70 border-white/20 hover:bg-white/5 hover:border-white/40">
              Salir
            </button>
          </div>
        </div>
        <nav className="bg-navy-mid border-t border-white/10">
          <div className="max-w-7xl mx-auto px-5 flex items-center gap-0.5 overflow-x-auto scrollbar-thin">
            {tabs.map(t => (
              <NavLink key={t.to} to={t.to}
                className={({ isActive }) => `flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap
                  ${isActive ? 'text-white border-blue-400' : 'text-white/60 hover:text-white border-transparent'}`}>
                <span className="text-base">{t.icon}</span> {t.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-5 py-5 pb-20 sm:pb-5">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-navy border-t border-white/10 z-50"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex">
          {tabs.slice(0, 4).map(t => {
            const active = loc.pathname === t.to;
            return (
              <NavLink key={t.to} to={t.to}
                className={`flex-1 flex flex-col items-center py-2.5 text-[11px] font-medium gap-0.5 ${active ? 'text-white' : 'text-white/50'}`}>
                <span className="text-lg">{t.icon}</span>
                {t.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
