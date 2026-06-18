import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TubeReceptions, Catalog } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Loading, Alert } from '../components/Common';
import { formatDateTime } from '../lib/utils';

export default function Canasta() {
  const { user }                  = useAuth();
  const [basket, setBasket]       = useState([]);
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showReceive, setShowReceive] = useState(false);
  const [err, setErr]             = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const [b, h] = await Promise.all([
        TubeReceptions.basket(),
        TubeReceptions.list({}),
      ]);
      setBasket(b);
      setHistory(h);
    } catch (e) { setErr(e.message); }
    finally     { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  if (loading) return <Loading />;

  const totalTubes = basket.reduce((s, b) => s + (b.total || 0), 0);

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="bg-navy text-white rounded-2xl px-5 py-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-white/60 font-medium uppercase tracking-wide">Inventario · Materia prima</p>
          <h1 className="text-2xl font-bold mt-0.5">🧺 Canasta de tubería</h1>
          <p className="text-sm text-white/60 mt-0.5">
            {basket.length} referencias · <strong className="text-white">{totalTubes.toLocaleString()}</strong> tubos disponibles
          </p>
        </div>
        <button onClick={() => setShowReceive(true)}
          className="btn btn-success px-5 py-2.5">
          📥 Recibir tubería
        </button>
      </div>

      {err && <Alert kind="error" onClose={() => setErr('')}>{err}</Alert>}

      {/* Grid de canasta por TubeSpec */}
      {basket.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">🧺</div>
          <p className="text-lg font-medium">La canasta está vacía</p>
          <p className="text-sm mt-1">Cuando recibas tubería del almacén, regístrala con el botón de arriba.</p>
        </div>
      ) : (
        <div>
          <SectionTitle>Disponible en canasta</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {basket.map(item => (
              <div key={item.tube_spec.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                    {item.tube_spec.shape_display}
                  </span>
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                    {item.tube_spec.material_display}
                  </span>
                </div>
                <div className="font-mono text-lg font-bold text-slate-800">
                  Ø {item.tube_spec.outer_diameter}
                  <span className="text-slate-400 text-sm font-normal"> × {item.tube_spec.thickness} mm</span>
                </div>
                <div className="text-xs text-slate-500 mb-3">
                  Largo: {item.tube_spec.original_length?.toFixed?.(0) || item.tube_spec.original_length} mm
                </div>
                <div className="border-t border-slate-100 pt-3 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase text-slate-400 font-semibold">Tubos disponibles</div>
                    <div className="font-mono text-2xl font-bold text-green-600 leading-none mt-0.5">
                      {item.total.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-slate-400 font-semibold">Última recepción</div>
                    <div className="text-xs text-slate-500">{formatDateTime(item.last_received)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial de recepciones */}
      {history.length > 0 && (
        <div>
          <SectionTitle>Historial reciente</SectionTitle>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left py-2.5 px-3 whitespace-nowrap">Fecha</th>
                    <th className="text-left py-2.5 px-3">Tubería</th>
                    <th className="text-center py-2.5 px-3 whitespace-nowrap">Cantidad</th>
                    <th className="text-left py-2.5 px-3 whitespace-nowrap">Entregó (almacén)</th>
                    <th className="text-left py-2.5 px-3 whitespace-nowrap">Recibió</th>
                    <th className="text-left py-2.5 px-3">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 50).map(r => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                        {formatDateTime(r.received_at)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-sm font-medium text-slate-700">
                          Ø {r.tube_spec_data?.outer_diameter} × {r.tube_spec_data?.thickness}
                        </div>
                        <div className="text-xs text-slate-400">{r.tube_spec_data?.material_display}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-green-600">
                        +{r.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">{r.delivered_by || '—'}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">{r.received_by_data?.full_name || '—'}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-500">{r.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {history.length > 50 && (
              <div className="text-center text-xs text-slate-400 py-2 border-t border-slate-100">
                Mostrando 50 más recientes de {history.length}
              </div>
            )}
          </div>
        </div>
      )}

      {showReceive && (
        <ReceiveTubeModal
          user={user}
          onClose={() => setShowReceive(false)}
          onCreated={() => { setShowReceive(false); refresh(); }}
        />
      )}
    </div>
  );
}

// ── Modal "Recibir tubería" ──────────────────────────────────────────────────
function ReceiveTubeModal({ user, onClose, onCreated }) {
  const [tubes, setTubes] = useState([]);
  const [loadingTubes, setLoadingTubes] = useState(true);
  const [form, setForm] = useState({
    tube_spec: '', quantity: '', delivered_by: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    Catalog.tubes().then(setTubes).finally(() => setLoadingTubes(false));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.tube_spec || !form.quantity) {
      setErr('Selecciona el tubo e ingresa la cantidad.');
      return;
    }
    setSaving(true); setErr('');
    try {
      await TubeReceptions.create({
        tube_spec:    Number(form.tube_spec),
        quantity:     Number(form.quantity),
        delivered_by: form.delivered_by,
        notes:        form.notes,
      });
      onCreated();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-8">
        <form onSubmit={submit}>
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">📥 Recibir tubería</h2>
            <button type="button" onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {err && <Alert kind="error" onClose={() => setErr('')}>{err}</Alert>}

            <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600">
              👤 Recibido por: <strong className="text-slate-800">{user.full_name}</strong>
              <span className="text-slate-400 ml-2">(automático)</span>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Tubo recibido
              </span>
              <select required className={`${inp} bg-white`}
                disabled={loadingTubes}
                value={form.tube_spec}
                onChange={e => set('tube_spec', e.target.value)}>
                <option value="">{loadingTubes ? 'Cargando…' : '— seleccionar tubo —'}</option>
                {tubes.map(t => (
                  <option key={t.id} value={t.id}>
                    Ø {t.outer_diameter} × {t.thickness} mm · {t.material_display} · {t.original_length?.toFixed?.(0) || t.original_length} mm largo
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">
                ¿No aparece? Pídele al supervisor que lo cree desde Lotes → "+ Producto".
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Cantidad de tubos recibidos
              </span>
              <input type="number" min="1" required className={inp}
                value={form.quantity}
                onChange={e => set('quantity', e.target.value)}
                placeholder="ej. 150"/>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Entregado por (persona de almacén)
              </span>
              <input className={inp}
                value={form.delivered_by}
                onChange={e => set('delivered_by', e.target.value)}
                placeholder="Nombre del personal de almacén"/>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Notas (opcional)
              </span>
              <textarea rows={2} className={`${inp} resize-none`}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Estado del material, observaciones, etc."/>
            </label>
          </div>

          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 rounded-b-2xl">
            <button type="button" onClick={onClose} className="btn btn-outline px-4">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-success px-5">
              {saving ? 'Registrando…' : '✓ Agregar a la canasta'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
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
