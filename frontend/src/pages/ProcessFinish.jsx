import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Records } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BackLink, Alert, Loading, ProcIcon, StatusBadge } from '../components/Common';
import { formatDateTime } from '../lib/utils';
import SignaturePad from '../components/SignaturePad';

export default function ProcessFinish() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [record, setRecord] = useState(null);
  const [qtyDone, setQtyDone] = useState('');
  const [shift, setShift] = useState('');
  const [notes, setNotes] = useState('');
  const [signature, setSignature] = useState('');
  const [elapsed, setElapsed] = useState('—');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Records.get(id).then(r => {
      setRecord(r);
      setQtyDone(r.qty_assigned);
      setShift(r.shift || '');
    });
  }, [id]);

  useEffect(() => {
    if (!record?.started_at) return;
    const start = new Date(record.started_at).getTime();
    const t = setInterval(() => {
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h > 0 ? h + 'h ' : ''}${m}min ${s}s`);
    }, 1000);
    return () => clearInterval(t);
  }, [record?.started_at]);

  if (!record) return <Loading />;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await Records.finish(id, {
        qty_done: parseInt(qtyDone),
        signature, notes,
      });
      nav(`/lote/${record.batch}`);
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-xl">
      <BackLink to={`/lote/${record.batch}`} />
      {error && <Alert kind="error">{error}</Alert>}

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 mb-3">
        <ProcIcon type={record.process_type} />
        <div className="flex-1">
          <div className="font-bold">{record.process_label}</div>
          <div className="text-xs text-slate-400">Lote #{record.batch}</div>
        </div>
        <StatusBadge status="in_process" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        {/* Cantidad */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Cantidad realizada</span>
            <span className="text-xs text-slate-400">Máx: {record.qty_assigned} uds</span>
          </div>
          <div className="card-body">
            <div className="flex items-center gap-3 border-2 border-slate-200 rounded-lg px-4 py-2 bg-slate-50">
              <button type="button" onClick={() => setQtyDone(Math.max(1, qtyDone - 1))}
                className="w-8 h-8 rounded-full border bg-white hover:border-blue-500">−</button>
              <input type="number" min="1" max={record.qty_assigned} value={qtyDone}
                onChange={e => setQtyDone(Math.min(record.qty_assigned, Math.max(1, parseInt(e.target.value) || 1)))}
                className="flex-1 text-center text-2xl font-mono font-medium bg-transparent outline-none" />
              <button type="button" onClick={() => setQtyDone(Math.min(record.qty_assigned, qtyDone + 1))}
                className="w-8 h-8 rounded-full border bg-white hover:border-blue-500">+</button>
              <span className="text-sm text-slate-600">uds</span>
            </div>
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
                {record.started_at && (
                  <tr><td className="py-1 text-slate-600">Inicio</td>
                    <td className="py-1 text-right font-mono text-xs">{formatDateTime(record.started_at)}</td></tr>
                )}
                <tr><td className="py-1 text-slate-600">Tiempo transcurrido</td>
                  <td className="py-1 text-right">{elapsed}</td></tr>
                {record.machine_data && (
                  <tr><td className="py-1 text-slate-600">Máquina</td>
                    <td className="py-1 font-semibold text-right">{record.machine_data.name}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Turno + Notes */}
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
          {saving ? 'Guardando...' : '✔ CONFIRMAR TÉRMINO'}
        </button>
      </form>
    </div>
  );
}
