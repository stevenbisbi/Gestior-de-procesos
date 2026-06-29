import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Batches, TubeReceptions, Catalog } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Loading, Alert } from '../components/Common';
import { formatDateTime } from '../lib/utils';

export default function Canasta() {
  const { user }              = useAuth();
  const [basket, setBasket]   = useState([]);
  const [history, setHistory] = useState([]);
  const [waiting, setWaiting] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [showReceive, setShowReceive]     = useState(false);
  const [receivingBatch, setReceivingBatch] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [b, h, w] = await Promise.all([
        TubeReceptions.basket(),
        TubeReceptions.list({}),
        Batches.list({ status: 'waiting_material' }),
      ]);
      setBasket(b);
      setHistory(h);
      setWaiting(w);
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
            {basket.length} referencias · <strong className="text-white">{totalTubes.toLocaleString()}</strong> tubos largos disponibles
          </p>
        </div>
        <button onClick={() => setShowReceive(true)} className="btn btn-success px-5 py-2.5">
          📥 Recibir tubería
        </button>
      </div>

      {err && <Alert kind="error" onClose={() => setErr('')}>{err}</Alert>}

      {/* Lotes esperando material (acceso rápido para recibir contra lote) */}
      {waiting.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-2">
            ⏳ Lotes esperando material ({waiting.length})
          </div>
          <div className="space-y-1.5">
            {waiting.map(b => (
              <div key={b.id} className="flex items-center justify-between bg-white rounded-lg border border-amber-100 px-3 py-2">
                <div className="min-w-0">
                  <Link to={`/lote/${b.id}`} className="font-mono text-xs text-blue-600 hover:underline">{b.batch_code}</Link>
                  <span className="text-sm text-slate-700 ml-2">{b.product_name}</span>
                  <span className="text-xs text-slate-400 ml-2">{b.total_quantity?.toLocaleString()} uds</span>
                </div>
                <button onClick={() => setReceivingBatch(b)}
                  className="btn btn-success btn-sm whitespace-nowrap">📥 Recibir</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid de canasta por tipo de tubo */}
      {basket.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">🧺</div>
          <p className="text-lg font-medium">La canasta está vacía</p>
          <p className="text-sm mt-1">Cuando recibas tubería del almacén, regístrala con el botón de arriba.</p>
        </div>
      ) : (
        <div>
          <SectionTitle>Tubos largos disponibles por referencia</SectionTitle>
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
                  {item.tube_spec.saw_type_display && item.tube_spec.saw_type !== 'none' &&
                    ` · ${item.tube_spec.saw_type_display}`}
                  {item.tube_spec.rpm ? ` · ${item.tube_spec.rpm} RPM` : ''}
                </div>
                <div className="border-t border-slate-100 pt-3 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase text-slate-400 font-semibold">Tubos largos</div>
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
          <SectionTitle>Recepciones recientes</SectionTitle>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left py-2.5 px-3 whitespace-nowrap">Fecha</th>
                    <th className="text-left py-2.5 px-3">Tubería</th>
                    <th className="text-center py-2.5 px-3">Cantidad</th>
                    <th className="text-left py-2.5 px-3">Lote</th>
                    <th className="text-left py-2.5 px-3">Almacén</th>
                    <th className="text-left py-2.5 px-3">Recibió</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 30).map(r => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                        {formatDateTime(r.received_at)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-xs font-medium text-slate-700">
                          Ø {r.tube_spec_data?.outer_diameter} × {r.tube_spec_data?.thickness}
                        </div>
                        <div className="text-[10px] text-slate-400">{r.tube_spec_data?.material_display}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-green-600">+{r.quantity}</td>
                      <td className="py-2.5 px-3 text-xs">
                        {r.batch
                          ? <Link to={`/lote/${r.batch}`} className="font-mono text-blue-600 hover:underline">#{r.batch}</Link>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">{r.delivered_by || '—'}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">{r.received_by_data?.full_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showReceive && (
        <ReceiveTubeModal
          user={user}
          waiting={waiting}
          onClose={() => setShowReceive(false)}
          onCreated={() => { setShowReceive(false); refresh(); }}
        />
      )}
      {receivingBatch && (
        <ReceiveTubeModal
          user={user}
          waiting={waiting}
          presetBatch={receivingBatch}
          onClose={() => setReceivingBatch(null)}
          onCreated={() => { setReceivingBatch(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ── Modal de recepción ───────────────────────────────────────────────────────
function ReceiveTubeModal({ user, waiting = [], presetBatch = null, onClose, onCreated }) {
  const [tubes, setTubes] = useState([]);
  const [loadingTubes, setLoadingTubes] = useState(true);
  const [form, setForm] = useState({
    tube_spec: presetBatch?.tube_spec_id ? String(presetBatch.tube_spec_id) : '',
    quantity: '', delivered_by: '', notes: '',
    batch: presetBatch ? String(presetBatch.id) : '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    Catalog.tubes().then(ts => {
      setTubes(ts);
      // Si vino con lote preseleccionado, intentar fijar su tubo
      if (presetBatch && !form.tube_spec) {
        const b = waiting.find(w => w.id === presetBatch.id);
        // tube_spec del lote no viene en list; lo dejamos a elección
      }
    }).finally(() => setLoadingTubes(false));
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
      if (form.batch) {
        // Recepción contra un lote → lo mueve de "esperando material" a "en canasta"
        await Batches.receive(Number(form.batch), {
          tube_spec:    Number(form.tube_spec),
          quantity:     Number(form.quantity),
          delivered_by: form.delivered_by,
          notes:        form.notes,
        });
      } else {
        await TubeReceptions.create({
          tube_spec:    Number(form.tube_spec),
          quantity:     Number(form.quantity),
          delivered_by: form.delivered_by,
          notes:        form.notes,
        });
      }
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
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {err && <Alert kind="error" onClose={() => setErr('')}>{err}</Alert>}

            <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600">
              👤 Recibido por: <strong className="text-slate-800">{user.full_name}</strong>
              <span className="text-slate-400 ml-2">(automático)</span>
            </div>

            {/* Lote opcional */}
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                ¿Para un lote? (opcional)
              </span>
              <select className={`${inp} bg-white`} value={form.batch}
                onChange={e => set('batch', e.target.value)}>
                <option value="">— recepción suelta (sin lote) —</option>
                {waiting.map(b => (
                  <option key={b.id} value={b.id}>{b.batch_code} · {b.product_name}</option>
                ))}
              </select>
              {form.batch && (
                <span className="text-[10px] text-amber-600 mt-1 block">
                  El lote pasará de "Esperando material" a "En canasta".
                </span>
              )}
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Tubo recibido</span>
              <select required className={`${inp} bg-white`} disabled={loadingTubes}
                value={form.tube_spec} onChange={e => set('tube_spec', e.target.value)}>
                <option value="">{loadingTubes ? 'Cargando…' : '— seleccionar tubo —'}</option>
                {tubes.map(t => (
                  <option key={t.id} value={t.id}>
                    Ø {t.outer_diameter} × {t.thickness} mm · {t.material_display} · {t.original_length?.toFixed?.(0) || t.original_length} mm largo
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Cantidad de tubos largos recibidos</span>
              <input type="number" min="1" required className={inp}
                value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="ej. 150"/>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Entregado por (almacén)</span>
              <input className={inp} value={form.delivered_by}
                onChange={e => set('delivered_by', e.target.value)} placeholder="Nombre del personal"/>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Notas (opcional)</span>
              <textarea rows={2} className={`${inp} resize-none`} value={form.notes}
                onChange={e => set('notes', e.target.value)} placeholder="Origen, observaciones…"/>
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
