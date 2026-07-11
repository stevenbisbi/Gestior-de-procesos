import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CuttingPrograms, CuttingLines } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BackLink, Alert, Loading } from '../components/Common';
import { formatDate } from '../lib/utils';
import ProductPicker from '../components/ProductPicker';

const STATUS_PROGRAM = {
  draft:  { cls: 'bg-slate-100 text-slate-600 border-slate-300',  label: 'Borrador' },
  active: { cls: 'bg-green-100 text-green-700 border-green-300',  label: 'Activo'   },
  closed: { cls: 'bg-gray-100  text-gray-500  border-gray-300',   label: 'Cerrado'  },
};

const BATCH_STATUS = {
  in_basket:  { cls: 'bg-blue-100  text-blue-700',  label: 'En canasta'  },
  in_process: { cls: 'bg-amber-100 text-amber-700', label: 'En proceso'  },
  finished:   { cls: 'bg-green-100 text-green-700', label: 'Terminado'   },
  dispatched: { cls: 'bg-gray-100  text-gray-500',  label: 'Despachado'  },
};

// ── Componentes auxiliares (definidos fuera del form para no perder el foco) ─
const inpCls = 'border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';
const selCls = inpCls + ' bg-white';

const Field = ({ label, children, hint }) => (
  <label className="flex flex-col gap-1">
    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
    {children}
    {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
  </label>
);

const Section = ({ title, children }) => (
  <div className="border-t border-slate-200 pt-3 mt-3 first:border-t-0 first:pt-0 first:mt-0">
    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</p>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{children}</div>
  </div>
);

// ── Nomenclatura estándar del tramo cortado ─────────────────────────────────
// TUB {MATERIAL} {FORMA} {Ø}x{cal}x{corte}mm — ej: TUB CR REDONDO 3/4x0.7x750mm
const MAT_NAMES   = { cr: 'CR', hr: 'HR', cr_est: 'CR EST', hr_est: 'HR EST', gv: 'GALVANIZADO' };
const SHAPE_NAMES = { round: 'REDONDO', square: 'CUADRADO' };
function tramoDescription(p) {
  const ts = p?.tube_spec_data;
  if (!ts) return '';
  const mat   = MAT_NAMES[ts.material] || (ts.material_display || '').toUpperCase();
  const shape = SHAPE_NAMES[ts.shape] || '';
  return ['TUB', mat, shape].filter(Boolean).join(' ') +
         ` ${ts.outer_diameter}x${ts.thickness}x${p.cut_length}mm`;
}

// ── Alta rápida: solo item/producto + cantidad; el resto se autocompleta ────
function QuickAddLine({ program, onSaved }) {
  const [productId, setProductId] = useState('');
  const [product,   setProduct]   = useState(null);
  const [qty,       setQty]       = useState('');
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!productId || !qty) return;
    setSaving(true); setErr('');
    const p      = product || {};
    const largo  = Number(p.tube_spec_data?.original_length) || null;
    const corte  = Number(p.cut_length) || 0;
    const tramos = (largo && corte > 0) ? Math.floor(largo / corte) : null;
    try {
      await CuttingLines.create({
        program:           program.id,
        product_type:      Number(productId),
        total_quantity:    Number(qty),
        item_code:         p.item_code || '',
        client:            p.client || '',
        tube_description:  tramoDescription(p) || p.name || '',
        saw_type:          (p.saw_type && p.saw_type !== 'none') ? p.saw_type : 'hss',
        rpm:               p.rpm || null,
        // Campos que la referencia ya aprendió en programas anteriores
        pieces_per_hour:   p.pieces_per_hour || null,
        packaging:         p.packaging || '',
        saw_teeth:         p.saw_teeth || null,
        advance_high:      p.advance_high ?? null,
        advance_low:       p.advance_low ?? null,
        tube_length_mm:    largo,
        sections_per_tube: tramos,
        tube_count:        tramos ? Math.ceil(Number(qty) / tramos) : null,
      });
      setProductId(''); setProduct(null); setQty('');
      onSaved();
    } catch (ex) { setErr(ex.message); }
    finally      { setSaving(false); }
  };

  return (
    <form onSubmit={submit}
      className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
      {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[260px]">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
            Item o producto
          </span>
          <ProductPicker value={productId} allowCreate={false}
            onChange={(id, p) => { setProductId(id); setProduct(p); }} />
        </div>
        <div className="w-36">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
            Cantidad a cortar
          </span>
          <input className={inpCls + ' w-full'} type="number" min="1" required
            value={qty} onChange={e => setQty(e.target.value)} placeholder="3200" />
        </div>
        <button type="submit" disabled={saving || !productId || !qty}
          className="btn btn-primary px-6 py-2 disabled:opacity-40">
          {saving ? 'Agregando…' : '➕ Agregar'}
        </button>
      </div>
      <p className="text-[10px] text-slate-400 mt-2">
        Fechas, sierra, tubos largos y demás se completan solos desde el producto — ajústalos con ✏️ si hace falta.
      </p>
    </form>
  );
}

