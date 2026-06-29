import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Batches, Catalog } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Loading } from '../components/Common';
import { NewBatchModal } from './BatchList';
import { CreateProductModal } from '../components/ProductPicker';
import Defectuosos from './Defectuosos';

export default function MaterialEnPlanta() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">📦 Material en planta</h1>
      <TodoTab />
    </div>
  );
}

// ── Tabla de todos los lotes en planta ──────────────────────────────────────
const STATUSES = [
  { v: '',                 label: 'Todos' },
  { v: 'waiting_material', label: 'Esperando material' },
  { v: 'in_basket',        label: 'En canasta' },
  { v: 'in_process',       label: 'En proceso' },
  { v: 'finished',         label: 'Terminados' },
  { v: 'defectuosos',      label: '🔧 Defectuosos' },  // vista especial (no es estado de lote)
];

function TodoTab() {
  const { user }              = useAuth();
  const [batches, setBatches] = useState([]);
  const [q, setQ]             = useState('');
  const [status, setStatus]   = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewBatch,   setShowNewBatch]   = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [tubes, setTubes] = useState([]);

  const isDefectos = status === 'defectuosos';

  const fetchData = () => {
    if (isDefectos) { setLoading(false); return; }
    setLoading(true);
    Batches.list({ q, status, exclude_dispatched: '1' })
      .then(setBatches).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [status]);

  const openNewProduct = async () => {
    if (tubes.length === 0) {
      try { setTubes(await Catalog.tubes()); } catch {}
    }
    setShowNewProduct(true);
  };

  return (
    <div className="space-y-3">
      {/* Acciones — solo cuando NO estamos en la vista de defectuosos */}
      {!isDefectos && (
        <div className="flex gap-2 flex-wrap items-center">
          <form onSubmit={e => { e.preventDefault(); fetchData(); }} className="flex gap-2 flex-1 min-w-[200px]">
            <input type="text" placeholder="Buscar por código, producto o tubo…"
              value={q} onChange={e => setQ(e.target.value)}
              className="form-input flex-1" />
            <button type="submit" className="btn btn-primary">Filtrar</button>
          </form>
          {user.is_supervisor && (
            <div className="flex gap-2">
              <button onClick={openNewProduct} className="btn btn-outline">+ Producto</button>
              <button onClick={() => setShowNewBatch(true)} className="btn btn-success">+ Lote</button>
            </div>
          )}
        </div>
      )}

      {/* Filtros / pestañas internas */}
      <div className="flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <button key={s.v} onClick={() => setStatus(s.v)}
            className={`btn btn-sm ${status === s.v ? 'btn-primary' : 'btn-outline'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Vista de defectuosos o tabla de lotes */}
      {isDefectos ? (
        <Defectuosos />
      ) : (
        <>
          <div className="card">
            <div className="overflow-x-auto scrollbar-thin">
              {loading ? <Loading /> :
                batches.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <div className="text-4xl mb-2">📦</div>
                    <p>No hay lotes con ese filtro.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider">
                      <tr>
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
            <span className="text-amber-600">● Esperando material</span>
            <span>● En canasta</span>
            <span className="text-amber-600">● En proceso</span>
            <span className="text-blue-600">● Pausado</span>
            <span className="text-emerald-600">● Terminado</span>
          </div>
        </>
      )}

      {showNewProduct && (
        <CreateProductModal
          tubes={tubes}
          onTubeCreated={(t) => setTubes(prev => [t, ...prev])}
          onCancel={() => setShowNewProduct(false)}
          onCreated={() => setShowNewProduct(false)}
        />
      )}
      {showNewBatch && (
        <NewBatchModal
          onClose={() => setShowNewBatch(false)}
          onCreated={() => { setShowNewBatch(false); fetchData(); }}
        />
      )}
    </div>
  );
}

// ── Fila del lote (misma vista que tenía el Resumen) ────────────────────────
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
      <td className="px-4 py-3">
        <div className="font-semibold text-sm text-slate-800">{b.product_name}</div>
        <div className="text-[11px] text-slate-400">
          {b.item_code && <span className="font-mono">{b.item_code} · </span>}
          {b.tube_label} · {b.cut_length?.toFixed(0)} mm
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs">{b.total_quantity?.toLocaleString()} uds</td>
      <td className="px-4 py-3">
        <span className={`priority-${b.priority} text-xs font-semibold`}>{b.priority_display}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`badge ${statusBadgeCls} badge-dot`}>{b.status_display}</span>
      </td>
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
                {cp.status === 'in_process' ? '👤 Activo: ' : '👤 Último turno: '}{cp.operator}
              </div>
            )}
          </div>
        ) : b.status === 'finished' ? (
          <span className="text-emerald-600 text-sm">✓ Listo para despacho</span>
        ) : (
          <span className="text-slate-400 text-sm">—</span>
        )}
      </td>
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
