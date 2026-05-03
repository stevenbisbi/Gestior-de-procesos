import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Batches } from '../lib/api';
import { BatchCard, Loading } from '../components/Common';

const STATUSES = [
  { v: '',           label: 'Todos' },
  { v: 'in_basket',  label: 'En canasta' },
  { v: 'in_process', label: 'En proceso' },
  { v: 'finished',   label: 'Terminados' },
];

export default function BatchList() {
  const [batches, setBatches] = useState([]);
  const [q, setQ]             = useState('');
  const [status, setStatus]   = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    Batches.list({ q, status, exclude_dispatched: '1' })
      .then(setBatches).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [status]);

  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); fetchData(); }} className="flex gap-2 mb-3 flex-wrap">
        <input type="text" placeholder="Buscar lote o referencia..."
          value={q} onChange={e => setQ(e.target.value)}
          className="form-input flex-1 min-w-[200px]" />
        <button type="submit" className="btn btn-primary">Filtrar</button>
        <Link to="/nuevo-lote" className="btn btn-success">+ Nuevo lote</Link>
      </form>

      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUSES.map(s => (
          <button key={s.v} onClick={() => setStatus(s.v)}
            className={`btn btn-sm ${status === s.v ? 'btn-primary' : 'btn-outline'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {loading ? <Loading /> :
        batches.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <div className="text-4xl mb-2">🔍</div>
            <p>No se encontraron lotes con ese filtro.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {batches.map(b => <BatchCard key={b.id} batch={b} to={`/lote/${b.id}`} />)}
          </div>
        )
      }
    </div>
  );
}
