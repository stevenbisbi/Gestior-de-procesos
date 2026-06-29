import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Records, Batches } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Loading, Alert, ProcIcon } from '../components/Common';
import { formatDateTime, PROCESS_LABELS } from '../lib/utils';

export default function Defectuosos() {
  const { user }              = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [target, setTarget]   = useState(null);  // record para rework

  // Cargamos todos los lotes activos y filtramos los procesos con qty_defective > 0
  const refresh = async () => {
    setLoading(true);
    try {
      const batches = await Batches.list({ exclude_dispatched: '1' });
      // Pedimos detalle solo de los lotes que están in_process/finished/in_basket
      // donde puede haber records con defectuosos
      const detailed = await Promise.all(
        batches
          .filter(b => ['in_process', 'finished'].includes(b.status))
          .map(b => Batches.get(b.id))
      );
      const allRecords = [];
      for (const batch of detailed) {
        for (const r of (batch.records || [])) {
          if ((r.qty_defective || 0) > 0) {
            allRecords.push({ ...r, batch_data: batch });
          }
        }
      }
      setRecords(allRecords);
    } catch (e) { setErr(e.message); }
    finally     { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  if (loading) return <Loading />;

  const totalDefective = records.reduce((s, r) => s + (r.qty_defective || 0), 0);
  const totalScrapped  = records.reduce((s, r) => s + (r.qty_scrapped  || 0), 0);

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="bg-navy text-white rounded-2xl px-5 py-4">
        <p className="text-xs text-white/60 font-medium uppercase tracking-wide">Control de calidad · Material a revisar</p>
        <h1 className="text-2xl font-bold mt-0.5">🔧 Tubería defectuosa</h1>
        <p className="text-sm text-white/60 mt-0.5">
          <strong className="text-red-300">{totalDefective.toLocaleString()}</strong> piezas en reporceso·{' '}
          <strong className="text-gray-300">{totalScrapped.toLocaleString()}</strong> descartadas (acumulado)
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-900 flex items-start gap-2">
        <span className="text-base">💡</span>
        <span>
          Cuando un operario reporta defectos al cerrar un turno, las piezas quedan acá. Después de pulir/limar
          (o descartar), <strong>reincorporalas</strong> para que el siguiente proceso pueda contarlas.
        </span>
      </div>

      {err && <Alert kind="error" onClose={() => setErr('')}>{err}</Alert>}

      {records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">✨</div>
          <p className="text-lg font-medium">Sin tubería defectuosa pendiente</p>
          <p className="text-sm mt-1">Cuando un operario reporte defectos al cerrar turno, aparecerán aquí.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(rec => (
            <div key={rec.id}
              className="bg-white rounded-xl border border-slate-100 shadow-sm border-l-4 border-l-red-500 p-4">
              <div className="flex items-start gap-3">
                <ProcIcon type={rec.process_type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Link to={`/lote/${rec.batch}`}
                      className="font-mono text-sm font-semibold text-blue-600 hover:underline">
                      {rec.batch_code}
                    </Link>
                    <span className="text-sm font-medium text-slate-700">·</span>
                    <span className="font-semibold text-slate-800">
                      {PROCESS_LABELS[rec.process_type]}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600">{rec.product_name}</div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className="bg-slate-50 rounded-lg px-2 py-2">
                      <div className="text-[10px] uppercase text-slate-400 font-semibold">Producido</div>
                      <div className="font-mono font-bold text-slate-700">{rec.qty_done?.toLocaleString()}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg px-2 py-2">
                      <div className="text-[10px] uppercase text-red-500 font-semibold">Defectuosas</div>
                      <div className="font-mono font-bold text-red-700">{rec.qty_defective?.toLocaleString()}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg px-2 py-2">
                      <div className="text-[10px] uppercase text-green-600 font-semibold">Buenas → siguiente</div>
                      <div className="font-mono font-bold text-green-700">{rec.qty_good?.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Historial de reworks */}
                  {(rec.rework_entries || []).length > 0 && (
                    <details className="mt-3">
                      <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 select-none">
                        Ver reworks anteriores ({rec.rework_entries.length})
                      </summary>
                      <div className="mt-2 space-y-1">
                        {rec.rework_entries.map(re => (
                          <div key={re.id} className="text-xs bg-slate-50 rounded px-2.5 py-1.5 flex items-center justify-between">
                            <div>
                              <span className="text-green-700 font-mono font-semibold">+{re.qty_reworked} recuperadas</span>
                              <span className="text-slate-400 mx-1.5">·</span>
                              <span className="text-gray-500 font-mono">{re.qty_scrapped} descartadas</span>
                              {re.notes && <span className="text-slate-400 ml-2 italic">"{re.notes}"</span>}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {re.operator_data?.full_name} · {formatDateTime(re.created_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>

                {/* Botón de rework */}
                <button onClick={() => setTarget(rec)}
                  className="btn btn-success btn-sm whitespace-nowrap">
                  🔧 Reincorporar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {target && (
        <ReworkModal
          record={target}
          user={user}
          onClose={() => setTarget(null)}
          onSaved={() => { setTarget(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ── Modal de rework ──────────────────────────────────────────────────────────
function ReworkModal({ record, user, onClose, onSaved }) {
  const [form, setForm] = useState({
    qty_reworked: '',
    qty_scrapped: '',
    notes:        '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const rew = parseInt(form.qty_reworked) || 0;
  const scr = parseInt(form.qty_scrapped) || 0;
  const total = rew + scr;
  const exceeds = total > record.qty_defective;

  const submit = async (e) => {
    e.preventDefault();
    if (total <= 0)  { setErr('Indicá cuántas se recuperaron o se descartaron.'); return; }
    if (exceeds)     { setErr(`El total (${total}) excede el pool actual (${record.qty_defective}).`); return; }
    setSaving(true); setErr('');
    try {
      await Records.rework(record.id, {
        qty_reworked: rew,
        qty_scrapped: scr,
        notes: form.notes,
      });
      onSaved();
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
              <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Reincorporar tubería</p>
              <h2 className="text-lg font-bold text-slate-800">{record.batch_code} · {PROCESS_LABELS[record.process_type]}</h2>
              <p className="text-xs text-slate-500">{record.product_name}</p>
            </div>
            <button type="button" onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {err && <Alert kind="error" onClose={() => setErr('')}>{err}</Alert>}

            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-800">
              📊 Pool actual de defectuosas: <strong>{record.qty_defective}</strong> piezas
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                ✅ Piezas recuperadas
              </span>
              <input type="number" min="0" max={record.qty_defective} className={inp}
                value={form.qty_reworked}
                onChange={e => set('qty_reworked', e.target.value)}
                placeholder="0"/>
              <span className="text-[10px] text-slate-400 block mt-1">
                Cuántas piezas quedaron bien después de pulir/limar/arreglar. Vuelven al flujo.
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                🗑️ Piezas descartadas
              </span>
              <input type="number" min="0" max={record.qty_defective} className={inp}
                value={form.qty_scrapped}
                onChange={e => set('qty_scrapped', e.target.value)}
                placeholder="0"/>
              <span className="text-[10px] text-slate-400 block mt-1">
                Cuántas no se pudieron recuperar. Quedan como merma definitiva.
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Notas
              </span>
              <textarea rows={2} className={`${inp} resize-none`}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Tipo de defecto, cómo se arregló, etc."/>
            </label>

            {total > 0 && !exceeds && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800">
                <strong>+{rew}</strong> volverán al flujo (siguiente proceso las verá) ·{' '}
                <strong>{scr}</strong> quedan como merma · Pool restante: <strong>{record.qty_defective - total}</strong>
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 rounded-b-2xl">
            <button type="button" onClick={onClose} className="btn btn-outline px-4">Cancelar</button>
            <button type="submit" disabled={saving || total === 0 || exceeds} className="btn btn-success px-5">
              {saving ? 'Procesando…' : '✓ Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