// ── Formulario inline para agregar / editar una línea ───────────────────────
function LineForm({ program, onSave, onCancel, initial }) {
  const empty = {
    program: program.id,
    product_type: '', start_date: '', end_date: '',
    pieces_per_hour: '', item_code: '', tube_description: '',
    total_quantity: '',
    tube_count: '', sections_per_tube: '', tube_length_mm: '',
    saw_type: 'hss', saw_teeth: '', rpm: '',
    advance_high: '', advance_low: '',
    client: '', packaging: '', notes: '',
  };
  const [form, setForm] = useState(initial ? { ...empty, ...initial } : empty);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Recibe (id, producto) desde el ProductPicker — autorrellena del producto
  const handleProductChange = (pid, p) => {
    if (!p) { set('product_type', pid); return; }
    const largo = Number(p.tube_spec_data?.original_length) || null;
    const corte = Number(p.cut_length) || 0;
    // Tramos por tubo = cuántas piezas salen de cada tubo largo
    const tramos = (largo && corte > 0) ? Math.floor(largo / corte) : null;
    setForm(f => ({
      ...f,
      product_type: pid,
      item_code:        f.item_code         || p.item_code || '',
      client:           f.client            || p.client,
      rpm:              f.rpm               || p.rpm,
      // Campos que la referencia ya aprendió en programas anteriores
      pieces_per_hour:  f.pieces_per_hour   || p.pieces_per_hour || '',
      packaging:        f.packaging         || p.packaging || '',
      saw_teeth:        f.saw_teeth         || p.saw_teeth || '',
      advance_high:     f.advance_high      || p.advance_high || '',
      advance_low:      f.advance_low       || p.advance_low || '',
      saw_type:         f.saw_type !== 'hss' ? f.saw_type : (p.saw_type !== 'none' ? p.saw_type : f.saw_type),
      tube_description: f.tube_description  || tramoDescription(p),
      // ── Tubo largo (materia prima) ──
      tube_length_mm:    f.tube_length_mm    || (largo ?? ''),
      sections_per_tube: f.sections_per_tube || (tramos ?? ''),
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    const num = (v) => v === '' || v === null ? null : Number(v);
    try {
      const payload = {
        ...form,
        code:              form.item_code || 'none',
        start_date:        form.start_date || null,
        end_date:          form.end_date   || null,
        total_quantity:    Number(form.total_quantity),
        tube_count:        num(form.tube_count),
        sections_per_tube: num(form.sections_per_tube),
        tube_length_mm:    num(form.tube_length_mm),
        pieces_per_hour:   num(form.pieces_per_hour),
        saw_teeth:         num(form.saw_teeth),
        rpm:               num(form.rpm),
        advance_high:      num(form.advance_high),
        advance_low:       num(form.advance_low),
      };
      if (initial?.id) await CuttingLines.update(initial.id, payload);
      else             await CuttingLines.create(payload);
      onSave();
    } catch (e) { setErr(e.message); }
    finally     { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-3">
      <p className="text-sm font-semibold text-slate-700 mb-4">
        {initial?.id ? '✏️ Editar línea' : '➕ Nueva línea'}
      </p>
      {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}

      <Section title="Producto y cliente">
        <div className="col-span-2 sm:col-span-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Producto</span>
          <ProductPicker value={form.product_type} onChange={handleProductChange} allowCreate={false}/>
          <span className="text-[10px] text-slate-400">
            Busca por item. ¿Es un producto nuevo? Créalo desde la pestaña <strong>Lotes</strong> → "+ Producto".
          </span>
        </div>
        <Field label="Item (código)"><input className={inpCls} value={form.item_code} onChange={e=>set('item_code',e.target.value)}/></Field>
        <Field label="Cliente"><input className={inpCls} required value={form.client} onChange={e=>set('client',e.target.value)}/></Field>
        <Field label="Embalaje"><input className={inpCls} value={form.packaging} onChange={e=>set('packaging',e.target.value)}/></Field>
        <label className="col-span-2 sm:col-span-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Descripción tramo cortado</span>
          <input className={inpCls} required value={form.tube_description}
            onChange={e=>set('tube_description',e.target.value)}
            placeholder="TUB CR REDONDO 1 1/2 x 0.80 x 140 mm"/>
          <span className="text-[10px] text-slate-400">La medida final (mm) va al final del nombre — ej. "...x 140 mm"</span>
        </label>
      </Section>

      <Section title="Programación y cantidades">
        <Field label="Fecha inicio">
          <input className={inpCls} type="date" required value={form.start_date} onChange={e=>set('start_date',e.target.value)}/>
        </Field>
        <Field label="Fecha final">
          <input className={inpCls} type="date" required value={form.end_date}   onChange={e=>set('end_date',  e.target.value)}/>
        </Field>
        <Field label="Cantidad pedida" hint="Piezas que se van a cortar">
          <input className={inpCls} type="number" min="1" required value={form.total_quantity}
            onChange={e => {
              const total = e.target.value;
              const tramos = Number(form.sections_per_tube) || 0;
              setForm(f => ({
                ...f,
                total_quantity: total,
                // tubos largos = ceil(total / tramos por tubo)
                tube_count: tramos > 0 && total ? String(Math.ceil(Number(total) / tramos)) : f.tube_count,
              }));
            }}/>
        </Field>
        <Field label="Piezas/hora"><input className={inpCls} type="number" value={form.pieces_per_hour} onChange={e=>set('pieces_per_hour',e.target.value)}/></Field>
      </Section>

      <Section title="Tubo largo (materia prima)">
        <Field label="Tubos largos" hint="Cantidad de tubos grandes a usar">
          <input className={inpCls} type="number" min="0" value={form.tube_count} onChange={e=>set('tube_count',e.target.value)}/>
        </Field>
        <Field label="Tramos por tubo" hint="Cortes pequeños que salen de cada tubo grande">
          <input className={inpCls} type="number" min="0" value={form.sections_per_tube} onChange={e=>set('sections_per_tube',e.target.value)}/>
        </Field>
        <Field label="Tubo largo (mm)" hint="Longitud de cada tubo grande">
          <input className={inpCls} type="number" step="0.1" value={form.tube_length_mm} onChange={e=>set('tube_length_mm',e.target.value)}/>
        </Field>
      </Section>

      <Section title="Sierra y velocidades">
        <Field label="Tipo de sierra">
          <select className={selCls} value={form.saw_type} onChange={e=>set('saw_type',e.target.value)}>
            <option value="hss">HSS</option>
            <option value="tct">TCT</option>
          </select>
        </Field>
        <Field label="Número de dientes"><input className={inpCls} type="number" min="0" value={form.saw_teeth} onChange={e=>set('saw_teeth',e.target.value)}/></Field>
        <Field label="RPM"><input className={inpCls} type="number" value={form.rpm} onChange={e=>set('rpm',e.target.value)}/></Field>
        <div />
        <Field label="Avance HIGH" hint="Velocidad disponible en High">
          <input className={inpCls} type="number" step="0.01" value={form.advance_high} onChange={e=>set('advance_high',e.target.value)}/>
        </Field>
        <Field label="Avance LOW" hint="Velocidad disponible en Low">
          <input className={inpCls} type="number" step="0.01" value={form.advance_low} onChange={e=>set('advance_low',e.target.value)}/>
        </Field>
      </Section>

      <div className="flex gap-2 mt-5 pt-4 border-t border-slate-200">
        <button type="submit" disabled={saving} className="btn btn-primary px-5">
          {saving ? 'Guardando…' : initial?.id ? 'Guardar cambios' : 'Agregar línea'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-outline px-5">Cancelar</button>
      </div>
    </form>
  );
}

// ── Celda de fechas: editable en línea (guarda al cambiar) ───────────────────
function InlineDateCell({ line, editable, onSaved }) {
  const [saving, setSaving] = useState(false);
  const save = async (field, value) => {
    setSaving(true);
    try { await CuttingLines.update(line.id, { [field]: value || null }); onSaved(); }
    catch (e) { alert(e.message); }
    finally   { setSaving(false); }
  };
  if (!editable) {
    return (
      <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
        <div>{line.start_date ? formatDate(line.start_date) : '—'}</div>
        <div className="text-slate-400">→ {line.end_date ? formatDate(line.end_date) : '—'}</div>
      </td>
    );
  }
  const dateCls = 'border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-600 bg-white ' +
                  'focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50 w-[120px]';
  return (
    <td className="py-3 px-3 whitespace-nowrap">
      <div className="flex flex-col gap-1">
        <input type="date" className={dateCls} disabled={saving}
          value={line.start_date || ''} onChange={e => save('start_date', e.target.value)}
          title="Fecha inicio" />
        <input type="date" className={dateCls} disabled={saving}
          value={line.end_date || ''} onChange={e => save('end_date', e.target.value)}
          title="Fecha final" />
      </div>
    </td>
  );
}

// ── Fila de línea del programa ───────────────────────────────────────────────
function ProgramLineRow({ line, isSupervisor, programClosed, onEdit, onDelete, onSaved }) {
  const bs = BATCH_STATUS[line.batch_status] || {};
  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
      {/* Item */}
      <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
        <div>{line.item_code}</div>
      </td>
      {/* Producto / tubo */}
      <td className="py-3 px-3">
        <div className="font-medium text-sm text-slate-800">{line.tube_description}</div>
        <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[260px]">{line.product_type_data?.name}</div>
        {line.client && <div className="text-xs text-blue-500 mt-0.5">{line.client}</div>}
      </td>
      {/* Cantidades */}
      <td className="py-3 px-3 text-center">
        <div className="text-sm font-semibold text-slate-800">{line.total_quantity?.toLocaleString()}</div>
        <div className="text-[10px] text-slate-400">pedidas</div>
        {line.pieces_per_hour && <div className="text-[10px] text-slate-400 mt-1">{line.pieces_per_hour} pz/h</div>}
      </td>
      {/* Fechas — editables en línea por el supervisor */}
      <InlineDateCell line={line} editable={isSupervisor && !programClosed} onSaved={onSaved} />
      {/* Tubo largo */}
      <td className="py-3 px-3 text-center text-xs text-slate-600">
        {line.tube_count ? <div><strong>{line.tube_count}</strong> tubos</div> : <span className="text-slate-300">—</span>}
        {line.sections_per_tube && <div className="text-slate-400">{line.sections_per_tube} tramos c/u</div>}
        {line.tube_length_mm && <div className="text-slate-400">{line.tube_length_mm} mm</div>}
      </td>
      {/* Sierra */}
      <td className="py-3 px-3">
        <div className="flex flex-wrap gap-1">
          <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            {line.saw_type_display}
          </span>
          {line.saw_teeth && (
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-600">
              {line.saw_teeth} dientes
            </span>
          )}
          {line.rpm && (
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-amber-50 text-amber-700 border border-amber-200">
              {line.rpm} RPM
            </span>
          )}
        </div>
      </td>
      {/* Avance High / Low */}
      <td className="py-3 px-3 text-center">
        <div className="flex flex-col gap-0.5 text-xs font-mono">
          {line.advance_high != null && (
            <span><span className="text-slate-400">High</span> <strong className="text-slate-700">{line.advance_high}</strong></span>
          )}
          {line.advance_low != null && (
            <span><span className="text-slate-400">Low</span> <strong className="text-slate-700">{line.advance_low}</strong></span>
          )}
          {line.advance_high == null && line.advance_low == null && <span className="text-slate-300">—</span>}
        </div>
      </td>
      {/* Lote */}
      <td className="py-3 px-3 text-center">
        {line.batch_id ? (
          <div className="flex flex-col items-center gap-1">
            <Link to={`/lote/${line.batch_id}`}
              className="text-xs text-blue-600 hover:underline">
              Ver lote
            </Link>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bs.cls}`}>
              {bs.label}
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      {/* Acciones supervisor */}
      {isSupervisor && (
        <td className="py-3 px-3 text-center">
          <div className="flex gap-1 justify-center">
            <button onClick={() => onEdit(line)}
              className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition">
              ✏️
            </button>
            {(!line.batch_status || ['waiting_material', 'in_basket'].includes(line.batch_status)) && (
              <button onClick={() => onDelete(line)}
                className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-500 transition">
                🗑
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function CuttingProgramDetail() {
  const { id }         = useParams();
  const navigate       = useNavigate();
  const { user }       = useAuth();
  const isSupervisor   = user?.is_supervisor;

  const [program,   setProgram]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState('');
  const [editLine,  setEditLine]  = useState(null);
  const [acting,    setActing]    = useState(false);

  const load = async () => {
    try {
      setProgram(await CuttingPrograms.get(id));
    } catch (e) { setErr(e.message); }
    finally     { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleActivate = async () => {
    if (!confirm('¿Activar este programa? El programa activo actual quedará cerrado.')) return;
    setActing(true);
    try { await CuttingPrograms.activate(id); await load(); }
    catch(e) { setErr(e.message); }
    finally  { setActing(false); }
  };

  const handleClose = async () => {
    if (!confirm('¿Cerrar este programa?')) return;
    setActing(true);
    try { await CuttingPrograms.close(id); await load(); }
    catch(e) { setErr(e.message); }
    finally  { setActing(false); }
  };

  const handleDelete = async (line) => {
    const label = line.item_code || line.tube_description || `#${line.id}`;
    if (!confirm(`¿Eliminar la línea ${label}? También se elimina su lote (si no ha iniciado).`)) return;
    try { await CuttingLines.delete(line.id); await load(); }
    catch(e) { setErr(e.message); }
  };

  const handleSaved = () => {
    setEditLine(null);
    load();
  };

  if (loading) return <Loading />;
  if (!program) return <div className="text-center text-slate-500 mt-20">{err || 'Programa no encontrado'}</div>;

  const ps = STATUS_PROGRAM[program.status] || {};

  // Líneas agrupadas por tubo largo (forma + diámetro + espesor): las
  // referencias del mismo tubo quedan juntas para minimizar cambios de
  // setup en la cortadora. Dentro del grupo se respeta el orden de alta.
  const tubeKey = (l) => {
    const ts = l.product_type_data?.tube_spec_data;
    return ts ? `${ts.shape}|${ts.outer_diameter}|${ts.thickness}` : '~';
  };
  const sortedLines = [...(program.lines || [])].sort(
    (a, b) => tubeKey(a).localeCompare(tubeKey(b), undefined, { numeric: true })
  );

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <BackLink to="/programa" label="Programas de corte" />
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-bold text-slate-800">
              ✂️ {program.month_display}
              <span className="text-base font-normal text-slate-400 ml-2">v{program.version}</span>
            </h1>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${ps.cls}`}>
              {ps.label}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Cortadora Bewo · {program.lines?.length || 0} líneas ·{' '}
            {program.lines?.reduce((s,l) => s + l.total_quantity, 0).toLocaleString()} piezas totales
          </p>
        </div>

        {/* Acciones supervisor */}
        {isSupervisor && (
          <div className="flex gap-2 flex-wrap">
            {program.status === 'draft' && (
              <button onClick={handleActivate} disabled={acting}
                className="btn btn-primary px-4">
                ✅ Activar programa
              </button>
            )}
            {program.status === 'active' && (
              <button onClick={handleClose} disabled={acting}
                className="btn btn-outline px-4 text-slate-600">
                🔒 Cerrar programa
              </button>
            )}
          </div>
        )}
      </div>

      {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}

      {/* Alta rápida de línea: item + cantidad */}
      {isSupervisor && program.status !== 'closed' && (
        <QuickAddLine program={program} onSaved={handleSaved} />
      )}

      {/* Tabla de líneas */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {program.lines?.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">📋</div>
            <p>Sin líneas en este programa.</p>
            {isSupervisor && <p className="text-sm mt-1">Usa "Nueva línea" para agregar renglones.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="py-3 px-3 text-left whitespace-nowrap">Item</th>
                  <th className="py-3 px-3 text-left">Producto / Tubo</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">Cantidades</th>
                  <th className="py-3 px-3 text-left whitespace-nowrap">Fechas</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">Tubo largo</th>
                  <th className="py-3 px-3 text-left whitespace-nowrap">Sierra</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">Avance</th>
                  <th className="py-3 px-3 text-center">Lote</th>
                  {isSupervisor && <th className="py-3 px-3 text-center w-20">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {sortedLines.map(line => (
                  editLine?.id === line.id ? (
                    <tr key={line.id}>
                      <td colSpan={isSupervisor ? 9 : 8} className="px-3 py-2">
                        <LineForm
                          program={program}
                          initial={editLine}
                          onSave={handleSaved}
                          onCancel={() => setEditLine(null)}
                        />
                      </td>
                    </tr>
                  ) : (
                    <ProgramLineRow
                      key={line.id}
                      line={line}
                      isSupervisor={isSupervisor}
                      programClosed={program.status === 'closed'}
                      onEdit={l => setEditLine(l)}
                      onDelete={handleDelete}
                      onSaved={handleSaved}
                    />
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notas del programa */}
      {program.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Notas:</span> {program.notes}
        </div>
      )}
    </div>
  );
}
