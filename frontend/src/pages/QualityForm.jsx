import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Records, Quality } from '../lib/api';
import { BackLink, Alert, Loading, ProcIcon } from '../components/Common';
import { useAuth } from '../lib/auth';

const SHIFT_OPTS = ['T1','T2','T3','T5'];
const YN_OPTS = [['si','Sí'], ['no','No'], ['otras','Otras']];
const CONF_OPTS = [['si','Sí'], ['no','No']];
const LAMINA_OPTS = [['cr','CR'], ['gv','GV'], ['hr','HR'], ['cr_est','CR EST'], ['hr_est','HR EST'], ['otras','Otras']];
const VER_OPTS = [['verificado','Verificado'], ['no_aplica','No Aplica']];
const CUT_OPTS = [['conforme','Conforme'], ['no_conforme','No Conforme']];
const TRIPLE_OPTS = [['conforme','Conforme'], ['no_conforme','No Conforme'], ['no_aplica','No Aplica']];

// "64D/1.6mm" ↔ { teeth: '64D', thickness: '1.6mm' }
function parseSaw(s) {
  if (!s || s === 'NA') return { teeth: '', thickness: '' };
  const [t, th] = s.split('/');
  return { teeth: t || '', thickness: th || '' };
}
function buildSaw({ teeth, thickness }) {
  if (!teeth && !thickness) return '';
  return `${teeth}/${thickness}`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

const NC_VALUES = ['no', 'no_conforme'];

export default function QualityForm({ edit = false }) {
  const { rid } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [record, setRecord] = useState(null);
  const [qcId, setQcId]     = useState(null);
  const [form, setForm]     = useState({
    date: todayStr(), shift: '', client: '', item_tramo: '', moto: '',
    dimensions_ok: '', sheet_type: '', appearance_ok: '',
    saw_type_ref: 'NA', rpm_ref: 'NA',
    jaw_pressure: '', cut_appearance: '',
    knurling_distance: 'NA', double_knurling_free: '',
    sample_1: '', sample_2: '', sample_3: '',
    observations: '',
  });
  const [error, setError]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Records.get(rid).then(r => {
      setRecord(r);
      // La puesta a punto es POR TURNO: buscamos la del turno activo
      if ((edit || r.has_quality_check) && r.active_shift_id) {
        Quality.byShift(r.active_shift_id).then(list => {
          if (list.length > 0) {
            const qc = list[0];
            setQcId(qc.id);
            setForm(prev => ({ ...prev, ...qc }));
          }
        }).finally(() => setLoading(false));
      } else {
        // Set default NA fields based on process type
        const updates = {};
        if (r.process_type !== 'corte') {
          updates.saw_type_ref = 'NA'; updates.rpm_ref = 'NA';
        }
        if (!['moleteo', 'curvado'].includes(r.process_type)) {
          updates.knurling_distance = 'NA';
          updates.double_knurling_free = 'no_aplica';
        }
        setForm(prev => ({ ...prev, ...updates }));
        setLoading(false);
      }
    });
  }, [rid, edit]);

  const setField = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const hasNC = NC_VALUES.includes(form.dimensions_ok)
              || NC_VALUES.includes(form.appearance_ok)
              || NC_VALUES.includes(form.cut_appearance)
              || NC_VALUES.includes(form.double_knurling_free);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      if (qcId) {
        await Quality.update(qcId, { ...form });
      } else {
        if (!record.active_shift_id) {
          setError('Necesitas un turno activo para registrar la puesta a punto.');
          setSaving(false); return;
        }
        await Quality.create({ ...form, shift_entry: record.active_shift_id });
      }
      nav(`/lote/${record.batch}`);
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  if (loading || !record) return <Loading />;

  const isCorte = record.process_type === 'corte';
  const isMolCurv = ['moleteo', 'curvado'].includes(record.process_type);

  return (
    <div className="max-w-2xl">
      <BackLink to={`/lote/${record.batch}`} />
      {error && <Alert kind="error">{error}</Alert>}

      {/* Context card */}
      <div className="bg-navy-mid text-white rounded-xl p-3 flex items-center gap-3 mb-4">
        <ProcIcon type={record.process_type} />
        <div className="flex-1">
          <div className="text-[11px] text-white/50 uppercase tracking-wider">Producto · Proceso</div>
          <div className="font-semibold">{record.product_name} — {record.process_label}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-white/50">Operario</div>
          <div className="text-sm font-semibold">{user.full_name}</div>
        </div>
      </div>

      {hasNC && (
        <div className="bg-red-50 border-2 border-red-300 text-red-800 rounded-lg px-4 py-2.5 mb-3 font-medium text-sm">
          ⚠️ Hay campos con <strong>No Conforme</strong> — revisa antes de guardar.
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {/* SECTION 1: Datos generales */}
        <Section icon="📋" title="1. Datos Generales">
  <div className="grid grid-cols-2 gap-3">
    <Field label="Fecha *">
      <input type="date" required value={form.date}
        onChange={e => setField('date', e.target.value)} className="form-input" />
    </Field>
    <Field label="Turno *">
      <RadioGroup name="shift" value={form.shift}
        onChange={v => setField('shift', v)}
        options={SHIFT_OPTS.map(s => [s, s])} inline />
    </Field>

    {/* Máquina — automática del proceso, solo lectura */}
    <Field label="Máquina">
      <input value={record.machine_data?.name || '— sin asignar —'}
        readOnly className="form-input bg-slate-100 text-slate-600" />
    </Field>

    {/* Responsable — el operario logueado */}
    <Field label="Responsable del proceso">
      <input value={user.full_name} readOnly
        className="form-input bg-slate-100 text-slate-600" />
    </Field>

    <Field label="Cliente *">
      <input required value={form.client}
        onChange={e => setField('client', e.target.value)} className="form-input" />
    </Field>
    <Field label="Ítem / Tramo *">
      <input required value={form.item_tramo}
        onChange={e => setField('item_tramo', e.target.value)} className="form-input" />
    </Field>
    <Field label="Moto *" className="col-span-2">
      <input required value={form.moto}
        onChange={e => setField('moto', e.target.value)} className="form-input" />
    </Field>
  </div>
</Section>

        {/* SECTION 2: Parámetros iniciales */}
        <Section icon="⚙️" title="2. Parámetros Iniciales">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Dimensiones del tubo conformes *">
              <RadioGroup name="dimensions_ok" value={form.dimensions_ok} onChange={v => setField('dimensions_ok', v)} options={YN_OPTS} />
            </Field>
            <Field label="Tipo de lámina conforme *">
              <RadioGroup name="sheet_type" value={form.sheet_type} onChange={v => setField('sheet_type', v)} options={LAMINA_OPTS} />
            </Field>
            <Field label="Apariencia general conforme *">
              <RadioGroup name="appearance_ok" value={form.appearance_ok} onChange={v => setField('appearance_ok', v)} options={CONF_OPTS} />
            </Field>
            <div className="space-y-3">
  {(() => {
    const sawIsNA = form.saw_type_ref === 'NA';
    const saw = parseSaw(form.saw_type_ref);

    const updateSawPart = (part, val) => {
      const next = buildSaw({ ...saw, [part]: val });
      setField('saw_type_ref', next);
    };

    const toggleSawNA = () => {
      if (sawIsNA) {
        // Desmarcar → habilita ambos campos
        setField('saw_type_ref', '');
        setField('rpm_ref', '');
      } else {
        // Marcar → bloquea sierra + RPM
        setField('saw_type_ref', 'NA');
        setField('rpm_ref', 'NA');
      }
    };

    return (
      <>
        <Field label="Tipo de sierra CI-TU-0034 *">
          <div className="flex gap-2">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">N° dientes</span>
                <PlainInput
                  value={saw.teeth}
                  onChange={v => updateSawPart('teeth', v)}
                  placeholder="Ej: 220"
                  disabled={sawIsNA}
                  displayWhenDisabled="N/A"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">Espesor</span>
                <PlainInput
                  value={saw.thickness}
                  onChange={v => updateSawPart('thickness', v)}
                  placeholder="Ej: 2.5mm"
                  disabled={sawIsNA}
                  displayWhenDisabled="N/A"
                />
              </div>
            </div>
            <div className="flex items-end">
              <NAToggle isNA={sawIsNA} onToggle={toggleSawNA} />
            </div>
          </div>
          {!isCorte && !sawIsNA && (
            <p className="text-[11px] text-amber-600 mt-1">Tip: este proceso no es de corte → puedes marcar N/A</p>
          )}
        </Field>

        <Field label="RPM de la sierra *">
          <PlainInput
            value={form.rpm_ref === 'NA' ? '' : form.rpm_ref}
            onChange={v => setField('rpm_ref', v)}
            placeholder="Ej: 120"
            disabled={sawIsNA}
            displayWhenDisabled="N/A"
          />
          {sawIsNA && (
            <p className="text-[11px] text-slate-400 mt-1">Bloqueado porque "Tipo de sierra" está en N/A</p>
          )}
        </Field>
      </>
    );
  })()}
</div>
          </div>
        </Section>

        {/* SECTION 3: Verificaciones */}
        <Section icon="🔍" title="3. Verificaciones">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Presión mordazas no talla/deforma *">
              <RadioGroup name="jaw_pressure" value={form.jaw_pressure} onChange={v => setField('jaw_pressure', v)} options={VER_OPTS} />
            </Field>
            <Field label="Apariencia corte — rebaba ≤0.3mm *">
              <RadioGroup name="cut_appearance" value={form.cut_appearance} onChange={v => setField('cut_appearance', v)} options={CUT_OPTS} />
            </Field>
            <Field label="Distancia moleteado CI-TU-0053 *">
  <NAInput value={form.knurling_distance}
           onChange={v => setField('knurling_distance', v)}
           placeholder="Valor en mm"
           defaultLocked={!isMolCurv} />
</Field>
            <Field label="Libre defecto doble moleteado *">
              <RadioGroup name="double_knurling_free" value={form.double_knurling_free} onChange={v => setField('double_knurling_free', v)} options={TRIPLE_OPTS} />
            </Field>
          </div>
        </Section>

        {/* SECTION 4: 3 muestras */}
        <Section icon="📏" title="4. Verificación Dimensional — 3 Primeras Muestras">
          <p className="text-xs text-slate-600 mb-3">
            Cortadoras: longitudes. Moleteadora: profundidad CI-TU-0053. Curvado: conforme CI-TU-0043.
          </p>
          <div className="space-y-2 mb-3">
            {[1, 2, 3].map(n => (
              <div key={n} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                <div className="w-6 h-6 rounded-full bg-navy text-white text-xs font-bold flex items-center justify-center">{n}</div>
                <input required value={form[`sample_${n}`]} onChange={e => setField(`sample_${n}`, e.target.value)}
                  placeholder={`Ej: 838.${n} mm`}
                  className="flex-1 bg-transparent outline-none font-mono text-sm" />
              </div>
            ))}
          </div>
          <Field label="Observaciones">
            <textarea value={form.observations} onChange={e => setField('observations', e.target.value)}
              rows="3" className="form-textarea" placeholder="Observaciones adicionales..." />
          </Field>
        </Section>

        <button type="submit" disabled={saving} className="btn btn-success btn-full py-4 text-base">
          {saving ? 'Guardando...' : `✅ ${edit ? 'Actualizar' : 'Guardar'} Control de Calidad`}
        </button>
      </form>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div>
      <div className="bg-navy text-white px-4 py-2 rounded-t-md text-xs font-bold uppercase tracking-wider flex items-center gap-2">
        <span>{icon}</span> {title}
      </div>
      <div className="bg-white border border-t-0 border-slate-200 rounded-b-md p-5">
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

function RadioGroup({ name, value, onChange, options, inline = false }) {
  return (
    <div className={`flex ${inline ? 'flex-row gap-1.5 flex-wrap' : 'flex-col gap-1.5'}`}>
      {options.map(([v, label]) => {
        const selected = value === v;
        const isNc = NC_VALUES.includes(v) && selected;
        const isOk = (v === 'si' || v === 'conforme' || v === 'verificado') && selected;
        const cls = isNc ? 'border-red-400 bg-red-50' :
                    isOk ? 'border-emerald-400 bg-emerald-50' :
                    selected ? 'border-navy bg-blue-50' : 'border-slate-200';
        return (
          <label key={v} className={`flex items-center gap-2 px-3 py-2 border-2 rounded-md cursor-pointer text-sm font-medium transition ${cls} ${inline ? 'flex-1 min-w-[60px] justify-center' : ''}`}>
            <input type="radio" name={name} value={v} checked={selected}
              onChange={() => onChange(v)} className="accent-navy" />
            {label}
          </label>
        );
      })}
    </div>
  );
}
/** Input simple controlado externamente por una bandera disabled */
function PlainInput({ value, onChange, placeholder, disabled, displayWhenDisabled = 'N/A' }) {
  return (
    <input
      value={disabled ? displayWhenDisabled : value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className={`form-input ${disabled ? 'bg-slate-100 text-slate-400' : ''}`}
    />
  );
}

/** Input con N/A propio (para Distancia moleteado, etc.) */
function NAInput({ value, onChange, placeholder, defaultLocked = false }) {
  const isNA = value === 'NA';
  const toggle = () => onChange(isNA ? '' : 'NA');

  return (
    <div>
      <div className="flex gap-2">
        <PlainInput value={value} onChange={onChange} placeholder={placeholder} disabled={isNA} />
        <NAToggle isNA={isNA} onToggle={toggle} />
      </div>
      {defaultLocked && (
        <p className="text-[11px] text-slate-400 mt-1">Pre-marcado: no aplica a este proceso</p>
      )}
    </div>
  );
}

/** Checkbox N/A reusable */
function NAToggle({ isNA, onToggle }) {
  return (
    <label className={`flex items-center gap-1.5 px-3 border-2 rounded-md cursor-pointer text-sm font-medium select-none transition
        ${isNA ? 'border-slate-400 bg-slate-100' : 'border-slate-200 hover:border-slate-300'}`}>
      <input type="checkbox" checked={isNA} onChange={onToggle} className="accent-navy" />
      N/A
    </label>
  );
}