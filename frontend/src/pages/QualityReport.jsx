import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Quality } from '../lib/api';
import { Loading } from '../components/Common';
import { formatDate } from '../lib/utils';

export default function QualityReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Quality.report().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <div className="stat-num">{data.total}</div>
          <div className="stat-label">Registros totales</div>
        </div>
        <div className="stat-card" style={data.nc_total > 0 ? { borderColor: '#FCA5A5' } : undefined}>
          <div className={`stat-num ${data.nc_total > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{data.nc_total}</div>
          <div className="stat-label">Con no conformidades</div>
        </div>
      </div>

      {data.nc_checks.length > 0 && (
        <section>
          <div className="text-[11px] font-bold text-red-600 uppercase tracking-wider mb-2">
            ⚠️ Registros con no conformidades
          </div>
          <div className="space-y-2">
            {data.nc_checks.map(qc => (
              <div key={qc.id} className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-sm">{qc.product_name} — {qc.process_label}</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {formatDate(qc.date)} · {qc.operator_name || qc.created_by_data?.full_name || '—'}
                  </div>
                  <div className="text-xs text-red-700 mt-0.5 flex flex-wrap gap-2">
                    {qc.dimensions_ok === 'no' && <span>• Dimensiones NC</span>}
                    {qc.appearance_ok === 'no' && <span>• Apariencia NC</span>}
                    {qc.cut_appearance === 'no_conforme' && <span>• Corte/rebaba NC</span>}
                    {qc.double_knurling_free === 'no_conforme' && <span>• Doble moleteado NC</span>}
                  </div>
                </div>
                <Link to={`/calidad/ver/${qc.process_record}`} className="btn btn-outline btn-sm">Ver</Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Todos los registros de calidad</span>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          {data.checks.length === 0 ? (
            <div className="py-12 text-center text-slate-400">No hay registros aún.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                  <th className="px-3 py-2 text-left font-semibold">Producto</th>
                  <th className="px-3 py-2 text-left font-semibold">Proceso</th>
                  <th className="px-3 py-2 text-left font-semibold">Operario</th>
                  <th className="px-3 py-2 text-left font-semibold">Dim.</th>
                  <th className="px-3 py-2 text-left font-semibold">Aparienc.</th>
                  <th className="px-3 py-2 text-left font-semibold">Corte</th>
                  <th className="px-3 py-2 text-left font-semibold">Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.checks.map(qc => (
                  <tr key={qc.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-xs">{formatDate(qc.date)}</td>
                    <td className="px-3 py-2.5 text-xs">{qc.product_name}</td>
                    <td className="px-3 py-2.5">{qc.process_label}</td>
                    <td className="px-3 py-2.5 text-xs">{qc.operator_name || qc.created_by_data?.full_name || '—'}</td>
                    <td className="px-3 py-2.5"><MiniBadge val={qc.dimensions_ok} /></td>
                    <td className="px-3 py-2.5"><MiniBadge val={qc.appearance_ok} /></td>
                    <td className="px-3 py-2.5"><MiniBadge val={qc.cut_appearance} /></td>
                    <td className="px-3 py-2.5">
                      {qc.has_nonconformity ?
                        <span className="badge badge-red text-[10px]">⚠️ NC</span> :
                        <span className="badge badge-green text-[10px]">✅ OK</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link to={`/calidad/ver/${qc.process_record}`} className="btn btn-outline btn-sm">Ver</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniBadge({ val }) {
  if (val === 'si' || val === 'conforme') return <span className="badge badge-green text-[10px]">OK</span>;
  if (val === 'no' || val === 'no_conforme') return <span className="badge badge-red text-[10px]">NC</span>;
  return <span className="badge badge-gray text-[10px]">—</span>;
}
