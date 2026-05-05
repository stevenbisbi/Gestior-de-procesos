import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CuttingPrograms } from '../lib/api';
import { Alert, Loading } from '../components/Common';

const STATUS_STYLE = {
  draft:  { cls: 'bg-slate-100  text-slate-600 border-slate-300',  label: 'Borrador', dot: 'bg-slate-400'  },
  active: { cls: 'bg-green-100  text-green-700 border-green-300',  label: 'Activo',   dot: 'bg-green-500'  },
  closed: { cls: 'bg-gray-100   text-gray-400  border-gray-200',   label: 'Cerrado',  dot: 'bg-gray-300'   },
};

// ── Modal de creación de programa ────────────────────────────────────────────
function CreateProgramModal({ onCreated, onCancel }) {
  const now   = new Date();
  const yy    = now.getFullYear();
  const mm    = String(now.getMonth() + 1).padStart(2, '0');
  const [month,   setMonth]   = useState(`${yy}-${mm}`);
  const [version, setVersion] = useState(1);
  const [notes,   setNotes]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const [y, m] = month.split('-');
      const prog = await CuttingPrograms.create({
        month:   `${y}-${m}-01`,
        version: Number(version),
        notes,
      });
      onCreated(prog.id);
    } catch(e) { setErr(e.message); }
    finally    { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">✂️ Nuevo programa de corte</h2>
        {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mes</span>
            <input type="month" required value={month} onChange={e => setMonth(e.target.value)}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Versión</span>
            <input type="number" min="1" required value={version} onChange={e => setVersion(e.target.value)}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notas (opcional)</span>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"/>
          </label>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Creando…' : 'Crear programa'}
            </button>
            <button type="button" onClick={onCancel} className="btn btn-outline flex-1">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function CuttingProgramList() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState('');
  const [modal,    setModal]    = useState(false);

  const load = async () => {
    try   { setPrograms(await CuttingPrograms.list()); }
    catch (e) { setErr(e.message); }
    finally   { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">✂️ Programas de corte</h1>
          <p className="text-sm text-slate-400 mt-0.5">Cortadora Bewo 1 y Bewo 2</p>
        </div>
        <button onClick={() => setModal(true)} className="btn btn-primary px-4">
          ➕ Nuevo programa
        </button>
      </div>

      {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}

      {modal && (
        <CreateProgramModal
          onCreated={(id) => { setModal(false); navigate(`/programa/${id}`); }}
          onCancel={() => setModal(false)}
        />
      )}

      {programs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-20 text-slate-400">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-lg font-medium">No hay programas creados</p>
          <p className="text-sm mt-1">Crea el primer programa de corte mensual.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map(p => {
            const s = STATUS_STYLE[p.status] || {};
            return (
              <Link key={p.id} to={`/programa/${p.id}`}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-5 flex flex-col gap-3">
                {/* Encabezado */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-bold text-slate-800">{p.month_display}</p>
                    <p className="text-xs text-slate-400">Versión {p.version}</p>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border flex items-center gap-1.5 ${s.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>
                    {s.label}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-slate-600 border-t border-slate-50 pt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg">📋</span>
                    <span><strong>{p.line_count}</strong> líneas</span>
                  </div>
                </div>

                {/* Creado por */}
                <div className="text-xs text-slate-400">
                  Creado por <strong>{p.created_by_data?.full_name}</strong>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
