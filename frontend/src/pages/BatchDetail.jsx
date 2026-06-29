import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Batches } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BackLink, StatusBadge, ProcIcon, Loading, Alert } from '../components/Common';
import { PROCESS_LABELS, formatDateTime } from '../lib/utils';

export default function BatchDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [batch, setBatch] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const refresh = () => {
    setLoading(true);
    Batches.get(id).then(setBatch).finally(() => setLoading(false));
  };

  useEffect(refresh, [id]);

  const canDispatch = batch?.status === 'finished' && user.is_supervisor;
  const canEdit     = user.is_supervisor && batch?.status !== 'dispatched';
  const [selectedUnits, setSelectedUnits] = useState([]);

  const pendingUnits = (batch?.packing_units || []).filter(u => !u.is_dispatched);
  const usesPacking  = (batch?.packing_units || []).length > 0;

  const toggleUnit = (uid) => setSelectedUnits(s =>
    s.includes(uid) ? s.filter(x => x !== uid) : [...s, uid]);

  const handleDispatchAll = async () => {
    if (!confirm('¿Despachar TODO lo que queda? El lote saldrá del seguimiento activo.')) return;
    try {
      await Batches.dispatch(id, { all: true });
      nav('/supervisor');
    } catch (err) { setError(err.message); }
  };

  const handleDispatchSelected = async () => {
    if (selectedUnits.length === 0) { setError('Selecciona al menos un medio.'); return; }
    try {
      await Batches.dispatch(id, { unit_ids: selectedUnits });
      setSelectedUnits([]);
      refresh();
    } catch (err) { setError(err.message); }
  };

  // Determine which actions can the user do per process
  const canStart  = (rec) => user.process_types?.includes(rec.process_type)
                          && (rec.status === 'pending' || rec.status === 'paused');
  const canFinish = (rec) => user.process_types?.includes(rec.process_type)
                          && rec.status === 'in_process';

  if (loading || !batch) return <Loading />;

  const tube  = batch.product_type_data?.tube_spec_data;
  const route = batch.records || [];

  return (
    <div className="max-w-3xl">
      <BackLink to={user.is_supervisor ? '/lotes' : '/operario'} />
      {error && <Alert kind="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* Header card */}
      <div className="card mb-3">
        <div className="card-body">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={batch.status} />
              </div>
              <h2 className="text-lg font-bold">{batch.product_type_data?.name}</h2>
              <div className="text-sm text-slate-600 mt-0.5">{tube?.label}</div>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <div>
                <div className="font-mono text-2xl font-semibold">{batch.total_quantity}</div>
                <div className="text-xs text-slate-400">uds totales</div>
              </div>
              {canEdit && (
                <button onClick={() => setEditing(true)}
                  className="btn btn-outline btn-sm text-xs mt-1">✏️ Editar lote</button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-2 gap-x-5 text-sm">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Longitud de corte</div>
              <div className="font-mono font-medium">{batch.product_type_data?.cut_length?.toFixed(0)} mm</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Prioridad</div>
              <div className={`font-medium priority-${batch.priority}`}>{batch.priority_display}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Fecha programada</div>
              <div className="font-medium">{batch.scheduled_date || '—'}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Progreso</div>
              <div className="font-medium">{batch.progress_pct}% completado</div>
            </div>
          </div>

          {batch.notes && (
            <div className="mt-3 px-3 py-2 bg-slate-50 rounded text-sm text-slate-600">📝 {batch.notes}</div>
          )}

          <div className="progress-bar mt-4 h-2">
            <div className={`progress-fill ${batch.progress_pct === 100 ? 'complete' : ''}`}
                 style={{ width: `${batch.progress_pct}%` }} />
          </div>
        </div>
      </div>

      {/* Características completas del tubo */}
      {tube && (
        <div className="card mb-3">
          <div className="card-header">
            <span className="card-title">
              {tube.shape === 'square' ? '🟦' : '🔵'} Características del tubo
            </span>
            <span className="text-xs text-slate-400"> {(batch.tube_stock ?? 0).toLocaleString()} tubos largos recibidos</span>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-5 text-sm">
              <SpecRow label="Forma"            value={tube.shape_display} />
              <SpecRow label="Diámetro / lado"  value={`${tube.outer_diameter} mm`} mono />
              <SpecRow label="Espesor"          value={`${tube.thickness} mm`} mono />
              <SpecRow label="Material"         value={tube.material_display} />
              <SpecRow label="Longitud original" value={`${tube.original_length?.toFixed?.(0) ?? tube.original_length} mm`} mono />
              <SpecRow label="Long. de corte"   value={`${batch.product_type_data?.cut_length?.toFixed?.(0)} mm`} mono />
              <SpecRow label="Tipo de sierra"   value={tube.saw_type_display} />
              <SpecRow label="RPM"              value={tube.rpm ?? '—'} mono />
            </div>
          </div>
        </div>
      )}

      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Flujo de procesos</div>
      <div className="flex flex-col gap-2">
        {route.map(rec => (
          <ProcessRecordCard key={rec.id} rec={rec} batch={batch}
            canStart={canStart(rec) && batchAvailable(batch, rec)}
            canFinish={canFinish(rec)} onChange={refresh} />
        ))}
      </div>

      {canDispatch && (
        <div className="mt-6 pt-4 border-t border-slate-200 space-y-3">
          {usesPacking ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  📦 Medios de manejo listos ({pendingUnits.length})
                </span>
                {batch.packed_dispatched > 0 && (
                  <span className="text-xs text-slate-400">{batch.packed_dispatched} ya despachados</span>
                )}
              </div>

              {pendingUnits.length === 0 ? (
                <p className="text-sm text-slate-400">Todo despachado.</p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {pendingUnits.map((u, i) => (
                      <label key={u.id}
                        className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:border-blue-300">
                        <input type="checkbox" checked={selectedUnits.includes(u.id)}
                          onChange={() => toggleUnit(u.id)} />
                        <span className="text-sm font-medium text-slate-700 flex-1">
                          {u.unit_type_display} {i + 1}
                        </span>
                        <span className="font-mono text-sm text-slate-600">{u.quantity} pzs</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleDispatchSelected}
                      disabled={selectedUnits.length === 0}
                      className="btn btn-primary flex-1">
                      Despachar seleccionados ({selectedUnits.length})
                    </button>
                    <button onClick={handleDispatchAll} className="btn btn-success flex-1">
                      Despachar todo
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <button onClick={handleDispatchAll} className="btn btn-success btn-full">
              📦 Despachar a almacén
            </button>
          )}
        </div>
      )}

      {editing && (
        <EditBatchModal
          batch={batch}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); refresh(); }}
          onError={setError}
        />
      )}
    </div>
  );
}

// ── Modal de edición de lote (supervisor) ───────────────────────────────────
function EditBatchModal({ batch, onClose, onSaved, onError }) {
  const [form, setForm] = useState({
    total_quantity: batch.total_quantity,
    priority:       batch.priority,
    scheduled_date: batch.scheduled_date || '',
    notes:          batch.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const maxDone = Math.max(0, ...(batch.records || []).map(r => r.qty_done || 0));

  const submit = async (e) => {
    e.preventDefault();
    const qty = Number(form.total_quantity);
    if (qty < 1) { setErr('La cantidad debe ser al menos 1.'); return; }
    setSaving(true); setErr('');
    try {
      await Batches.update(batch.id, {
        total_quantity: qty,
        priority:       form.priority,
        scheduled_date: form.scheduled_date || null,
        notes:          form.notes,
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
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">✏️ Editar lote</h2>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {err && <Alert kind="error" onClose={() => setErr('')}>{err}</Alert>}

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cantidad total (uds)</span>
              <input type="number" min="1" required className={`${inp} mt-1`}
                value={form.total_quantity}
                onChange={e => set('total_quantity', e.target.value)} />
              <span className="text-[10px] text-slate-400">
                Al cambiarla se recalculan los procesos. Lo ya producido se conserva.
                {maxDone > 0 && ` Máximo ya hecho en un proceso: ${maxDone} uds.`}
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Prioridad</span>
              <select className={`${inp} mt-1 bg-white`}
                value={form.priority}
                onChange={e => set('priority', e.target.value)}>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha programada</span>
              <input type="date" className={`${inp} mt-1`}
                value={form.scheduled_date}
                onChange={e => set('scheduled_date', e.target.value)} />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notas</span>
              <textarea rows={2} className={`${inp} mt-1 resize-none`}
                value={form.notes}
                onChange={e => set('notes', e.target.value)} />
            </label>
          </div>

          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 rounded-b-2xl">
            <button type="button" onClick={onClose} className="btn btn-outline px-4">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary px-5">
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// Helper to check process availability based on previous records
function batchAvailable(batch, rec) {
  const route = batch.records?.sort((a, b) => a.sequence - b.sequence);
  if (!route?.length) return false;
  const idx = route.findIndex(r => r.process_type === rec.process_type);
  if (idx === 0) return ['in_basket', 'in_process'].includes(batch.status);
  return route[idx - 1].status === 'finished';
}

function ProcessRecordCard({ rec, batch, canStart, canFinish, onChange }) {
  const status   = rec.status;
  const shifts   = rec.shift_entries || [];
  const remaining = rec.qty_remaining ?? Math.max(0, rec.qty_assigned - rec.qty_done);

  const cls = status === 'finished'   ? 'border-emerald-200 bg-emerald-50/40'
            : status === 'in_process' ? 'border-amber-200 bg-amber-50/40'
            : status === 'paused'     ? 'border-blue-200  bg-blue-50/40'
            : 'border-slate-200 opacity-75';

  const seqCls = status === 'finished'   ? 'bg-emerald-500 text-white'
               : status === 'in_process' ? 'bg-amber-500 text-white'
               : status === 'paused'     ? 'bg-blue-500 text-white'
               : 'bg-slate-200 text-slate-600';

  return (
    <div className={`border rounded-xl px-4 py-3 ${cls}`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${seqCls}`}>
          {status === 'finished' ? '✓' : rec.sequence}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{rec.process_label}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {status === 'pending'    && <>⏳ Pendiente — {rec.qty_assigned} uds</>}
            {status === 'paused'     && <>⏸ Pausado — <strong>{rec.qty_done}</strong> de {rec.qty_assigned} uds · faltan <strong className="text-blue-700">{remaining}</strong></>}
            {status === 'in_process' && <>🔄 Turno activo — <strong>{rec.qty_done}</strong> de {rec.qty_assigned} uds · {rec.active_shift_operator?.full_name || rec.operator_data?.full_name}</>}
            {status === 'finished'   && <>✅ {rec.qty_done} uds {rec.finished_at && `· ${formatDateTime(rec.finished_at)}`}</>}
            {rec.machine_data && status !== 'pending' && ` · ${rec.machine_data.name}`}
          </div>

          {/* Barra de progreso si hay avance */}
          {(status === 'paused' || status === 'in_process' || status === 'finished') && (
            <div className="mt-1.5 h-1.5 bg-white/70 rounded-full overflow-hidden">
              <div className={`h-full transition-all ${status === 'finished' ? 'bg-emerald-500' : status === 'in_process' ? 'bg-amber-500' : 'bg-blue-500'}`}
                   style={{ width: `${rec.progress_pct}%` }}/>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <StatusBadge status={status} />
          <div className="flex gap-1 flex-wrap justify-end">
            {/* La puesta a punto es por turno: solo con turno activo */}
            {status === 'in_process' && (
              <Link to={rec.has_quality_check ? `/calidad/ver/${rec.id}` : `/calidad/nuevo/${rec.id}`}
                className="btn btn-outline btn-sm text-[11px]" style={{ borderColor: rec.has_quality_check ? undefined : '#d97706' }}>
                {rec.has_quality_check ? '🔍 QC' : '+ QC'}
              </Link>
            )}
            {status === 'in_process' && (
              <Link to={`/dimensional/${rec.id}/nueva`} className="btn btn-outline btn-sm text-[11px]">📏</Link>
            )}
            {(status === 'finished' || status === 'paused') && (
              <Link to={`/dimensional/${rec.id}`} className="btn btn-outline btn-sm text-[11px]">📏 Dim.</Link>
            )}
            {canStart  && <Link to={`/proceso/iniciar/${rec.id}`}  className="btn btn-primary btn-sm">{status === 'paused' ? '↻ Continuar' : 'Iniciar'}</Link>}
            {canFinish && <Link to={`/proceso/terminar/${rec.id}`} className="btn btn-success btn-sm">Finalizar</Link>}
          </div>
        </div>
      </div>

      {/* Historial de turnos */}
      {shifts.length > 0 && (
        <details className="mt-2 ml-11">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 select-none">
            Ver turnos ({shifts.length})
          </summary>
          <div className="mt-2 space-y-1">
            {shifts.map(s => (
              <div key={s.id} className="text-xs bg-white/70 rounded-lg px-2.5 py-1.5 border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${s.finished_at ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}/>
                    <span className="font-medium text-slate-700">{s.operator_data?.full_name || '—'}</span>
                    {s.shift && <span className="font-mono text-slate-400">[{s.shift}]</span>}
                    {s.machine_data && <span className="text-slate-400">· {s.machine_data.name}</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-mono text-slate-700"><strong>{s.qty_done}</strong> uds</span>
                    <span className="text-slate-400">{formatDateTime(s.finished_at || s.started_at)}</span>
                  </div>
                </div>
                {s.notes && (
                  <div className="mt-1 text-slate-500 italic">📝 {s.notes}</div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ── Fila de característica del tubo ──────────────────────────────────────────
function SpecRow({ label, value, mono }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">{label}</div>
      <div className={`font-medium ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
    </div>
  );
}
