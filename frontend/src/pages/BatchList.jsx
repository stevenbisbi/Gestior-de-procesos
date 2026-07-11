import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Batches, Catalog } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BatchCard, Loading, Alert } from '../components/Common';
import ProductPicker, { CreateProductModal } from '../components/ProductPicker';

const STATUSES = [
  { v: '',                 label: 'Todos' },
  { v: 'waiting_material', label: 'Esperando material' },
  { v: 'in_basket',        label: 'En canasta' },
  { v: 'in_process',       label: 'En proceso' },
  { v: 'finished',         label: 'Terminados' },
];

export default function BatchList() {
  const { user }              = useAuth();
  const [batches, setBatches] = useState([]);
  const [q, setQ]             = useState('');
  const [status, setStatus]   = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewBatch,   setShowNewBatch]   = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [tubes, setTubes] = useState([]);

  const fetchData = () => {
    setLoading(true);
    Batches.list({ q, status, exclude_dispatched: '1' })
      .then(setBatches).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [status]);

  // Tubos para el modal "+ Producto" (se cargan cuando se abre)
  const openNewProduct = async () => {
    if (tubes.length === 0) {
      try { setTubes(await Catalog.tubes()); } catch {}
    }
    setShowNewProduct(true);
  };

  return (
    <div>
      {/* Barra de filtros y acciones */}
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <form onSubmit={e => { e.preventDefault(); fetchData(); }} className="flex gap-2 flex-1 min-w-[200px]">
          <input type="text" placeholder="Buscar por código de lote, producto o tubo…"
            value={q} onChange={e => setQ(e.target.value)}
            className="form-input flex-1" />
          <button type="submit" className="btn btn-primary">Filtrar</button>
        </form>
        {user.is_supervisor && (
          <div className="flex gap-2">
            <button onClick={openNewProduct} className="btn btn-outline">
              + Producto
            </button>
            <button onClick={() => setShowNewBatch(true)} className="btn btn-success">
              + Lote
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUSES.map(s => (
          <button key={s.v} onClick={() => setStatus(s.v)}
            className={`btn btn-sm ${status === s.v ? 'btn-primary' : 'btn-outline'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {loading ? <Loading /> :
        batches.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <div className="text-4xl mb-2">🔍</div>
            <p>No se encontraron lotes con ese filtro.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {batches.map(b => <BatchCard key={b.id} batch={b} to={`/lote/${b.id}`} />)}
          </div>
        )
      }

      {/* Modales de creación (solo supervisor) */}
      {showNewProduct && (
        <CreateProductModal
          tubes={tubes}
          onTubeCreated={(t) => setTubes(prev => [t, ...prev])}
          onCancel={() => setShowNewProduct(false)}
          onCreated={() => { setShowNewProduct(false); /* nada que refrescar acá */ }}
          submitLabel="✓ Crear producto"
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

// ── Modal "+ Lote" — elige producto existente + cantidad + prioridad ────────
export function NewBatchModal({ onClose, onCreated }) {
  const nav = useNavigate();
  const [form, setForm] = useState({
    product_type: '', total_quantity: '', priority: 'media',
    scheduled_date: '', notes: '',
    material_received: false,  // si está marcado, va directo a in_basket
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleProductChange = (pid, p) => {
    set('product_type', pid);
    setSelectedProduct(p);
    if (p?.default_priority && !form.priority) set('priority', p.default_priority);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.product_type) { setErr('Selecciona un producto.'); return; }
    setSaving(true); setErr('');
    try {
      const created = await Batches.create({
        product_type:   Number(form.product_type),
        total_quantity: Number(form.total_quantity),
        priority:       form.priority,
        scheduled_date: form.scheduled_date || null,
        notes:          form.notes,
      });
      // Si el supervisor marca que el material ya está, lo recibimos auto
      if (form.material_received) {
        try { await Batches.receive(created.id, {}); } catch {}
      }
      onCreated();
      nav(`/lote/${created.id}`);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
        <form onSubmit={submit}>
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">📦 Nuevo lote</h2>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {err && <Alert kind="error" onClose={() => setErr('')}>{err}</Alert>}

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Producto</label>
              <ProductPicker value={form.product_type} onChange={handleProductChange} allowCreate={true}/>
            </div>

            {selectedProduct && (
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-0.5 border border-slate-200">
                <div>📐 Tubo: <strong>{selectedProduct.tube_spec_data?.label}</strong></div>
                <div>✂️ Corte: <strong>{selectedProduct.cut_length} mm</strong></div>
                {selectedProduct.client && <div>🏭 Cliente: {selectedProduct.client}</div>}
                {selectedProduct.process_route?.length > 0 && (
                  <div>🔗 Procesos: <strong>{selectedProduct.process_route.join(' → ')}</strong></div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Cantidad total (uds)</label>
              <input type="number" min="1" required className={inp}
                value={form.total_quantity}
                onChange={e => set('total_quantity', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Prioridad</label>
                <select className={`${inp} bg-white`} value={form.priority}
                  onChange={e => set('priority', e.target.value)}>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Fecha programada</label>
                <input type="date" className={inp} value={form.scheduled_date}
                  onChange={e => set('scheduled_date', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Notas (opcional)</label>
              <textarea rows={2} className={`${inp} resize-none`} value={form.notes}
                onChange={e => set('notes', e.target.value)} />
            </div>

            <label className="flex items-start gap-2 cursor-pointer select-none bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <input type="checkbox" checked={form.material_received}
                onChange={e => set('material_received', e.target.checked)}
                className="mt-0.5"/>
              <span className="text-xs text-slate-700">
                <strong>Material ya disponible</strong> — poner directo en canasta
                <span className="block text-[10px] text-slate-500">
                  Si se deja sin marcar, el lote queda <strong>"Esperando material"</strong> hasta que un cortador lo reciba desde Canasta.
                </span>
              </span>
            </label>
          </div>

          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 rounded-b-2xl">
            <button type="button" onClick={onClose} className="btn btn-outline px-4">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-success px-5">
              {saving ? 'Creando…' : 'Crear lote'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
