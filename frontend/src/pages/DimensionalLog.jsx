import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Records, DimLogs } from '../lib/api';
import { BackLink, Loading, ProcIcon } from '../components/Common';
import { formatDateTime } from '../lib/utils';

export default function DimensionalLog() {
  const { rid } = useParams();
  const [record, setRecord] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    Promise.all([Records.get(rid), DimLogs.byRecord(rid)])
      .then(([r, l]) => { setRecord(r); setLogs(l); });
  }, [rid]);

  if (!record) return <Loading />;
  const ncCount = logs.filter(l => l.result === 'no_conforme').length;

  return (
    <div className="max-w-2xl">
      <BackLink to={`/lote/${record.batch}`} />

      <div className="bg-navy-mid text-white rounded-xl p-3.5 flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-[11px] text-white/50">Registro dimensional en proceso</div>
          <div className="text-base font-bold">{record.product_name} — {record.process_label}</div>
        </div>
        <div className="text-right">
          {ncCount > 0 ? (
            <span className="badge badge-red">⚠️ {ncCount} NC</span>
          ) : (
            <span className="badge badge-green">✅ Todo conforme</span>
          )}
          <div className="text-xs text-white/45 mt-1">{logs.length} medición{logs.length !== 1 && 'es'}</div>
        </div>
      </div>

      {record.status === 'in_process' && (
        <Link to={`/dimensional/${rid}/nueva`} className="btn btn-primary btn-full mb-4">
          + Nueva medición (~cada 20 piezas)
        </Link>
      )}

      {logs.length > 0 ? (
        <>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Historial de mediciones
          </div>
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id}
                className={`bg-white border rounded-xl p-3.5 flex items-start gap-3 ${
                  log.result === 'no_conforme' ? 'border-l-4 border-l-red-500 bg-red-50/40' : 'border-l-4 border-l-emerald-500'
                }`}>
                <div className={`w-9 h-9 rounded-lg font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                  log.result === 'no_conforme' ? 'bg-red-500 text-white' : 'bg-navy text-white'}`}>
                  ~{log.piece_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">
                      {formatDateTime(log.logged_at)}
                      {log.operator_data && ` · ${log.operator_data.full_name}`}
                    </span>
                    {log.result === 'no_conforme'
                      ? <span className="badge badge-red text-[10px]">✗ No Conforme</span>
                      : <span className="badge badge-green text-[10px]">✓ Conforme</span>}
                  </div>
                  <div className="flex gap-2 flex-wrap mt-1">
                    <Pill label={log.measure_label_1} value={log.measure_1} />
                    {log.measure_2 && <Pill label={log.measure_label_2 || 'Medida 2'} value={log.measure_2} />}
                    {log.measure_3 && <Pill label={log.measure_label_3 || 'Medida 3'} value={log.measure_3} />}
                  </div>
                  {log.notes && <div className="text-xs text-slate-600 mt-1.5">📝 {log.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="py-12 text-center text-slate-400">
          <div className="text-5xl mb-3">📏</div>
          <p>Aún no hay mediciones registradas.</p>
        </div>
      )}
    </div>
  );
}

function Pill({ label, value }) {
  return (
    <div className="bg-slate-100 rounded px-2 py-0.5 font-mono text-xs text-slate-800">
      <span className="block text-[10px] text-slate-400">{label}</span>
      {value}
    </div>
  );
}
