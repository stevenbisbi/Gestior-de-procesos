import { Link } from 'react-router-dom';
import { PROCESS_ICONS, PROCESS_LABELS, STATUS_BADGES, formatDate } from '../lib/utils';

export function BackLink({ to, children = '← Volver' }) {
  return <Link to={to} className="inline-flex items-center gap-1 text-slate-600 hover:text-navy text-sm mb-3">{children}</Link>;
}

export function ProcIcon({ type, size = 'md' }) {
  const sizes = { sm: 'w-7 h-7 text-sm', md: 'w-11 h-11 text-xl', lg: 'w-14 h-14 text-2xl' };
  return (
    <div className={`${sizes[size]} rounded-lg flex items-center justify-center proc-${type} flex-shrink-0`}>
      {PROCESS_ICONS[type] || '?'}
    </div>
  );
}

export function StatusBadge({ status }) {
  const b = STATUS_BADGES[status];
  if (!b) return null;
  return <span className={`badge ${b.cls}`}>{b.label}</span>;
}

export function PriorityTag({ priority }) {
  const labels = { alta: 'Alta', media: 'Media', baja: 'Baja' };
  return <span className={`priority-${priority} text-xs font-bold`}>{labels[priority] || priority}</span>;
}

/** Pipeline de procesos en miniatura */
export function MiniPipeline({ records }) {
  return (
    <div className="flex items-center gap-1 mt-1">
      {records.map((r, i) => (
        <div key={r.process_type || i} className="flex items-center gap-1">
          {i > 0 && <div className={`w-3.5 h-0.5 ${r.status === 'finished' ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
          <div className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center
            ${r.status === 'finished' ? 'bg-emerald-500 text-white' :
              r.status === 'in_process' ? 'bg-blue-500 text-white' :
              'bg-slate-200 text-slate-400'}`}>
            {r.status === 'finished' ? '✓' :
              (r.process_type === 'corte' ? '✂' :
               r.process_type === 'chaflan' ? '🔩' :
               r.process_type === 'moleteo' ? '⚙' : '🔄')}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Card de lote — usado en listas */
export function BatchCard({ batch, to }) {
  const tubeLabel = batch.tube_label || (batch.product_type_data?.tube_spec_data?.label);
  const productName = batch.product_name || batch.product_type_data?.name;
  const cutLength = batch.cut_length || batch.product_type_data?.cut_length;

  return (
    <Link to={to} className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center gap-3 hover:shadow-md hover:border-blue-300 transition">
      <div className="w-12 h-12 rounded-lg bg-slate-100 text-navy flex items-center justify-center text-2xl flex-shrink-0">
        {batch.product_type_data?.tube_spec_data?.shape === 'square' ? '🟦' : '🔵'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm text-slate-600">{batch.batch_code}</span>
          <StatusBadge status={batch.status} />
        </div>
        <div className="font-semibold text-slate-800 truncate">{productName}</div>
        <div className="text-xs text-slate-400 truncate">
          {tubeLabel} · Corte: {cutLength?.toFixed?.(0) ?? cutLength} mm · {batch.total_quantity} uds
        </div>
        {batch.process_route?.length > 0 && <MiniPipeline records={batch.process_route} />}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <PriorityTag priority={batch.priority} />
        {batch.scheduled_date && <span className="text-xs text-slate-400">📅 {formatDate(batch.scheduled_date)}</span>}
        <div className="text-right">
          <div className="progress-bar w-16">
            <div className={`progress-fill ${batch.progress_pct === 100 ? 'complete' : ''}`}
                 style={{ width: `${batch.progress_pct}%` }} />
          </div>
          <span className="text-[10px] text-slate-400">{batch.progress_pct}%</span>
        </div>
      </div>
    </Link>
  );
}

/** Banner de mensajes (success/error/info) */
export function Alert({ kind = 'info', children, onClose }) {
  const cls = {
    success: 'bg-emerald-50 border-l-2 border-emerald-500 text-emerald-800',
    error:   'bg-red-50 border-l-2 border-red-500 text-red-800',
    info:    'bg-blue-50 border-l-2 border-blue-500 text-blue-800',
    warn:    'bg-amber-50 border-l-2 border-amber-500 text-amber-800',
  }[kind];
  return (
    <div className={`px-4 py-2.5 rounded text-sm mb-4 flex items-center justify-between ${cls}`}>
      <span>{children}</span>
      {onClose && <button onClick={onClose} className="ml-3 opacity-60 hover:opacity-100">✕</button>}
    </div>
  );
}

/** Loading state */
export function Loading() {
  return <div className="py-12 text-center text-slate-400 text-sm">Cargando...</div>;
}
