import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Quality, Records } from '../lib/api';
import { BackLink, Loading } from '../components/Common';
import { formatDate } from '../lib/utils';

export default function QualityDetail() {
  const { rid } = useParams();
  const [qc, setQc]         = useState(null);
  const [record, setRecord] = useState(null);

  useEffect(() => {
    Promise.all([Quality.byRecord(rid), Records.get(rid)])
      .then(([list, r]) => {
        setQc(list[0]);
        setRecord(r);
      });
  }, [rid]);

  if (!qc || !record) return <Loading />;

  return (
    <div className="max-w-2xl">
      <BackLink to={`/lote/${record.batch}`} />

      {qc.has_nonconformity ? (
        <div className="bg-red-50 border-2 border-red-300 text-red-800 rounded-lg px-4 py-2.5 mb-3 font-semibold">
          ⚠️ Este registro contiene no conformidades
        </div>
      ) : (
        <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-800 rounded-lg px-4 py-2.5 mb-3 font-semibold">
          ✅ Todos los parámetros conformes
        </div>
      )}

      <DetailSection icon="📋" title="Datos Generales" rows={[
        ['Fecha', formatDate(qc.date)],
        ['Turno', qc.shift],
        ['Operario', qc.created_by_data?.full_name || '—'],
        ['Cliente', qc.client],
        ['Ítem / Tramo', qc.item_tramo],
        ['Moto', qc.moto],
      ]} />

      <DetailSection icon="⚙️" title="Parámetros Iniciales" rows={[
        ['Dimensiones conformes', <Pill val={qc.dimensions_ok} />],
        ['Tipo de lámina', <span className="badge badge-blue">{qc.sheet_type?.toUpperCase()}</span>],
        ['Apariencia general', <Pill val={qc.appearance_ok} />],
        ['Sierra CI-TU-0034', <span className="font-mono">{qc.saw_type_ref}</span>],
        ['RPM', <span className="font-mono">{qc.rpm_ref}</span>],
      ]} />

      <DetailSection icon="🔍" title="Verificaciones" rows={[
        ['Presión mordazas', <span className={`badge ${qc.jaw_pressure === 'verificado' ? 'badge-green' : 'badge-gray'}`}>
          {qc.jaw_pressure === 'verificado' ? 'Verificado' : 'No Aplica'}
        </span>],
        ['Apariencia corte (rebaba ≤0.3mm)', <Pill val={qc.cut_appearance} />],
        ['Dist. moleteado CI-TU-0053', <span className="font-mono">{qc.knurling_distance}</span>],
        ['Libre doble moleteado', <Pill val={qc.double_knurling_free} />],
      ]} />

      <div className="mb-4">
        <SectionHeader icon="📏" title="3 Primeras Muestras" />
        <div className="bg-white border border-t-0 border-slate-200 rounded-b-md p-5 space-y-2">
          {[qc.sample_1, qc.sample_2, qc.sample_3].map((v, i) => (
            <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-md px-3 py-2">
              <div className="w-6 h-6 rounded-full bg-navy text-white text-xs font-bold flex items-center justify-center">
                {i + 1}
              </div>
              <span className="font-mono">{v}</span>
            </div>
          ))}
          {qc.observations && (
            <div className="mt-3 bg-amber-50 rounded-md px-3 py-2.5 text-sm text-amber-800">
              📝 {qc.observations}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <Link to={`/calidad/editar/${rid}`} className="btn btn-outline flex-1">✏️ Editar</Link>
        <Link to={`/dimensional/${rid}`} className="btn btn-primary flex-1">📏 Ver mediciones</Link>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <div className="bg-navy text-white px-4 py-2 rounded-t-md text-xs font-bold uppercase tracking-wider flex items-center gap-2">
      <span>{icon}</span> {title}
    </div>
  );
}

function DetailSection({ icon, title, rows }) {
  return (
    <div className="mb-3">
      <SectionHeader icon={icon} title={title} />
      <div className="bg-white border border-t-0 border-slate-200 rounded-b-md p-4">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([label, val], i) => (
              <tr key={i} className={i < rows.length - 1 ? 'border-b border-slate-100' : ''}>
                <td className="py-2 text-slate-600 w-1/2">{label}</td>
                <td className="py-2 text-right">{typeof val === 'string' ? <span className="font-medium">{val}</span> : val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pill({ val }) {
  if (!val) return '—';
  if (val === 'si' || val === 'conforme') return <span className="badge badge-green">✓ Conforme</span>;
  if (val === 'no' || val === 'no_conforme') return <span className="badge badge-red">⚠️ No Conforme</span>;
  if (val === 'no_aplica') return <span className="badge badge-gray">No Aplica</span>;
  if (val === 'otras') return <span className="badge badge-gray">Otras</span>;
  return val;
}
