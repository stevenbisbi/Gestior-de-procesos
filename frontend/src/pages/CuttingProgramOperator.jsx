import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CuttingPrograms } from '../lib/api';
import { Loading } from '../components/Common';

const BATCH_STATUS = {
  in_basket:  { cls: 'bg-blue-100  text-blue-700  border-blue-200',  label: 'En canasta',  dot: 'bg-blue-400'  },
  in_process: { cls: 'bg-amber-100 text-amber-700 border-amber-200', label: 'En proceso',  dot: 'bg-amber-400' },
  paused:     { cls: 'bg-blue-100  text-blue-700  border-blue-200',  label: 'Pausado',     dot: 'bg-blue-400'  },
  finished:   { cls: 'bg-green-100 text-green-700 border-green-300', label: 'Terminado',   dot: 'bg-green-500' },
  dispatched: { cls: 'bg-gray-100  text-gray-400  border-gray-200',  label: 'Despachado',  dot: 'bg-gray-300'  },
};

// Calcula el día del mes actual para resaltar líneas vigentes
const today = new Date().getDate();

export default function CuttingProgramOperator() {
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noActive, setNoActive] = useState(false);

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

  const lines = program?.lines || [];

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="bg-navy text-white rounded-2xl px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/60 font-medium uppercase tracking-wide">Programa activo · Bewo</p>
          <h1 className="text-xl font-bold mt-0.5">{program.month_display} <span className="text-white/50 text-sm font-normal">v{program.version}</span></h1>
          <p className="text-sm text-white/60 mt-0.5">
            {lines.length} líneas · {lines.reduce((s,l) => s + (l.total_quantity || 0), 0).toLocaleString()} piezas a cortar
          </p>
        </div>
        <span className="text-4xl">✂️</span>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 inline-block"/> Hoy en rango</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-slate-200 inline-block"/> Otro rango</span>
      </div>

      {/* Tabla del programa */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide border-b border-slate-100">
              <tr>
                <th className="py-3 px-3 text-left whitespace-nowrap">Días</th>
                <th className="py-3 px-3 text-left">Producto / Tubo</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Cantidades</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Tubo largo</th>
                <th className="py-3 px-3 text-left whitespace-nowrap">Sierra</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Avance</th>
                <th className="py-3 px-3 text-left whitespace-nowrap">Cliente / Embalaje</th>
                <th className="py-3 px-3 text-center">Lote</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(line => {
                const isToday = today >= line.start_day && today <= line.end_day;
                const bs = BATCH_STATUS[line.batch_status] || {};
                return (
                  <tr key={line.id}
                    className={`border-t border-slate-100 transition-colors ${isToday ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
                    {/* Días */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`text-sm font-medium ${isToday ? 'text-blue-700' : 'text-slate-600'}`}>
                        {line.start_day} – {line.end_day}
                      </span>
                      {isToday && <div className="text-xs text-blue-500 font-semibold mt-0.5">● Hoy</div>}
                    </td>
                    {/* Producto */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800">{line.product_type_data?.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5 max-w-[260px] truncate">{line.tube_description}</div>
                      {line.item_code && <div className="text-xs text-slate-400 font-mono">Item: {line.item_code}</div>}
                    </td>
                    {/* Cantidades */}
                    <td className="py-3 px-3 text-center">
                      <div className="text-sm font-bold text-slate-800">{line.pedido_quantity?.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400">pedido</div>
                      <div className="text-xs text-slate-600 mt-1">→ {line.total_quantity?.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400">a cortar</div>
                      {line.demo_pieces > 0 && <div className="text-[10px] text-amber-600 mt-0.5">+{line.demo_pieces} demo</div>}
                      {line.pieces_per_hour && <div className="text-[10px] text-slate-400 mt-1">{line.pieces_per_hour} pz/h</div>}
                    </td>
                    {/* Tubo largo */}
                    <td className="py-3 px-3 text-center text-xs text-slate-600">
                      {line.tube_count ? <div className="font-bold text-sm text-slate-700">{line.tube_count}</div> : <span className="text-slate-300">—</span>}
                      {line.tube_count != null && <div className="text-[10px] text-slate-400">tramos</div>}
                      {line.tube_length_mm && <div className="text-slate-500 mt-1">{line.tube_length_mm} mm</div>}
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
                            className="text-xs font-mono font-semibold text-blue-600 hover:underline">
                            {line.batch_code}
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
    </div>
  );
}
