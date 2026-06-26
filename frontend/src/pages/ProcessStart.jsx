import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Records, Catalog } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BackLink, Alert, Loading, ProcIcon } from '../components/Common';

export default function ProcessStart() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [record, setRecord]     = useState(null);
  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState('');
  const [shift, setShift]         = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Records.get(id).then(r => {
      setRecord(r);
      // Load machines for this process type
      Catalog.machines().then(all => {
        const filtered = all.filter(m => m.process_type === r.process_type
          && m.operators.includes(user.id));
        setMachines(filtered);
        if (filtered.length === 1) setMachineId(filtered[0].id);
      });
    });
  }, [id]);

  if (!record) return <Loading />;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await Records.start(id, {
        machine_id: machineId || null,
        shift: shift,
      });
      nav(`/lote/${record.batch}`);
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-xl">
      <BackLink to={`/lote/${record.batch}`}>← Volver al lote</BackLink>
      {error && <Alert kind="error">{error}</Alert>}

      <div className="card mb-4">
        <div className="card-body flex items-center gap-3">
          <ProcIcon type={record.process_type} size="lg" />
          <div className="flex-1">
            {record.product_name && <div className="text-xs text-slate-400">{record.product_name}</div>}
            <div className="text-base font-bold">{record.process_label}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-400">Disponible</div>
            <div className="font-mono text-xl font-semibold text-blue-600">{record.qty_assigned}</div>
            <div className="text-[11px] text-slate-400">uds</div>
          </div>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-header"><span className="card-title">Datos para iniciar</span></div>
          <div className="card-body space-y-3">
            {machines.length > 0 && (
              <div>
                <label className="form-label">Máquina</label>
                <select value={machineId} onChange={e => setMachineId(e.target.value)} className="form-select">
                  <option value="">— Seleccionar —</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="form-label">Turno</label>
              <select value={shift} onChange={e => setShift(e.target.value)} className="form-select">
                <option value="">Seleccionar...</option>
                <option value="A">Turno 1 (06:00–15:15)</option>
                <option value="A">Turno 2 (06:00–14:00)</option>
                <option value="B">Turno 3 (14:00–22:00)</option>
                <option value="C">Turno 5 (22:00–06:00)</option>
              </select>
            </div>

            <div className="bg-slate-50 rounded-lg p-3.5">
              <div className="text-[11px] font-semibold uppercase text-slate-600 tracking-wider mb-2">Operario</div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center text-sm font-bold">
                  {user.full_name[0]?.toUpperCase()}
                </div>
                <span className="font-medium">{user.full_name}</span>
              </div>
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn btn-primary btn-full mt-4 py-4 text-base">
          {saving ? 'Iniciando...' : `▶ INICIAR ${record.process_label?.toUpperCase()}`}
        </button>
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mt-4 text-sm text-amber-800">
  💡 <strong>Recuerda:</strong> después de iniciar, tendrás que llenar el
  control de calidad de puesta a punto (3 primeras muestras, sierra, RPM, etc.)
</div>
      </form>
    </div>
  );
}
