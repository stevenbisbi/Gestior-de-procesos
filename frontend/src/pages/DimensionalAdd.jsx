import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Records, DimLogs } from '../lib/api';
import { BackLink, Alert, Loading } from '../components/Common';

const DEFAULTS = {
  corte:   ['Longitud (mm)', '', ''],
  chaflan: ['Longitud (mm)', 'Ángulo', ''],
  moleteo: ['Longitud (mm)', 'Prof. mol.', 'Dist. mol.'],
  curvado: ['Longitud (mm)', 'Radio curv.', ''],
};

export default function DimensionalAdd() {
  const { rid } = useParams();
  const nav = useNavigate();
  const [record, setRecord] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [form, setForm] = useState({
    piece_number: 20,
    measure_label_1: 'Medida 1', measure_1: '',
    measure_label_2: '', measure_2: '',
    measure_label_3: '', measure_3: '',
    result: '', notes: '',
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([Records.get(rid), DimLogs.byRecord(rid)])
      .then(([r, logs]) => {
        setRecord(r);
        setRecentLogs(logs.slice(-5).reverse());
        const last = logs[logs.length - 1];
        const nextPiece = last ? last.piece_number + 20 : 20;
        const [l1, l2, l3] = DEFAULTS[r.process_type] || ['Medida 1', '', ''];
        setForm(f => ({
          ...f, piece_number: nextPiece,
          measure_label_1: l1, measure_label_2: l2, measure_label_3: l3,
        }));
      });
  }, [rid]);

  if (!record) return <Loading />;

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await DimLogs.create({ ...form, process_record: record.id });
      nav(`/dimensional/${rid}`);
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-xl">
      <BackLink to={`/dimensional/${rid}`}>← Volver al registro</BackLink>
      {error && <Alert kind="error">{error}</Alert>}

      {recentLogs.length > 0 && (
        <div className="card mb-3">
          <div className="card-header"><span className="card-title text-xs">Últimas mediciones</span></div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-1.5 text-left font-semibold">Pieza</th>
                  <th className="px-3 py-1.5 text-left font-semibold">M1</th>
                  <th className="px-3 py-1.5 text-left font-semibold">M2</th>
                  <th className="px-3 py-1.5 text-left font-semibold">M3</th>
                  <th className="px-3 py-1.5 text-left font-semibold">R</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map(l => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-mono">~{l.piece_number}</td>
                    <td className="px-3 py-1.5 font-mono">{l.measure_1}</td>
                    <td className="px-3 py-1.5 font-mono">{l.measure_2 || '—'}</td>
                    <td className="px-3 py-1.5 font-mono">{l.measure_3 || '—'}</td>
                    <td className="px-3 py-1.5">{l.result === 'conforme' ?
                      <span className="text-emerald-600">✓</span> :
                      <span className="text-red-600">✗</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <form onSubmit={submit}>
        <div className="card">
          <div className="bg-navy text-white px-4 py-2 text-xs font-bold uppercase tracking-wider">
            📏 Registro — Pieza ~{form.piece_number}
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="form-label">Número de pieza *</label>
              <input type="number" required min="1" value={form.piece_number}
                onChange={e => setField('piece_number', parseInt(e.target.value))}
                className="form-input" />
              <div className="text-[11px] text-slate-400 mt-1">Cada ~20 piezas producidas</div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-[11px] font-bold uppercase text-slate-600 tracking-wider mb-3">
                Mediciones tomadas
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map(n => (
                  <div key={n} className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="form-label text-[11px]">{n === 1 ? 'Etiqueta' : 'Etiqueta (opcional)'}</label>
                      <input value={form[`measure_label_${n}`]}
                        onChange={e => setField(`measure_label_${n}`, e.target.value)}
                        className="form-input" />
                    </div>
                    <div>
                      <label className="form-label text-[11px]">{n === 1 ? 'Valor *' : 'Valor (opcional)'}</label>
                      <input required={n === 1} value={form[`measure_${n}`]}
                        onChange={e => setField(`measure_${n}`, e.target.value)}
                        placeholder={n === 1 ? 'Ej: 838.1 mm' : ''}
                        className="form-input" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Resultado *</label>
              <div className="grid grid-cols-2 gap-2">
                <ResultOpt value="conforme" label="✓ Conforme" current={form.result}
                  onClick={() => setField('result', 'conforme')} okClass="border-emerald-500 bg-emerald-50 text-emerald-800" />
                <ResultOpt value="no_conforme" label="✗ No Conforme" current={form.result}
                  onClick={() => setField('result', 'no_conforme')} okClass="border-red-500 bg-red-50 text-red-800" />
              </div>
            </div>

            <div>
              <label className="form-label">Observaciones</label>
              <textarea value={form.notes} onChange={e => setField('notes', e.target.value)}
                rows="2" className="form-textarea" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving || !form.result} className="btn btn-primary btn-full mt-4 py-4 text-base">
          {saving ? 'Guardando...' : 'Guardar medición'}
        </button>
      </form>
    </div>
  );
}

function ResultOpt({ value, label, current, onClick, okClass }) {
  const selected = current === value;
  return (
    <button type="button" onClick={onClick}
      className={`px-4 py-3 border-2 rounded-md font-semibold transition text-sm ${
        selected ? okClass : 'border-slate-200 hover:border-slate-300'
      }`}>
      {label}
    </button>
  );
}
