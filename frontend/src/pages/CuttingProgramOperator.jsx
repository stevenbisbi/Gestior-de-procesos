import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { CuttingPrograms } from '../lib/api';
import { Loading } from '../components/Common';
import { formatDate } from '../lib/utils';

const BATCH_STATUS = {
  in_basket:  { cls: 'bg-blue-100  text-blue-700  border-blue-200',  label: 'En canasta',  dot: 'bg-blue-400'  },
  in_process: { cls: 'bg-amber-100 text-amber-700 border-amber-200', label: 'En proceso',  dot: 'bg-amber-400' },
  paused:     { cls: 'bg-blue-100  text-blue-700  border-blue-200',  label: 'Pausado',     dot: 'bg-blue-400'  },
  finished:   { cls: 'bg-green-100 text-green-700 border-green-300', label: 'Terminado',   dot: 'bg-green-500' },
  dispatched: { cls: 'bg-gray-100  text-gray-400  border-gray-200',  label: 'Despachado',  dot: 'bg-gray-300'  },
};

// Hoy a las 00:00 para comparar con start_date/end_date
function isTodayInRange(start, end) {
  if (!start || !end) return false;
  const t = new Date(); t.setHours(0,0,0,0);
  const s = new Date(start); s.setHours(0,0,0,0);
  const e = new Date(end);   e.setHours(0,0,0,0);
  return t >= s && t <= e;
}

