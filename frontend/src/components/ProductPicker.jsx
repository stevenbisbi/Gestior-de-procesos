import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Catalog } from '../lib/api';
import { Alert } from './Common';

/* ════════════════════════════════════════════════════════════════════════════
   ProductPicker — buscador con autocomplete + creación inline
   ──────────────────────────────────────────────────────────────────────────
   Props:
     value         → ID del ProductType seleccionado (o '')
     onChange(id, productData) → callback cuando se selecciona/crea
   ══════════════════════════════════════════════════════════════════════════ */

export default function ProductPicker({ value, onChange, allowCreate = true }) {
  const [products, setProducts] = useState([]);
  const [tubes, setTubes]       = useState([]);
  const [query, setQuery]       = useState('');
  const [open, setOpen]         = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading]   = useState(true);
  const wrapperRef = useRef(null);

  // Carga inicial
  useEffect(() => {
    Promise.all([Catalog.products(), Catalog.tubes()])
      .then(([p, t]) => { setProducts(p); setTubes(t); })
      .finally(() => setLoading(false));
  }, []);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const onClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const selected = products.find(p => p.id === Number(value));

  const filtered = products.filter(p => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const hay = `${p.name} ${p.item_code || ''} ${p.client || ''} ${p.tube_spec_data?.label || ''} ${p.cut_length}`.toLowerCase();
    return hay.includes(q);
  });

  const onPick = (p) => {
    onChange(p.id, p);
    setQuery('');
    setOpen(false);
  };

  const onCreated = (newProduct) => {
    setProducts(prev => [newProduct, ...prev]);
    onPick(newProduct);
    setShowCreate(false);
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={wrapperRef}>
      {/* Selección actual */}
      {selected ? (
        <div className="border-2 border-blue-300 rounded-lg px-3 py-2 bg-blue-50/40 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {selected.item_code ? (
              <div className="font-mono text-base font-bold text-blue-700 leading-tight">
                {selected.item_code}
              </div>
            ) : (
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Sin item</div>
            )}
            <div className="text-sm font-medium text-slate-800 truncate mt-0.5">{selected.name}</div>
            <div className="text-xs text-slate-500 truncate">
              {selected.tube_spec_data?.label} · corte {selected.cut_length} mm
              {selected.client && ` · ${selected.client}`}
            </div>
          </div>
          <button type="button"
            onClick={() => onChange('', null)}
            className="text-xs text-slate-400 hover:text-red-500 flex-shrink-0"
            title="Cambiar producto">
            ✕
          </button>
        </div>
      ) : (
        // Buscador
        <div>
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={loading ? 'Cargando productos…' : 'Buscar por item, nombre, tubo o cliente…'}
            disabled={loading}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />

          {/* Dropdown de resultados */}
          {open && !loading && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
              {filtered.length > 0 ? (
                filtered.slice(0, 50).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPick(p)}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition border-b border-slate-50 last:border-b-0 flex items-baseline gap-3"
                  >
                    {/* Item code GRANDE — primero (referencia principal de la empresa) */}
                    <div className="flex-shrink-0 w-20">
                      {p.item_code ? (
                        <span className="font-mono text-base font-bold text-blue-700">{p.item_code}</span>
                      ) : (
                        <span className="text-[10px] uppercase text-slate-300">sin item</span>
                      )}
                    </div>
                    {/* Nombre + detalles a la derecha, menor jerarquía */}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-700 truncate">{p.name}</div>
                      <div className="text-xs text-slate-400 truncate">
                        {p.tube_spec_data?.label} · {p.cut_length} mm
                        {p.client && <span className="text-blue-500"> · {p.client}</span>}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-sm text-slate-400 text-center">
                  Sin coincidencias para <strong>"{query}"</strong>
                </div>
              )}

              {/* Crear nuevo — solo si allowCreate */}
              {allowCreate ? (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setShowCreate(true); setOpen(false); }}
                  className="w-full text-left px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium border-t border-blue-200 sticky bottom-0"
                >
                  ➕ Crear producto nuevo
                  {query && <span className="text-xs font-normal"> con nombre "{query}"</span>}
                </button>
              ) : (
                <div className="px-3 py-2 text-[10px] text-slate-400 border-t border-slate-100 bg-slate-50 sticky bottom-0">
                  ¿No aparece? Créalo desde la pestaña <strong>Lotes</strong> → "+ Producto"
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de creación inline */}
      {showCreate && (
        <CreateProductModal
          tubes={tubes}
          onTubeCreated={(t) => setTubes(prev => [t, ...prev])}
          initialName={query}
          onCancel={() => setShowCreate(false)}
          onCreated={onCreated}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Helpers de UI (definidos a nivel de módulo para no perder el foco al teclear)
   ══════════════════════════════════════════════════════════════════════════ */
const inpCls = 'border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';
const selCls = inpCls + ' bg-white';

const Field = ({ label, children, hint }) => (
  <label className="flex flex-col gap-1">
    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
    {children}
    {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
  </label>
);

/* ════════════════════════════════════════════════════════════════════════════
   Modal — crea TubeSpec (opcional) + ProductType
   Export nombrado para reutilizarlo desde la pestaña "Lotes".
   ══════════════════════════════════════════════════════════════════════════ */
export function CreateProductModal({ tubes, onTubeCreated, initialName = '', onCancel, onCreated }) {
  // — TubeSpec —
  const [tubeMode, setTubeMode] = useState('existing'); // 'existing' | 'new'
  const [tubeId,   setTubeId]   = useState('');
  const [tube, setTube] = useState({
    shape: 'round', outer_diameter: '', thickness: '',
    material: 'hr', original_length: 6000,
  });

  // — ProductType —
  const [prod, setProd] = useState({
    name: initialName, item_code: '', cut_length: '', client: '',
    default_priority: 'media',
    requires_chaflan: false, requires_moleteo: false, requires_curvado: false,
    saw_type: 'none', rpm: '',
  });

  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      // 1) Resolver TubeSpec
      let tubeSpecId = tubeId;
      if (tubeMode === 'new') {
        // outer_diameter es CharField — se envía como string ('22.2', '1/2', etc.)
        const od = String(tube.outer_diameter).trim();
        const th = Number(tube.thickness);
        const ol = Number(tube.original_length) || 6000;

        // Buscar primero un TubeSpec idéntico para evitar choque con unique_together
        const existing = tubes.find(t =>
          String(t.outer_diameter).trim() === od &&
          Number(t.thickness) === th &&
          t.material === tube.material &&
          Number(t.original_length) === ol
        );
        if (existing) {
          tubeSpecId = existing.id;
        } else {
          const newTube = await Catalog.createTube({
            shape:           tube.shape,
            outer_diameter:  od,
            thickness:       th,
            material:        tube.material,
            original_length: ol,
          });
          onTubeCreated(newTube);
          tubeSpecId = newTube.id;
        }
      }
      if (!tubeSpecId) {
        setErr('Selecciona o crea un tubo.');
        setSaving(false);
        return;
      }

      // 2) Crear ProductType
      const newProduct = await Catalog.createProduct({
        ...prod,
        tube_spec:        Number(tubeSpecId),
        cut_length:       Number(prod.cut_length),
        rpm:              prod.rpm ? Number(prod.rpm) : null,
      });
      onCreated(newProduct);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        <form onSubmit={submit}>
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">➕ Crear producto nuevo</h2>
            <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
          </div>

          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}

            {/* ───── Sección 1: Tubo ───── */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">1. Especificación del tubo</p>

              {/* Switch existente vs nuevo */}
              <div className="inline-flex border border-slate-200 rounded-lg overflow-hidden mb-3">
                <button type="button" onClick={() => setTubeMode('existing')}
                  className={`px-3 py-1.5 text-xs font-medium ${tubeMode === 'existing' ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  Elegir del catálogo
                </button>
                <button type="button" onClick={() => setTubeMode('new')}
                  className={`px-3 py-1.5 text-xs font-medium border-l border-slate-200 ${tubeMode === 'new' ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  Crear nuevo
                </button>
              </div>

              {tubeMode === 'existing' ? (
                <select required={tubeMode === 'existing'} value={tubeId} onChange={e => setTubeId(e.target.value)}
                  className={`${selCls} w-full`}>
                  <option value="">— seleccionar tubo —</option>
                  {tubes.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Forma">
                    <select className={selCls} value={tube.shape} onChange={e => setTube(s => ({...s, shape: e.target.value}))}>
                      <option value="round">Redondo</option>
                      <option value="square">Cuadrado</option>
                    </select>
                  </Field>
                  <Field label="Diámetro / lado" hint="Admite '1/2', '5/8', '22.2', etc.">
                    <input type="text" required className={inpCls}
                      value={tube.outer_diameter}
                      onChange={e => setTube(s => ({...s, outer_diameter: e.target.value}))}
                      placeholder="22.2 ó 1/2"/>
                  </Field>
                  <Field label="Espesor (mm)">
                    <input type="number" step="0.01" required className={inpCls}
                      value={tube.thickness}
                      onChange={e => setTube(s => ({...s, thickness: e.target.value}))}/>
                  </Field>
                  <Field label="Material">
                    <select className={selCls} value={tube.material} onChange={e => setTube(s => ({...s, material: e.target.value}))}>
                      <option value="cr">CR</option>
                      <option value="hr">HR</option>
                      <option value="cr_est">CR EST</option>
                      <option value="hr_est">HR EST</option>
                    </select>
                  </Field>
                  <Field label="Longitud original (mm)" hint="Tubo largo de fábrica">
                    <input type="number" step="1" className={inpCls}
                      value={tube.original_length}
                      onChange={e => setTube(s => ({...s, original_length: e.target.value}))}/>
                  </Field>
                </div>
              )}
            </div>

            {/* ───── Sección 2: Producto ───── */}
            <div className="border-t border-slate-200 pt-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">2. Tipo de producto</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Nombre">
                  <input required className={inpCls}
                    value={prod.name}
                    onChange={e => setProd(s => ({...s, name: e.target.value}))}
                    placeholder="Manubrio 838"/>
                </Field>
                <Field label="Item / SKU" hint="Código interno (ej. 877135)">
                  <input className={inpCls}
                    value={prod.item_code}
                    onChange={e => setProd(s => ({...s, item_code: e.target.value}))}/>
                </Field>
                <Field label="Longitud de corte (mm)">
                  <input type="number" step="0.1" required className={inpCls}
                    value={prod.cut_length}
                    onChange={e => setProd(s => ({...s, cut_length: e.target.value}))}/>
                </Field>
                <Field label="Cliente">
                  <input className={inpCls}
                    value={prod.client}
                    onChange={e => setProd(s => ({...s, client: e.target.value}))}/>
                </Field>
                <Field label="Prioridad">
                  <select className={selCls} value={prod.default_priority}
                    onChange={e => setProd(s => ({...s, default_priority: e.target.value}))}>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </Field>
                <Field label="Tipo de sierra">
                  <select className={selCls} value={prod.saw_type}
                    onChange={e => setProd(s => ({...s, saw_type: e.target.value}))}>
                    <option value="none">Ninguno</option>
                    <option value="hss">HSS</option>
                    <option value="tct">TCT</option>
                  </select>
                </Field>
                <Field label="RPM">
                  <input type="number" className={inpCls}
                    value={prod.rpm}
                    onChange={e => setProd(s => ({...s, rpm: e.target.value}))}/>
                </Field>
              </div>

              {/* Procesos requeridos */}
              <div className="mt-3">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">Procesos requeridos</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    {k:'requires_chaflan', label:'🔩 Chaflanado'},
                    {k:'requires_moleteo', label:'⚙️ Moleteado'},
                    {k:'requires_curvado', label:'🔄 Curvado'},
                  ].map(({k, label}) => (
                    <label key={k}
                      className={`px-3 py-1.5 rounded-lg border-2 text-sm cursor-pointer transition select-none
                        ${prod[k] ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      <input type="checkbox" className="hidden"
                        checked={prod[k]}
                        onChange={e => setProd(s => ({...s, [k]: e.target.checked}))}/>
                      {prod[k] ? '✓ ' : ''}{label}
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">El proceso "Corte" siempre va incluido</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 rounded-b-2xl">
            <button type="button" onClick={onCancel} className="btn btn-outline px-4">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary px-5">
              {saving ? 'Creando…' : '✓ Crear y seleccionar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
