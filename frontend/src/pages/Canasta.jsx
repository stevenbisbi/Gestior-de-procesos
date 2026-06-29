import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Batches, TubeReceptions, Catalog } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Loading, Alert } from '../components/Common';
import { formatDateTime } from '../lib/utils';

export default function Canasta() {
  const { user }              = useAuth();
  const [inBasket, setInBasket] = useState([]);   // in_basket + in_process (con material)
  const [waiting, setWaiting] = useState([]);   // solo para el selector del modal
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [showReceive, setShowReceive] = useState(false);
  const [editTubes, setEditTubes]     = useState(null);  // lote a editar tubos largos

  const refresh = async () => {
    setLoading(true);
    try {
      const [b, p, w, h] = await Promise.all([
        Batches.list({ status: 'in_basket' }),
        Batches.list({ status: 'in_process' }),
        Batches.list({ status: 'waiting_material' }),
        TubeReceptions.list({}),
      ]);
      // En canasta = mientras el CORTE no esté terminado.
      // (in_basket = corte sin empezar; in_process = puede estar cortándose
      //  o ya en otro proceso → solo se queda si el corte aún no terminó)
      const corteSinTerminar = [...b, ...p].filter(x => {
        const corte = (x.process_route || []).find(r => r.process_type === 'corte');
        return corte && corte.status !== 'finished';
      });
      setInBasket(corteSinTerminar);
      setWaiting(w);
      setHistory(h);
    } catch (e) { setErr(e.message); }
    finally     { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  if (loading) return <Loading />;

  // Estado del corte de un lote: 'pending' | 'in_process' | 'paused'
  const corteStatus = (b) =>
    (b.process_route || []).find(r => r.process_type === 'corte')?.status || 'pending';
  const cortando = inBasket.filter(b => ['in_process', 'paused'].includes(corteStatus(b)));
  const listos   = inBasket.filter(b => corteStatus(b) === 'pending');

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="bg-navy text-white rounded-2xl px-5 py-4">
        <p className="text-xs text-white/60 font-medium uppercase tracking-wide">Recepción · Material para cortar</p>
        <h2 className="text-2xl font-bold mt-0.5">🧺 Canasta</h2>
        <p className="text-sm text-white/60 mt-0.5">
          <strong className="text-green-300">{listos.length}</strong> listos para cortar
          {cortando.length > 0 && (
            <> · <strong className="text-amber-300">{cortando.length}</strong> cortándose</>
          )}
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
          Los tubos largos son una <strong>pila compartida por tipo de tubo</strong>: las referencias del
          mismo tubo cortan del mismo stock. Si llega tubería <strong>sin orden previa</strong>, usá
          <em> "Recibir tubería suelta"</em>; para un lote que esperaba material, elegilo en el formulario.
        </span>
      </div>

      {/* En canasta */}
      <section>
        <SectionTitle accent="green">
          🧺 En canasta <span className="text-slate-500 font-normal">({inBasket.length})</span>
        </SectionTitle>
        {inBasket.length === 0 ? (
          <EmptyMsg text="Aún no hay lotes con material recibido." />
        ) : (
          <div className="space-y-2">
            {inBasket.map(b => {
              const enProceso = ['in_process', 'paused'].includes(corteStatus(b));
              return (
              <div key={b.id}
                className={`bg-white rounded-xl border border-slate-100 shadow-sm border-l-4 p-3.5 flex items-center gap-3
                  ${enProceso ? 'border-l-amber-500' : 'border-l-green-500'}`}>
                <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center text-xl flex-shrink-0"
                  title={b.tube_shape === 'square' ? 'Cuadrado' : 'Redondo'}>
                  {b.tube_shape === 'square' ? '🟦' : '🔵'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {b.item_code && (
                      <Link to={`/lote/${b.id}`} className="font-semibold text-blue-800 hover:underline truncate">
                        {b.item_code}
                      </Link>
                    )}
                    <Link to={`/lote/${b.id}`} className="font-semibold text-slate-800 hover:text-blue-600 hover:underline truncate">
                      {b.product_name}
                    </Link>
                    {enProceso && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                        ⚙ En proceso
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{b.tube_label}</div>
                </div>
                {/* Tubos largos disponibles (pila compartida por tipo de tubo) — editable */}
                <button type="button" onClick={() => setEditTubes(b)}
                  className="flex flex-col items-center px-3 flex-shrink-0 rounded-lg hover:bg-slate-50 transition"
                  title="Stock compartido de este tipo de tubo. Click para ajustar.">
                  <span className="font-mono text-xl font-bold text-green-700 leading-none">
                    {(b.tube_stock ?? 0).toLocaleString()}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">tubos largos ✏️</span>
                </button>
                <Link to={`/lote/${b.id}`} className="btn btn-outline btn-sm flex-shrink-0">Ver lote</Link>
              </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recepciones recientes — solo el supervisor */}
      {user.is_supervisor && history.length > 0 && (
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
                    <th className="text-left py-2.5 px-3">Notas</th>
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
                          {r.tube_spec_data?.label}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {r.tube_spec_data?.shape_display} · {r.tube_spec_data?.material_display}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-green-600">+{r.quantity}</td>
                      <td className="py-2.5 px-3 text-xs">
                        {r.batch
                          ? <Link to={`/lote/${r.batch}`} className="text-blue-600 hover:underline">Ver</Link>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">{r.delivered_by || '—'}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">{r.received_by_data?.full_name || '—'}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-500 max-w-[200px]">{r.notes || '—'}</td>
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
      {editTubes && (
        <EditTubesModal
          batch={editTubes}
          onClose={() => setEditTubes(null)}
          onSaved={() => { setEditTubes(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ── Modal para corregir la cantidad de tubos largos de un lote ───────────────
function EditTubesModal({ batch, onClose, onSaved }) {
  const [qty, setQty]     = useState(String(batch.tube_stock ?? 0));
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      await Batches.adjustTubes(batch.id, { quantity: Number(qty) });
      onSaved();
    } catch (ex) { setErr(ex.message); }
    finally      { setSaving(false); }
  };

  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <form onSubmit={submit}>
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Editar tubos largos</p>
              <h2 className="text-base font-bold text-slate-800 truncate max-w-[220px]">{batch.product_name}</h2>
            </div>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
          </div>
          <div className="px-5 py-4 space-y-3">
            {err && <Alert kind="error" onClose={() => setErr('')}>{err}</Alert>}
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Cantidad de tubos largos recibidos
              </span>
              <input type="number" min="0" required className={inp}
                value={qty} onChange={e => setQty(e.target.value)} autoFocus />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Se registra un ajuste con la diferencia respecto a {batch.tube_stock ?? 0}.
              </span>
            </label>
          </div>
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 rounded-b-2xl">
            <button type="button" onClick={onClose} className="btn btn-outline px-4">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary px-5">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
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
                    <option key={b.id} value={b.id}>{b.product_name}{b.item_code ? ` (${b.item_code})` : ''}</option>
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
