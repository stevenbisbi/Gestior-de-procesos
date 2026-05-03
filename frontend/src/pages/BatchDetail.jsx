import { useEffect, useState } from 'react';
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

  const refresh = () => {
    setLoading(true);
    Batches.get(id).then(setBatch).finally(() => setLoading(false));
  };

  useEffect(refresh, [id]);

  const canDispatch = batch?.status === 'finished' && user.is_supervisor;

  const handleDispatch = async () => {
    if (!confirm('¿Confirmar despacho a almacén? El lote saldrá del seguimiento activo.')) return;
    try {
      await Batches.dispatch(id);
      nav('/supervisor');
    } catch (err) { setError(err.message); }
  };

  // Determine which actions can the user do per process
  const canStart  = (rec) => user.process_types?.includes(rec.process_type)
                          && rec.status === 'pending';
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
                <span className="font-mono text-sm text-slate-400">{batch.batch_code}</span>
                <StatusBadge status={batch.status} />
              </div>
              <h2 className="text-lg font-bold">{batch.product_type_data?.name}</h2>
              <div className="text-sm text-slate-600 mt-0.5">{tube?.label}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl font-semibold">{batch.total_quantity}</div>
              <div className="text-xs text-slate-400">uds totales</div>
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

      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Flujo de procesos</div>
      <div className="flex flex-col gap-2">
        {route.map(rec => (
          <ProcessRecordCard key={rec.id} rec={rec} batch={batch}
            canStart={canStart(rec) && batchAvailable(batch, rec)}
            canFinish={canFinish(rec)} onChange={refresh} />
        ))}
      </div>

      {canDispatch && (
        <div className="mt-6 pt-4 border-t border-slate-200">
          <button onClick={handleDispatch} className="btn btn-success btn-full">📦 Despachar a almacén</button>
        </div>
      )}
    </div>
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
  const status = rec.status;
  const cls = status === 'finished'   ? 'border-emerald-200 bg-emerald-50/40'
            : status === 'in_process' ? 'border-blue-200 bg-blue-50/40'
            : 'border-slate-200 opacity-75';

  const seqCls = status === 'finished'   ? 'bg-emerald-500 text-white'
               : status === 'in_process' ? 'bg-blue-500 text-white'
               : 'bg-slate-200 text-slate-600';

  return (
    <div className={`border rounded-xl px-4 py-3 flex items-center gap-3 ${cls}`}>
      <div className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${seqCls}`}>
        {status === 'finished' ? '✓' : rec.sequence}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{rec.process_label}</div>
        <div className="text-xs text-slate-500 mt-0.5">
          {status === 'finished' && (
            <>✅ {rec.qty_done} uds {rec.operator_data && `· ${rec.operator_data.full_name}`} {rec.finished_at && `· ${formatDateTime(rec.finished_at)}`}</>
          )}
          {status === 'in_process' && (
            <>🔄 En proceso — {rec.qty_assigned} uds {rec.operator_data && `· ${rec.operator_data.full_name}`} {rec.started_at && `· Inició: ${formatDateTime(rec.started_at)}`}</>
          )}
          {status === 'pending' && <>⏳ Pendiente — {rec.qty_assigned} uds</>}
          {rec.machine_data && ` · ${rec.machine_data.name}`}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <StatusBadge status={status} />
        <div className="flex gap-1 flex-wrap justify-end">
          {/* Quality buttons */}
          {(status === 'in_process' || status === 'finished') && (
            <Link to={rec.has_quality_check ? `/calidad/ver/${rec.id}` : `/calidad/nuevo/${rec.id}`}
              className="btn btn-outline btn-sm text-[11px]" style={{ borderColor: rec.has_quality_check ? undefined : '#d97706' }}>
              {rec.has_quality_check ? '🔍 QC' : '+ QC'}
            </Link>
          )}
          {status === 'in_process' && (
            <Link to={`/dimensional/${rec.id}/nueva`} className="btn btn-outline btn-sm text-[11px]">📏</Link>
          )}
          {status === 'finished' && (
            <Link to={`/dimensional/${rec.id}`} className="btn btn-outline btn-sm text-[11px]">📏 Dim.</Link>
          )}
          {/* Start / Finish */}
          {canStart && <Link to={`/proceso/iniciar/${rec.id}`} className="btn btn-primary btn-sm">Iniciar</Link>}
          {canFinish && <Link to={`/proceso/terminar/${rec.id}`} className="btn btn-success btn-sm">Terminar</Link>}
        </div>
      </div>
    </div>
  );
}
