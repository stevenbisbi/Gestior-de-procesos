import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Catalog, Batches } from '../lib/api';
import { BackLink, Alert, Loading } from '../components/Common';
import { PROCESS_ICONS } from '../lib/utils';

export default function CreateBatch() {
  const nav = useNavigate();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    product_type: '', total_quantity: '', priority: 'media',
    scheduled_date: '', notes: '',
  });
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    Catalog.products().then(setProducts).finally(() => setLoading(false));
  }, []);

  const selectedProduct = products.find(p => p.id === parseInt(form.product_type));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); setSaving(true);
    try {
      const data = {
        ...form,
        product_type: parseInt(form.product_type),
        total_quantity: parseInt(form.total_quantity),
        scheduled_date: form.scheduled_date || null,
      };
      const created = await Batches.create(data);
      nav(`/lote/${created.id}`);
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  if (loading) return <Loading />;

  return (
    <div className="max-w-xl">
      <BackLink to="/supervisor" />
      <div className="card">
        <div className="card-header"><span className="card-title">Registrar nuevo lote</span></div>
        <div className="card-body">
          {error && <Alert kind="error">{error}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Tipo de producto / Referencia</label>
              <select required value={form.product_type}
                onChange={e => setForm({ ...form, product_type: e.target.value })}
                className="form-select">
                <option value="">Seleccionar...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <div className="bg-slate-50 rounded-lg p-3.5 text-sm space-y-1 border border-slate-200">
                <div className="font-semibold mb-1">📋 Información del producto</div>
                <div>📐 Tubo: <strong>{selectedProduct.tube_spec_data?.label}</strong></div>
                <div>✂️ Longitud de corte: <strong>{selectedProduct.cut_length?.toFixed(0)} mm</strong></div>
                <div>🔗 Ruta: <strong>{selectedProduct.process_route?.map(p => `${PROCESS_ICONS[p]} ${p}`).join(' → ')}</strong></div>
                <div>🏭 Cliente: {selectedProduct.client || '—'}</div>
              </div>
            )}

            <div>
              <label className="form-label">Cantidad total (uds)</label>
              <input type="number" required min="1" value={form.total_quantity}
                onChange={e => setForm({ ...form, total_quantity: e.target.value })}
                className="form-input" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Prioridad</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="form-select">
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
              <div>
                <label className="form-label">Fecha programada</label>
                <input type="date" value={form.scheduled_date}
                  onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
                  className="form-input" />
              </div>
            </div>

            <div>
              <label className="form-label">Observaciones (opcional)</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                rows="2" className="form-textarea" />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                {saving ? 'Creando...' : 'Crear lote'}
              </button>
              <button type="button" onClick={() => nav('/supervisor')} className="btn btn-outline">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
