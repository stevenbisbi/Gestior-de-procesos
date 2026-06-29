import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Batches, TubeReceptions, Catalog } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Loading, Alert } from '../components/Common';
import { formatDateTime } from '../lib/utils';

export default function Canasta() {
  const { user }              = useAuth();
  const [inBasket, setInBasket] = useState([]);
  const [waiting, setWaiting] = useState([]);   // solo para el selector del modal
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [showReceive, setShowReceive] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [b, w, h] = await Promise.all([
        Batches.list({ status: 'in_basket' }),
        Batches.list({ status: 'waiting_material' }),
        TubeReceptions.list({}),
      ]);
      setInBasket(b);
      setWaiting(w);
      setHistory(h);
    } catch (e) { setErr(e.message); }
    finally     { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  if (loading) return <Loading />;

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="bg-navy text-white rounded-2xl px-5 py-4">
        <p className="text-xs text-white/60 font-medium uppercase tracking-wide">Recepción · Material para cortar</p>
        <h2 className="text-2xl font-bold mt-0.5">🧺 Canasta</h2>
        <p className="text-sm text-white/60 mt-0.5">
          <strong className="text-green-300">{inBasket.length}</strong> listos para cortar
        </p>
        <button onClick={() => setShowReceive(true)}
          className="mt-3 inline-flex items-center gap-2 text-white font-medium hover:text-green-300 transition">
          📥 Recibir tubería suelta
        </button>
      </div>

      {err && <Alert kind="error" onClose={() => setErr('')}>{err}</Alert>}

      {/* Hint */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-900 flex items-start gap-2">
        <span className="text-base">💡</span>
        <span>
          Si la tubería llega <strong>sin orden previa</strong>, usá <em>"Recibir tubería suelta"</em>.
          Para recibir material de un lote que estaba esperando, elegí el lote dentro del mismo formulario.
        </span>
      </div>

      {/* En canasta — listos para cortar */}
      <section>
        <SectionTitle accent="green">
          🧺 En canasta — listos para cortar <span className="text-slate-500 font-normal">({inBasket.length})</span>
        </SectionTitle>
        {inBasket.length === 0 ? (
          <EmptyMsg text="Aún no hay lotes con material recibido." />
        ) : (
          <div className="space-y-2">
            {inBasket.map(b => (
              <div key={b.id}
                className="bg-white rounded-xl border border-slate-100 shadow-sm border-l-4 border-l-green-500 p-3.5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">🧺</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/lote/${b.id}`} className="font-mono text-sm font-semibold text-blue-600 hover:underline">
                      {b.batch_code}
                    </Link>
                    {b.item_code && (
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{b.item_code}</span>
                    )}
                  </div>
                  <div className="font-semibold text-slate-800 truncate">{b.product_name}</div>
                  <div className="text-xs text-slate-500">
                    {b.tube_label} · corte {b.cut_length?.toFixed?.(0) ?? b.cut_length} mm · <strong>{b.total_quantity?.toLocaleString()}</strong> uds
                  </div>
                </div>
                <Link to={`/lote/${b.id}`} className="btn btn-outline btn-sm flex-shrink-0">Ver lote</Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recepciones recientes */}
      {history.length > 0 && (
        <section>
          <SectionTitle>📋 Recepciones recientes</SectionTitle>
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
        </section>
      )}

      {showReceive && (
        <ReceiveTubeModal
          user={user}
          waiting={waiting}
          onClose={() => setShowReceive(false)}
          onCreated={() => { setShowReceive(false); refresh(); }}
        />
      )}
    </div>
  );
}

// ── Modal de recepción ───────────────────────────────────────────────────────
function ReceiveTubeModal({ user, waiting = [], onClose, onCreated }) {
  const [tubes, setTubes] = useState([]);
  const [loadingTubes, setLoadingTubes] = useState(true);
  const [form, setForm] = useState({
    tube_spec: '', quantity: '', delivered_by: '', notes: '', batch: '',
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
      if (form.batch) {
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

            {waiting.length > 0 && (
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                  ¿Para un lote que espera material? (opcional)
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
                    El lote pasará a "En canasta".
                  </span>
                )}
              </label>
            )}

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

function SectionTitle({ children, accent }) {
  const accentCls = accent === 'green' ? 'text-green-700' : 'text-slate-400';
  return (
    <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${accentCls}`}>{children}</div>
  );
}

function EmptyMsg({ text }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl py-6 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}
