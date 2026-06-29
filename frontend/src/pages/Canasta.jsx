import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { TubeReceptions, Batches, Catalog } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Loading, Alert } from '../components/Common';
import { formatDateTime } from '../lib/utils';

const SHAPE_ICON = { square: '🟦', round: '🔵', rectangular: '🟦' };

export default function Canasta() {
  const { user }            = useAuth();
  const [tubes, setTubes]   = useState([]);   // basket: [{tube_spec, total, last_received}]
  const [history, setHistory] = useState([]);
  const [waiting, setWaiting] = useState([]); // lotes waiting_material para el modal de recepción
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [showReceive, setShowReceive] = useState(false);
  const [adjustSpec, setAdjustSpec]   = useState(null); // tube_spec_data a editar

  const refresh = async () => {
    setLoading(true);
    try {
      const [basket, hist, w] = await Promise.all([
        TubeReceptions.basket(),
        TubeReceptions.list({}),
        Batches.list({ status: 'waiting_material' }),
      ]);
      setTubes(basket);
      setHistory(hist);
      setWaiting(w);
    } catch (e) { setErr(e.message); }
    finally     { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  if (loading) return <Loading />;

  const totalTubes = tubes.reduce((s, t) => s + (t.total || 0), 0);

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="bg-navy text-white rounded-2xl px-5 py-4">
        <p className="text-xs text-white/60 font-medium uppercase tracking-wide">Inventario de material</p>
        <h2 className="text-2xl font-bold mt-0.5">Canasta</h2>
        <p className="text-sm text-white/60 mt-0.5">
          <strong className="text-green-300">{totalTubes.toLocaleString()}</strong> tubos largos en planta
          {' · '}
          <strong className="text-white">{tubes.filter(t => t.total > 0).length}</strong> tipos disponibles
        </p>
        <button onClick={() => setShowReceive(true)}
          className="mt-3 inline-flex items-center gap-2 text-white font-medium hover:text-green-300 transition text-sm">
          📥 Recibir tubería
        </button>
      </div>

      {err && <Alert kind="error" onClose={() => setErr('')}>{err}</Alert>}

      {/* Inventario por tipo de tubo */}
      <section>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Tubos largos disponibles
        </div>

        {tubes.length === 0 ? (
          <div className="bg-slate-50 border border-slate-100 rounded-xl py-8 text-center text-sm text-slate-400">
            No hay tubería registrada en la canasta todavía.
          </div>
        ) : (
          <div className="space-y-2">
            {tubes.filter(row => (row.total ?? 0) > 0).map(row => {
              const ts = row.tube_spec;
              const qty = row.total ?? 0;
              const shape = ts.shape || 'round';
              return (
                <div key={ts.id}
                  className="bg-white rounded-xl border border-slate-100 shadow-sm p-3.5 flex items-center gap-3">
                  {/* Ícono forma */}
                  <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center text-xl flex-shrink-0"
                    title={ts.shape_display}>
                    {SHAPE_ICON[shape] || '🔵'}
                  </div>

                  {/* Detalles del tubo */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 text-sm leading-tight">
                      Ø {ts.outer_diameter} × {ts.thickness} x {ts.original_length?.toLocaleString() ?? '—'} mm
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                      <span>{ts.material_display}</span>
                      <span>·</span>
                      <span>{ts.shape_display}</span>
                      
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Última recepción: {formatDateTime(row.last_received)}
                    </div>
                  </div>

                  {/* Cantidad */}
                  <div className={`flex flex-col items-center px-3 flex-shrink-0 ${qty <= 0 ? 'text-red-500' : 'text-green-700'}`}>
                    <span className="font-mono text-2xl font-bold leading-none">
                      {qty.toLocaleString()}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">tubos</span>
                  </div>

                  {/* Ajustar (solo supervisor) */}
                  {user.is_supervisor && (
                    <button type="button" onClick={() => setAdjustSpec({ ts, current: qty })}
                      className="btn btn-outline btn-sm flex-shrink-0" title="Ajustar cantidad">
                      ✏️
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recepciones recientes — solo supervisor */}
      {user.is_supervisor && history.length > 0 && (
        <section>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Recepciones recientes
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left py-2.5 px-3 whitespace-nowrap">Fecha</th>
                    <th className="text-left py-2.5 px-3">Tubería</th>
                    <th className="text-center py-2.5 px-3">Cant.</th>
                    <th className="text-left py-2.5 px-3">Lote</th>
                    <th className="text-left py-2.5 px-3">Almacén</th>
                    <th className="text-left py-2.5 px-3">Recibió</th>
                    <th className="text-left py-2.5 px-3">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {history.filter(r => r.delivered_by !== 'Consumo de corte').slice(0, 40).map(r => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                        {formatDateTime(r.received_at)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-xs font-medium text-slate-700">{r.tube_spec_data?.label}</div>
                        <div className="text-[10px] text-slate-400">
                          {r.tube_spec_data?.shape_display} · {r.tube_spec_data?.material_display}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold"
                        style={{ color: r.quantity >= 0 ? '#16a34a' : '#dc2626' }}>
                        {r.quantity >= 0 ? '+' : ''}{r.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-xs">
                        {r.batch
                          ? <Link to={`/lote/${r.batch}`} className="text-blue-600 hover:underline">Ver</Link>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">{r.delivered_by || '—'}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">{r.received_by_data?.full_name || '—'}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-500 max-w-[180px] truncate" title={r.notes || ''}>
                        {r.notes || '—'}
                      </td>
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

      {adjustSpec && (
        <AdjustSpecModal
          ts={adjustSpec.ts}
          current={adjustSpec.current}
          onClose={() => setAdjustSpec(null)}
          onSaved={() => { setAdjustSpec(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ── Modal para ajustar stock por tipo de tubo (supervisor) ───────────────────
function AdjustSpecModal({ ts, current, onClose, onSaved }) {
  const [qty, setQty]       = useState(String(current));
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      await TubeReceptions.adjustSpec({ tube_spec_id: ts.id, quantity: Number(qty) });
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
              <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Ajustar stock</p>
              <h2 className="text-base font-bold text-slate-800">
                Ø {ts.outer_diameter} × {ts.thickness} mm · {ts.material_display}
              </h2>
              <p className="text-xs text-slate-500">{ts.original_length?.toLocaleString()} mm largo</p>
            </div>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
          </div>
          <div className="px-5 py-4 space-y-3">
            {err && <Alert kind="error" onClose={() => setErr('')}>{err}</Alert>}
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Nueva cantidad total de tubos largos
              </span>
              <input type="number" min="0" required className={inp}
                value={qty} onChange={e => setQty(e.target.value)} autoFocus />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Stock actual: <strong>{current}</strong>
                {Number(qty) !== current && (
                  <span className={Number(qty) > current ? ' text-green-600' : ' text-red-600'}>
                    {' '}→ {Number(qty) > current ? '+' : ''}{Number(qty) - current}
                  </span>
                )}
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
                    El lote pasará a estado "En canasta".
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
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Cantidad de tubos largos</span>
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