// ── Modal de detalle completo de una línea ──────────────────────────────────
function LineDetailModal({ line, onClose }) {
  if (!line) return null;
  const bs = BATCH_STATUS[line.batch_status] || {};

  const Row = ({ label, value, mono, color }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-b-0">
      <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono' : ''} ${color || 'text-slate-800'} font-semibold text-right`}>
        {value || '—'}
      </span>
    </div>
  );

  const Section = ({ title, children }) => (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{title}</p>
      <div className="bg-slate-50 rounded-lg px-3 py-2">{children}</div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Detalle de línea</p>
            <h2 className="text-lg font-bold text-slate-800 truncate">{line.product_type_data?.name}</h2>
            <p className="text-xs text-slate-500 truncate">{line.tube_description}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none flex-shrink-0">✕</button>
        </div>

        {/* Cuerpo */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <Section title="Identificación">
            <Row label="Item"  value={line.item_code} mono />
            <Row label="Cliente"     value={line.client} />
            <Row label="Embalaje"    value={line.packaging} />
          </Section>

          <Section title="Programación">
            <Row label="Fecha inicio" value={formatDate(line.start_date)} />
            <Row label="Fecha final"  value={formatDate(line.end_date)} />
            <Row label="Piezas/hora"  value={line.pieces_per_hour} mono />
          </Section>

          <Section title="Cantidades">
            <Row label="Cantidad pedida"  value={line.total_quantity?.toLocaleString()}  mono />
          </Section>

          <Section title="Tubo largo (materia prima)">
            <Row label="Tubos largos"     value={line.tube_count} mono />
            <Row label="Tramos por tubo"  value={line.sections_per_tube} mono />
            <Row label="Longitud (mm)"    value={line.tube_length_mm} mono />
          </Section>

          <Section title="Sierra y velocidades">
            <Row label="Tipo sierra"      value={line.saw_type_display} color="text-indigo-700" />
            <Row label="N° dientes"       value={line.saw_teeth} mono />
            <Row label="RPM"              value={line.rpm} mono color="text-amber-700" />
            <Row label="Avance HIGH"      value={line.advance_high} mono />
            <Row label="Avance LOW"       value={line.advance_low} mono />
          </Section>

          {line.notes && (
            <Section title="Notas">
              <p className="text-sm text-slate-700">{line.notes}</p>
            </Section>
          )}

          {/* Lote enlazado */}
          {line.batch_id && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-blue-700 uppercase tracking-wide font-bold">Lote generado</p>
                <Link to={`/lote/${line.batch_id}`}
                  className="text-base font-bold text-blue-700 hover:underline">
                  Ver lote
                </Link>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${bs.cls}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${bs.dot}`}/>
                {bs.label}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 rounded-b-2xl">
          {line.batch_id && (
            <Link to={`/lote/${line.batch_id}`} className="btn btn-primary px-4">
              Ir al lote →
            </Link>
          )}
          <button type="button" onClick={onClose} className="btn btn-outline px-4">Cerrar</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Página ────────────────────────────────────────────────────────────────
export default function CuttingProgramOperator() {
  const [program,  setProgram]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [noActive, setNoActive] = useState(false);
  const [selected, setSelected] = useState(null); // línea en el modal

  useEffect(() => {
    CuttingPrograms.active()
      .then(setProgram)
      .catch(() => setNoActive(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  if (noActive) {
    return (
      <div className="text-center py-20 text-slate-400">
        <div className="text-5xl mb-4">📋</div>
        <p className="text-lg font-medium">Sin programa activo</p>
        <p className="text-sm mt-1">El líder aún no ha activado el programa del mes.</p>
      </div>
    );
  }

  // Agrupadas por tubo largo (forma + diámetro + espesor) para minimizar
  // cambios de setup en la cortadora; dentro del grupo, orden de alta.
  const tubeKey = (l) => {
    const ts = l.product_type_data?.tube_spec_data;
    return ts ? `${ts.shape}|${ts.outer_diameter}|${ts.thickness}` : '~';
  };
  const lines = [...(program?.lines || [])].sort(
    (a, b) => tubeKey(a).localeCompare(tubeKey(b), undefined, { numeric: true })
  );

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="bg-navy text-white rounded-2xl px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/60 font-medium uppercase tracking-wide">Programa activo · Bewo</p>
          <h1 className="text-xl font-bold mt-0.5">
            {program.month_display}{' '}
            <span className="text-white/50 text-sm font-normal">v{program.version}</span>
          </h1>
          <p className="text-sm text-white/60 mt-0.5">
            {lines.length} líneas · {lines.reduce((s,l) => s + (l.total_quantity || 0), 0).toLocaleString()} piezas a cortar
          </p>
        </div>
        <span className="text-4xl">✂️</span>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 inline-block"/> Vigente hoy</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-slate-200 inline-block"/> Otro rango</span>
        <span className="ml-auto text-slate-400">Tocá "Ver" para más detalle de cada línea</span>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide border-b border-slate-100">
              <tr>
                <th className="py-3 px-3 text-left whitespace-nowrap">Item</th>
                <th className="py-3 px-3 text-left">Producto / Tubo</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Cantidades</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Tubo largo</th>
                <th className="py-3 px-3 text-left whitespace-nowrap">Fechas</th>
                <th className="py-3 px-3 text-left whitespace-nowrap">Sierra</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Avance</th>
                <th className="py-3 px-3 text-left whitespace-nowrap">Cliente</th>
                <th className="py-3 px-3 text-center">Lote</th>
                <th className="py-3 px-3 text-center w-16"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map(line => {
                const isToday = isTodayInRange(line.start_date, line.end_date);
                const bs = BATCH_STATUS[line.batch_status] || {};
                return (
                  <tr key={line.id}
                    className={`border-t border-slate-100 transition-colors ${isToday ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
                  {/* Item */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800">{line.item_code}</span>
                      </div>
                      
                    </td>  
                    {/* Producto */}
                    <td className="py-3 px-3">                   
                        <div className="font-semibold text-slate-800">{line.tube_description}</div>
                        <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[260px]">{line.product_type_data?.name}</div>                  
                    </td>
                    {/* Cantidades */}
                    <td className="py-3 px-3 text-center">
                      <div className="text-sm font-bold text-slate-800">{line.total_quantity?.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400">pedidas</div>
                      {line.pieces_per_hour && <div className="text-[10px] text-slate-400 mt-1">{line.pieces_per_hour} pz/h</div>}
                    </td>
                    {/* Tubo largo */}
                    <td className="py-3 px-3 text-center text-xs text-slate-600">
                      {line.tube_count ? <div className="font-bold text-sm text-slate-700">{line.tube_count}</div> : <span className="text-slate-300">—</span>}
                      {line.tube_count != null && <div className="text-[10px] text-slate-400">tubos</div>}
                      {line.sections_per_tube && <div className="text-slate-500 mt-1">{line.sections_per_tube} tramos c/u</div>}
                      {line.tube_length_mm && <div className="text-slate-500">{line.tube_length_mm} mm</div>}
                    </td>
                    {/* Fechas */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className={`text-xs font-medium ${isToday ? 'text-blue-700' : 'text-slate-600'}`}>
                        {formatDate(line.start_date)}
                      </div>
                      <div className="text-xs text-slate-400">→ {formatDate(line.end_date)}</div>
                      {isToday && <div className="text-[10px] text-blue-500 font-bold mt-0.5">● HOY</div>}
                    </td>
                    {/* Sierra */}
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1 mb-1">
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {line.saw_type_display}
                        </span>
                        {line.saw_teeth && (
                          <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-600">
                            {line.saw_teeth} dientes
                          </span>
                        )}
                      </div>
                      {line.rpm && (
                        <div className="text-xs font-mono text-amber-700 font-semibold">
                          {line.rpm} RPM
                        </div>
                      )}
                    </td>
                    {/* Avance HIGH/LOW */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex flex-col gap-0.5 text-xs">
                        {line.advance_high != null && (
                          <div className="font-mono">
                            <span className="text-slate-400">High</span>{' '}
                            <strong className="text-slate-800">{line.advance_high}</strong>
                          </div>
                        )}
                        {line.advance_low != null && (
                          <div className="font-mono">
                            <span className="text-slate-400">Low</span>{' '}
                            <strong className="text-slate-800">{line.advance_low}</strong>
                          </div>
                        )}
                        {line.advance_high == null && line.advance_low == null && <span className="text-slate-300">—</span>}
                      </div>
                    </td>
                    {/* Cliente */}
                    <td className="py-3 px-3">
                      <div className="text-sm text-slate-700 font-medium">{line.client}</div>
                      {line.packaging && <div className="text-xs text-slate-400 mt-0.5">{line.packaging}</div>}
                    </td>
                    {/* Lote */}
                    <td className="py-3 px-3 text-center">
                      {line.batch_id ? (
                        <div className="flex flex-col items-center gap-1.5">
                          <Link to={`/lote/${line.batch_id}`}
                            className="text-xs font-semibold text-blue-600 hover:underline">
                            Ver lote
                          </Link>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${bs.cls}`}>
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${bs.dot}`}/>
                            {bs.label}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    {/* Botón Ver */}
                    <td className="py-3 px-3 text-center">
                      <button onClick={() => setSelected(line)}
                        className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 font-medium transition">
                        🔍 Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {lines.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <p>El programa no tiene líneas cargadas aún.</p>
          </div>
        )}
      </div>

      {program.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Notas del programa:</span> {program.notes}
        </div>
      )}

      <LineDetailModal line={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
