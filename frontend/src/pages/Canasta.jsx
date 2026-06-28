import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Batches, TubeReceptions, Catalog } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Loading, Alert, PriorityTag } from '../components/Common';
import { formatDateTime, formatDate } from '../lib/utils';

export default function Canasta() {
  const { user }                  = useAuth();
  const [waiting, setWaiting]     = useState([]);
  const [inBasket, setInBasket]   = useState([]);
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState('');
  const [receivingBatch, setReceivingBatch] = useState(null);
  const [showStandalone, setShowStandalone] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      // Lotes que esperan material y los que ya están listos para cortar
      const [w, b, h] = await Promise.all([
        Batches.list({ status: 'waiting_material' }),
        Batches.list({ status: 'in_basket' }),
        TubeReceptions.list({}),
      ]);
      setWaiting(w);
      setInBasket(b);
      setHistory(h);
    } catch (e) { setErr(e.message); }
    finally     { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  if (loading) return <Loading />;

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="bg-navy text-white rounded-2xl px-5 py-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-white/60 font-medium uppercase tracking-wide">Recepción · Material para cortar</p>
          <h1 className="text-2xl font-bold mt-0.5">🧺 Canasta</h1>
          <p className="text-sm text-white/60 mt-0.5">
            <strong className="text-amber-300">{waiting.length}</strong> esperando material ·{' '}
            <strong className="text-green-300">{inBasket.length}</strong> listos para cortar
          </p>
        </div>
        <button onClick={() => setShowStandalone(true)}
          className="btn btn-outline border-white/30 text-white hover:bg-white/10 px-4 py-2 whitespace-nowrap">
          📥 Recibir tubería suelta
        </button>
      </div>

      {/* Hint sobre los dos tipos de recepción */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-900 flex items-start gap-2">
        <span className="text-base">💡</span>
        <span>
          Si la tubería llega para un <strong>lote específico</strong>, recíbela desde su tarjeta abajo.
          Si es material que llegó <strong>sin orden previa</strong>, usá <em>"Recibir tubería suelta"</em> arriba.
        </span>
      </div>

      {err && <Alert kind="error" onClose={() => setErr('')}>{err}</Alert>}

      {/* Esperando material */}
      <section>
        <SectionTitle accent="amber">
          ⏳ Esperando material <span className="text-slate-500 font-normal">({waiting.length})</span>
        </SectionTitle>
        {waiting.length === 0 ? (
          <EmptyMsg text="No hay lotes esperando material."/>
        ) : (
          <div className="space-y-2">
            {waiting.map(b => (
              <BatchRow key={b.id} batch={b} mode="waiting"
                onReceive={() => setReceivingBatch(b)} />
            ))}
          </div>
        )}
      </section>

      {/* En canasta — listos para cortar */}
      <section>
        <SectionTitle accent="green">
          🧺 En canasta — listos para cortar <span className="text-slate-500 font-normal">({inBasket.length})</span>
        </SectionTitle>
        {inBasket.length === 0 ? (
          <EmptyMsg text="Aún no hay lotes con material recibido."/>
        ) : (
          <div className="space-y-2">
            {inBasket.map(b => (
              <BatchRow key={b.id} batch={b} mode="ready"/>
            ))}
          </div>
        )}
      </section>

      {/* Historial */}
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
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-green-600">
                        +{r.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-xs">
                        {r.batch ? (
                          <Link to={`/lote/${r.batch}`} className="font-mono text-blue-600 hover:underline">
                            #{r.batch}
                          </Link>
                        ) : <span className="text-slate-300">—</span>}
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

      {receivingBatch && (
        <ReceiveModal
          batch={receivingBatch}
          user={user}
          onClose={() => setReceivingBatch(null)}
          onReceived={() => { setReceivingBatch(null); refresh(); }}
        />
      )}

      {showStandalone && (
        <StandaloneReceiveModal
          user={user}
          onClose={() => setShowStandalone(false)}
          onReceived={() => { setShowStandalone(false); refresh(); }}
        />
      )}
    </div>
  );
}

// ── Modal de recepción SIN lote (tubería suelta) ────────────────────────────
function StandaloneReceiveModal({ user, onClose, onReceived }) {
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
        // batch: null  → recepción suelta, no asociada a lote
      });
      onReceived();
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
          <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Recepción suelta</p>
              <h2 className="text-lg font-bold text-slate-800">📥 Recibir tubería</h2>
              <p className="text-xs text-slate-500">Material que llega sin orden de lote previa</p>
            </div>
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
                placeholder="Nombre del personal"/>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Notas (opcional)
              </span>
              <textarea rows={2} className={`${inp} resize-none`}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Origen, observaciones del material…"/>
            </label>

            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ℹ️ Esta recepción queda en el historial pero <strong>no se asocia a ningún lote</strong>.
              Solo registra que el material entró al área.
            </div>
          </div>

          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 rounded-b-2xl">
            <button type="button" onClick={onClose} className="btn btn-outline px-4">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-success px-5">
              {saving ? 'Registrando…' : '✓ Registrar recepción'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ── Fila de lote (waiting o ready) ──────────────────────────────────────────
function BatchRow({ batch, mode, onReceive }) {
  const productName = batch.product_name || batch.product_type_data?.name;
  const isWaiting   = mode === 'waiting';
  const stock       = batch.tube_stock ?? 0;

  return (
    <div className={`bg-white rounded-xl border-l-4 border border-slate-100 shadow-sm p-3.5 flex items-center gap-3
      ${isWaiting ? 'border-l-amber-500' : 'border-l-green-500'}`}>
      <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-2xl flex-shrink-0">
        {isWaiting ? '⏳' : '🧺'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/lote/${batch.id}`}
            className="font-mono text-sm font-semibold text-blue-600 hover:underline">
            {batch.batch_code}
          </Link>
          {batch.item_code && (
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{batch.item_code}</span>
          )}
          <PriorityTag priority={batch.priority} />
        </div>
        <div className="font-semibold text-slate-800 truncate">{productName}</div>
        {/* Solo tubos largos disponibles de esta referencia */}
        <div className="text-sm mt-0.5">
          <span className="text-slate-400">🪵 Tubos largos en canasta: </span>
          <strong className={stock > 0 ? 'text-green-700' : 'text-slate-400'}>{stock.toLocaleString()}</strong>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {isWaiting ? (
          <button onClick={onReceive} className="btn btn-success btn-sm whitespace-nowrap">
            📥 Recibir material
          </button>
        ) : (
          <Link to={`/lote/${batch.id}`} className="btn btn-outline btn-sm">Ver lote</Link>
        )}
      </div>
    </div>
  );
}

// ── Modal de recepción para un lote ─────────────────────────────────────────
function ReceiveModal({ batch, user, onClose, onReceived }) {
  const tubeSpec = batch.product_type_data?.tube_spec_data;
  const [form, setForm] = useState({
    quantity: batch.total_quantity || '',
    delivered_by: '',
    notes: '',
    log_reception: true,  // registrar tube reception
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const payload = form.log_reception
        ? {
            quantity: Number(form.quantity) || null,
            delivered_by: form.delivered_by,
            notes: form.notes,
          }
        : {};  // sin tubería específica, solo marcar como recibido
      await Batches.receive(batch.id, payload);
      onReceived();
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
          <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Recibir material</p>
              <h2 className="text-lg font-bold text-slate-800">{batch.batch_code}</h2>
              <p className="text-xs text-slate-500">{batch.product_name || batch.product_type_data?.name}</p>
            </div>
            <button type="button" onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {err && <Alert kind="error" onClose={() => setErr('')}>{err}</Alert>}

            <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600 space-y-0.5">
              <div>👤 Recibido por: <strong className="text-slate-800">{user.full_name}</strong> <span className="text-slate-400">(automático)</span></div>
              {tubeSpec && (
                <div>📐 Tubo esperado: <strong className="text-slate-800">{tubeSpec.label}</strong></div>
              )}
            </div>

            <label className="flex items-start gap-2 cursor-pointer select-none bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <input type="checkbox" checked={form.log_reception}
                onChange={e => set('log_reception', e.target.checked)}
                className="mt-0.5"/>
              <span className="text-xs text-slate-700">
                <strong>Registrar recepción de tubería</strong>
                <span className="block text-[10px] text-slate-500">
                  Recomendado: anota cuántos tubos llegaron y quién los entregó.
                </span>
              </span>
            </label>

            {form.log_reception && (
              <>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                    Cantidad de tubos recibidos
                  </span>
                  <input type="number" min="1" required={form.log_reception} className={inp}
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
                    placeholder="Nombre del personal"/>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                    Notas
                  </span>
                  <textarea rows={2} className={`${inp} resize-none`}
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                    placeholder="Estado del material, observaciones, etc."/>
                </label>
              </>
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 rounded-b-2xl">
            <button type="button" onClick={onClose} className="btn btn-outline px-4">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-success px-5">
              {saving ? 'Registrando…' : '✓ Confirmar recepción'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function SectionTitle({ children, accent }) {
  const accentCls = accent === 'amber' ? 'text-amber-700'
                  : accent === 'green' ? 'text-green-700'
                  : 'text-slate-400';
  return (
    <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${accentCls}`}>
      {children}
    </div>
  );
}

function EmptyMsg({ text }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl py-6 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}
