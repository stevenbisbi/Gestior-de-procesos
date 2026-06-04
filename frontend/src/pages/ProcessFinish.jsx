import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Records } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BackLink, Alert, Loading, ProcIcon, StatusBadge } from '../components/Common';
import { formatDateTime } from '../lib/utils';
import SignaturePad from '../components/SignaturePad';

export default function ProcessFinish() {
  const { id } = useParams();
  const nav    = useNavigate();
  const { user } = useAuth();

  const [record, setRecord]       = useState(null);
  const [qtyDone, setQtyDone]     = useState('');
  const [shift, setShift]         = useState('');
  const [notes, setNotes]         = useState('');
  const [signature, setSignature] = useState('');
  const [elapsed, setElapsed]     = useState('—');
  const [error, setError]         = useState(null);
  const [saving, setSaving]       = useState(false);
  const [finalize, setFinalize]   = useState(false); // finalizar referencia aunque falten uds

  useEffect(() => {
    Records.get(id).then(r => {
      setRecord(r);
      // Por defecto: lo que falta (si es poco) o vacío para que el operario lo escriba
      const remaining = r.qty_remaining ?? (r.qty_assigned - r.qty_done);
      setQtyDone(remaining > 0 ? remaining : 1);
      setShift(r.shift || '');
    });
  }, [id]);

  // Cronómetro del turno actual
  useEffect(() => {
    if (!record) return;
    const activeShift = record.shift_entries?.find(s => !s.finished_at);
    const startStr = activeShift?.started_at || record.started_at;
    if (!startStr) return;
    const start = new Date(startStr).getTime();
    const t = setInterval(() => {
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h > 0 ? h + 'h ' : ''}${m}min ${s}s`);
    }, 1000);
    return () => clearInterval(t);
  }, [record]);

  if (!record) return <Loading />;

  const remaining   = record.qty_remaining ?? (record.qty_assigned - record.qty_done);
  const numericQty  = Math.max(1, Math.min(remaining, parseInt(qtyDone) || 1));
  // El proceso se completa si se alcanza el total O si el operario marca "finalizar"
  const reachesTotal = numericQty >= remaining;
  const willFinish   = reachesTotal || finalize;
  const shortage     = remaining - numericQty;  // unidades que faltarían si finaliza

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await Records.finish(id, {
        qty_done:  numericQty,
        signature, notes,
        finalize:  finalize || reachesTotal,
      });
      nav(`/lote/${record.batch}`);
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-xl">
      <BackLink to={`/lote/${record.batch}`} />
      {error && <Alert type="error">{error}</Alert>}

      {/* Cabecera del proceso */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 mb-3">
        <ProcIcon type={record.process_type} />
        <div className="flex-1">
          <div className="font-bold">{record.process_label}</div>
          <div className="text-xs text-slate-400">Lote #{record.batch}</div>
        </div>
        <StatusBadge status="in_process" />
      </div>

      {/* Estado de avance del proceso completo */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-3">
        <div className="flex items-center justify-between text-xs text-blue-900 mb-1.5">
          <span className="font-semibold uppercase tracking-wide">Avance total del proceso</span>
          <span className="font-mono">{record.progress_pct}%</span>
        </div>
        <div className="grid grid-cols-3 text-center text-sm gap-2 mb-2">
          <div>
            <div className="text-xs text-blue-700/70">Asignado</div>
            <div className="font-bold text-blue-900">{record.qty_assigned.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-blue-700/70">Hecho hasta ahora</div>
            <div className="font-bold text-blue-900">{record.qty_done.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-blue-700/70">Restante</div>
            <div className="font-bold text-amber-600">{remaining.toLocaleString()}</div>
          </div>
        </div>
        <div className="h-2 bg-white/60 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${record.progress_pct}%` }}/>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {/* Cantidad realizada */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">¿Cuántas piezas realizaste?</span>
            <span className="text-xs text-slate-400">Máx: {remaining} uds</span>
          </div>
          <div className="card-body">
            <div className="flex items-center gap-3 border-2 border-slate-200 rounded-lg px-4 py-2 bg-slate-50">
              <button type="button" onClick={() => setQtyDone(Math.max(1, numericQty - 1))}
                className="w-8 h-8 rounded-full border bg-white hover:border-blue-500">−</button>
              <input type="number" min="1" max={remaining} value={qtyDone}
                onChange={e => setQtyDone(e.target.value)}
                className="flex-1 text-center text-2xl font-mono font-medium bg-transparent outline-none" />
              <button type="button" onClick={() => setQtyDone(Math.min(remaining, numericQty + 1))}
                className="w-8 h-8 rounded-full border bg-white hover:border-blue-500">+</button>
              <span className="text-sm text-slate-600">uds</span>
            </div>

            {/* Indicador del resultado */}
            {reachesTotal ? (
              <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
                ✅ Con esta cantidad <strong>se completa</strong> el proceso. Quedará marcado como Terminado.
              </div>
            ) : finalize ? (
              <div className="mt-3 bg-orange-50 border border-orange-300 rounded-lg px-3 py-2 text-sm text-orange-800">
                ⚠️ Vas a <strong>finalizar la referencia</strong> con {shortage.toLocaleString()} uds menos
                (pérdida de material). El proceso quedará Terminado y nadie continuará el saldo.
              </div>
            ) : (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
                ⏸ Quedarán <strong>{shortage.toLocaleString()} uds</strong> pendientes. Otro operario (o vos en otro momento) podrá continuarlas.
              </div>
            )}

            {/* Finalizar aunque falten unidades (merma) */}
            {!reachesTotal && (
              <label className="mt-3 flex items-start gap-2 cursor-pointer select-none bg-white border border-slate-200 rounded-lg px-3 py-2">
                <input type="checkbox" checked={finalize}
                  onChange={e => setFinalize(e.target.checked)}
                  className="mt-0.5" />
                <span className="text-sm text-slate-700">
                  <strong>Finalizar la referencia completa</strong> aunque falten {shortage.toLocaleString()} uds
                  <span className="block text-xs text-slate-400">
                    Úsalo cuando se perdió material y no se van a producir las piezas faltantes.
                  </span>
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="card">
          <div className="card-body">
            <table className="w-full text-sm">
              <tbody>
                <tr><td className="py-1 text-slate-600">Proceso</td>
                  <td className="py-1 font-semibold text-right">{record.process_label}</td></tr>
                <tr><td className="py-1 text-slate-600">Operario</td>
                  <td className="py-1 font-semibold text-right">{user.full_name}</td></tr>
                <tr><td className="py-1 text-slate-600">Tiempo trabajado</td>
                  <td className="py-1 text-right">{elapsed}</td></tr>
                {record.machine_data && (
                  <tr><td className="py-1 text-slate-600">Máquina</td>
                    <td className="py-1 font-semibold text-right">{record.machine_data.name}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Turno + Notas */}
        <div className="card">
          <div className="card-body space-y-3">
            <div>
              <label className="form-label">Turno</label>
              <select value={shift} onChange={e => setShift(e.target.value)} className="form-select">
                <option value="">Seleccionar...</option>
                <option value="A">Turno A (06:00–14:00)</option>
                <option value="B">Turno B (14:00–22:00)</option>
                <option value="C">Turno C (22:00–06:00)</option>
              </select>
            </div>
            <div>
              <label className="form-label">Observaciones (opcional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                rows="2" className="form-textarea" placeholder="Escribe una observación..." />
            </div>
          </div>
        </div>

        {/* Firma */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">✍️ Firma del operario</span>
          </div>
          <div className="card-body pt-2">
            <SignaturePad value={signature} onChange={setSignature} />
            <p className="text-[11px] text-slate-400 mt-1 text-center">Firma con el dedo o ratón</p>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn btn-success btn-full py-4 text-base">
          {saving ? 'Guardando...'
            : reachesTotal ? '✔ FINALIZAR PROCESO'
            : finalize     ? '⚠️ FINALIZAR CON MERMA'
            : '✔ FINALIZAR'}
        </button>
      </form>
    </div>
  );
}
