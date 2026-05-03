import os, sys, django
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.contrib.auth.models import User, Group
from django.utils import timezone
from production.models import TubeSpec, ProductType, Machine, ProductionBatch, ProcessRecord
from quality.models import QualityCheck, DimensionalLog

NOW = timezone.now()
ago = lambda days: NOW - timedelta(days=days)

print("=== Cargando datos iniciales ===\n")

# ── Grupos ──────────────────────────────────────────────────────────────────
sup_group, _ = Group.objects.get_or_create(name='Supervisor')
op_group,  _ = Group.objects.get_or_create(name='Operario')

# ── Usuarios ────────────────────────────────────────────────────────────────
if not User.objects.filter(username='supervisor').exists():
    s = User.objects.create_superuser('supervisor', '', 'admin1234')
    s.first_name, s.last_name = 'Carlos', 'Supervisor'
    s.save()
    s.groups.add(sup_group)
    print("✓ supervisor / admin1234")

sup = User.objects.get(username='supervisor')

users_data = [
    ('juan',   'Juan',   'Pérez',   op_group),
    ('maria',  'María',  'López',   op_group),
    ('pedro',  'Pedro',  'Ramírez', op_group),
    ('camila', 'Camila', 'Torres',  op_group),
]
U = {}
for uname, fn, ln, grp in users_data:
    if not User.objects.filter(username=uname).exists():
        x = User.objects.create_user(uname, password='op1234')
        x.first_name, x.last_name = fn, ln
        x.save()
        x.groups.add(grp)
        print(f"✓ {uname} / op1234")
    U[uname] = User.objects.get(username=uname)

# ── Especificaciones de tubo ─────────────────────────────────────────────────
tubes_data = [
    ('round',  22.2, 1.6, 'hr',  6000),
    ('round',  19.1, 1.2, 'hr',  6000),
    ('round',  25.4, 1.6, 'hr',  6000),
    ('round',  31.8, 1.6, 'hr',  6000),
    ('square', 25.4, 1.6, 'hr',  6000),
    ('round',  28.6, 1.6, 'cr',  6000),
]
T = {}
for sh, od, th, mat, lg in tubes_data:
    t, _ = TubeSpec.objects.get_or_create(
        outer_diameter=od, thickness=th, material=mat, original_length=lg,
        defaults={'shape': sh},
    )
    T[f'{od}x{th}'] = t

# ── Tipos de producto ────────────────────────────────────────────────────────
# (name, tube_key, cut_length, chaflan, moleteo, curvado, client, priority, saw, rpm)
prods_data = [
    ('Manubrio 838',    '22.2x1.6',  838, True,  True,  True,  'Cliente A', 'alta',  'hss', 1800),
    ('Manubrio 874',    '22.2x1.6',  874, True,  True,  True,  'Cliente A', 'media', 'hss', 1800),
    ('Defensa 900',     '22.2x1.6',  900, False, False, True,  'Cliente B', 'media', 'tct', 2200),
    ('Defensa 1000',    '31.8x1.6', 1000, False, False, True,  'Cliente B', 'baja',  'tct', 1600),
    ('Tubo corte 650',  '19.1x1.2',  650, False, False, False, 'Cliente C', 'baja',  'hss', 2400),
    ('Tubo corte 910',  '25.4x1.6',  910, False, False, False, 'Cliente D', 'media', 'tct', 2000),
    ('Manubrio 920',    '22.2x1.6',  920, True,  True,  True,  'Cliente A', 'alta',  'hss', 1800),
    ('Cuadrado 750',    '25.4x1.6',  750, True,  False, False, 'Cliente E', 'media', 'tct', 1400),
    ('Horquilla 1100',  '28.6x1.6', 1100, True,  False, True,  'Cliente F', 'alta',  'hss', 1600),
]
P = {}
for nm, tk, cl, ch, mo, cu, cli, pr, sw, rpm in prods_data:
    obj, _ = ProductType.objects.get_or_create(name=nm, defaults={
        'tube_spec': T[tk], 'cut_length': cl,
        'requires_chaflan': ch, 'requires_moleteo': mo, 'requires_curvado': cu,
        'client': cli, 'default_priority': pr, 'saw_type': sw, 'rpm': rpm,
    })
    P[nm] = obj

# ── Máquinas ─────────────────────────────────────────────────────────────────
machines_data = [
    ('Bewo 1',        'corte',   ['juan', 'pedro']),
    ('Bewo 2',        'corte',   ['juan', 'pedro']),
    ('Chaflaneadora', 'chaflan', ['maria']),
    ('Moleteadora',   'moleteo', ['maria']),
    ('Socco 1',       'curvado', ['juan', 'camila']),
    ('Socco 2',       'curvado', ['pedro', 'camila']),
]
M = {}
for n, pt, ops in machines_data:
    m, _ = Machine.objects.get_or_create(name=n, defaults={'process_type': pt})
    for u in ops:
        if u in U:
            m.operators.add(U[u])
    M[n] = m

print("\n✓ Catálogos listos — creando lotes y procesos...\n")

# ══════════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════════

def make_batch(product, qty, priority, scheduled_offset, created_by, notes=''):
    b, created = ProductionBatch.objects.get_or_create(
        product_type=product,
        total_quantity=qty,
        priority=priority,
        defaults={
            'scheduled_date': (NOW + timedelta(days=scheduled_offset)).date(),
            'status': 'in_basket',
            'notes': notes,
            'created_by': created_by,
        },
    )
    if created:
        b.create_process_records()
    return b


def set_record(batch, proc_type, status, machine, operator, shift,
               qty_done=None, start_days_ago=None, finish_days_ago=None):
    try:
        r = batch.records.get(process_type=proc_type)
    except ProcessRecord.DoesNotExist:
        return None
    r.machine  = machine
    r.operator = operator
    r.shift    = shift
    r.status   = status
    r.qty_done = qty_done if qty_done is not None else r.qty_assigned
    if start_days_ago is not None:
        r.started_at = ago(start_days_ago)
    if finish_days_ago is not None:
        r.finished_at = ago(finish_days_ago)
    r.save()
    return r


def dispatch_batch(batch, days_ago):
    batch.status = 'dispatched'
    batch.dispatched_at = ago(days_ago)
    batch.save(update_fields=['status', 'dispatched_at', 'updated_at'])


def make_qc(record, date_ago, shift, client, item_tramo, moto,
            dim_ok, sheet, appear_ok, saw_ref, rpm_ref,
            jaw, cut_app, knurl_dist, dbl_knurl,
            s1, s2, s3, obs, created_by):
    """Crea un QualityCheck (puesta a punto) para un ProcessRecord."""
    if record is None:
        return None
    qc, _ = QualityCheck.objects.get_or_create(
        process_record=record,
        defaults={
            'date':                 ago(date_ago).date(),
            'shift':                shift,
            'client':               client,
            'item_tramo':           item_tramo,
            'moto':                 moto,
            'dimensions_ok':        dim_ok,
            'sheet_type':           sheet,
            'appearance_ok':        appear_ok,
            'saw_type_ref':         saw_ref,
            'rpm_ref':              rpm_ref,
            'jaw_pressure':         jaw,
            'cut_appearance':       cut_app,
            'knurling_distance':    knurl_dist,
            'double_knurling_free': dbl_knurl,
            'sample_1':             s1,
            'sample_2':             s2,
            'sample_3':             s3,
            'observations':         obs,
            'created_by':           created_by,
        },
    )
    return qc


def make_logs(record, operator, measurements):
    """
    Crea DimensionalLog por pieza.
    measurements: lista de dicts con claves:
      piece, l1, v1, l2='', v2='', l3='', v3='', result, notes=''
    """
    if record is None:
        return
    for m in measurements:
        DimensionalLog.objects.get_or_create(
            process_record=record,
            piece_number=m['piece'],
            defaults={
                'measure_label_1': m['l1'],
                'measure_1':       m['v1'],
                'measure_label_2': m.get('l2', ''),
                'measure_2':       m.get('v2', ''),
                'measure_label_3': m.get('l3', ''),
                'measure_3':       m.get('v3', ''),
                'result':          m['result'],
                'notes':           m.get('notes', ''),
                'operator':        operator,
            },
        )


# ══════════════════════════════════════════════════════════════════
#  LOTES
# ══════════════════════════════════════════════════════════════════

# ── 1. Manubrio 838 — TERMINADO ──────────────────────────────────────────────
b1 = make_batch(P['Manubrio 838'], 500, 'alta', -2, sup)
r1c = set_record(b1, 'corte',   'finished', M['Bewo 1'],        U['juan'],   'A', 500, 13, 12)
r1ch= set_record(b1, 'chaflan', 'finished', M['Chaflaneadora'], U['maria'],  'A', 498, 12, 11)
r1m = set_record(b1, 'moleteo', 'finished', M['Moleteadora'],   U['maria'],  'A', 498, 11, 10)
r1cu= set_record(b1, 'curvado', 'finished', M['Socco 1'],       U['camila'], 'B', 498, 10, 10)
b1.status = 'finished'; b1.save(update_fields=['status', 'updated_at'])

make_qc(r1c, 13, 'T1', 'Cliente A', 'Manubrio 838', 'Honda CG 150',
        'si', 'hr', 'si', 'HSS Ø22.2', '1800 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '838.1', '837.9', '838.2', '', U['juan'])
make_logs(r1c, U['juan'], [
    {'piece':1,'l1':'Longitud (mm)','v1':'838.1','result':'conforme'},
    {'piece':2,'l1':'Longitud (mm)','v1':'837.9','result':'conforme'},
    {'piece':3,'l1':'Longitud (mm)','v1':'838.0','result':'conforme'},
    {'piece':4,'l1':'Longitud (mm)','v1':'838.3','result':'conforme'},
    {'piece':5,'l1':'Longitud (mm)','v1':'838.2','result':'conforme'},
    {'piece':6,'l1':'Longitud (mm)','v1':'837.8','result':'conforme'},
    {'piece':7,'l1':'Longitud (mm)','v1':'838.4','result':'conforme'},
    {'piece':8,'l1':'Longitud (mm)','v1':'838.1','result':'conforme'},
])
make_qc(r1ch, 12, 'T1', 'Cliente A', 'Manubrio 838', 'Honda CG 150',
        'si', 'hr', 'si', 'NA', 'NA',
        'verificado', 'conforme', '15 mm', 'conforme',
        '15.0', '15.1', '14.9', 'Distancia de moleteo conforme', U['maria'])
make_logs(r1ch, U['maria'], [
    {'piece':1,'l1':'Distancia moleteo (mm)','v1':'15.0','result':'conforme'},
    {'piece':2,'l1':'Distancia moleteo (mm)','v1':'15.1','result':'conforme'},
    {'piece':3,'l1':'Distancia moleteo (mm)','v1':'14.9','result':'conforme'},
    {'piece':4,'l1':'Distancia moleteo (mm)','v1':'15.0','result':'conforme'},
    {'piece':5,'l1':'Distancia moleteo (mm)','v1':'15.2','result':'conforme'},
])
print(f"✓ {b1.batch_code}  Manubrio 838 — Terminado + QC")

# ── 2. Manubrio 874 — DESPACHADO ─────────────────────────────────────────────
b2 = make_batch(P['Manubrio 874'], 300, 'media', -5, sup)
r2c = set_record(b2, 'corte',   'finished', M['Bewo 2'],        U['pedro'],  'B', 300, 20, 18)
r2ch= set_record(b2, 'chaflan', 'finished', M['Chaflaneadora'], U['maria'],  'A', 298, 18, 17)
r2m = set_record(b2, 'moleteo', 'finished', M['Moleteadora'],   U['maria'],  'B', 298, 17, 16)
r2cu= set_record(b2, 'curvado', 'finished', M['Socco 2'],       U['camila'], 'A', 296, 16, 15)
b2.status = 'finished'; b2.save(update_fields=['status', 'updated_at'])
dispatch_batch(b2, 14)

make_qc(r2c, 20, 'T2', 'Cliente A', 'Manubrio 874', 'Honda XR 190',
        'si', 'hr', 'si', 'HSS Ø22.2', '1800 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '874.0', '873.8', '874.2', '', U['pedro'])
make_logs(r2c, U['pedro'], [
    {'piece':1,'l1':'Longitud (mm)','v1':'874.0','result':'conforme'},
    {'piece':2,'l1':'Longitud (mm)','v1':'873.8','result':'conforme'},
    {'piece':3,'l1':'Longitud (mm)','v1':'874.2','result':'conforme'},
    {'piece':4,'l1':'Longitud (mm)','v1':'874.1','result':'conforme'},
    {'piece':5,'l1':'Longitud (mm)','v1':'873.9','result':'conforme'},
    {'piece':6,'l1':'Longitud (mm)','v1':'874.3','result':'conforme'},
])
make_qc(r2ch, 18, 'T2', 'Cliente A', 'Manubrio 874', 'Honda XR 190',
        'si', 'hr', 'si', 'NA', 'NA',
        'verificado', 'conforme', '15 mm', 'conforme',
        '15.1', '15.0', '15.2', '', U['maria'])
make_logs(r2ch, U['maria'], [
    {'piece':1,'l1':'Distancia moleteo (mm)','v1':'15.1','result':'conforme'},
    {'piece':2,'l1':'Distancia moleteo (mm)','v1':'15.0','result':'conforme'},
    {'piece':3,'l1':'Distancia moleteo (mm)','v1':'15.2','result':'conforme'},
    {'piece':4,'l1':'Distancia moleteo (mm)','v1':'14.8','result':'conforme'},
])
print(f"✓ {b2.batch_code}  Manubrio 874 — Despachado + QC")

# ── 3. Defensa 900 — DESPACHADO ──────────────────────────────────────────────
b3 = make_batch(P['Defensa 900'], 200, 'media', -8, sup)
r3c = set_record(b3, 'corte',   'finished', M['Bewo 1'],  U['juan'],   'A', 200, 22, 21)
r3cu= set_record(b3, 'curvado', 'finished', M['Socco 1'], U['camila'], 'A', 200, 21, 20)
b3.status = 'finished'; b3.save(update_fields=['status', 'updated_at'])
dispatch_batch(b3, 19)

make_qc(r3c, 22, 'T1', 'Cliente B', 'Defensa 900', 'Honda CB 250',
        'si', 'hr', 'si', 'TCT Ø22.2', '2200 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '900.1', '899.9', '900.0', '', U['juan'])
make_logs(r3c, U['juan'], [
    {'piece':1,'l1':'Longitud (mm)','v1':'900.1','result':'conforme'},
    {'piece':2,'l1':'Longitud (mm)','v1':'899.9','result':'conforme'},
    {'piece':3,'l1':'Longitud (mm)','v1':'900.0','result':'conforme'},
    {'piece':4,'l1':'Longitud (mm)','v1':'900.2','result':'conforme'},
    {'piece':5,'l1':'Longitud (mm)','v1':'900.1','result':'conforme'},
])
print(f"✓ {b3.batch_code}  Defensa 900 — Despachado + QC")

# ── 4. Tubo corte 650 — TERMINADO ────────────────────────────────────────────
b4 = make_batch(P['Tubo corte 650'], 1000, 'baja', -1, U['juan'])
r4c = set_record(b4, 'corte', 'finished', M['Bewo 2'], U['pedro'], 'C', 1000, 8, 7)
b4.status = 'finished'; b4.save(update_fields=['status', 'updated_at'])

make_qc(r4c, 8, 'T3', 'Cliente C', 'Tubo 650', 'Varias',
        'si', 'hr', 'si', 'HSS Ø19.1', '2400 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '650.0', '649.8', '650.1', 'Lote de tubos simples', U['pedro'])
make_logs(r4c, U['pedro'], [
    {'piece':1,'l1':'Longitud (mm)','v1':'650.0','result':'conforme'},
    {'piece':2,'l1':'Longitud (mm)','v1':'649.8','result':'conforme'},
    {'piece':3,'l1':'Longitud (mm)','v1':'650.1','result':'conforme'},
    {'piece':4,'l1':'Longitud (mm)','v1':'650.2','result':'conforme'},
    {'piece':5,'l1':'Longitud (mm)','v1':'649.9','result':'conforme'},
    {'piece':6,'l1':'Longitud (mm)','v1':'650.0','result':'conforme'},
    {'piece':7,'l1':'Longitud (mm)','v1':'650.3','result':'conforme'},
    {'piece':8,'l1':'Longitud (mm)','v1':'649.7','result':'conforme'},
])
print(f"✓ {b4.batch_code}  Tubo corte 650 — Terminado + QC")

# ── 5. Manubrio 920 — TERMINADO ──────────────────────────────────────────────
b5 = make_batch(P['Manubrio 920'], 400, 'alta', -1, sup, 'Pedido urgente Cliente A')
r5c = set_record(b5, 'corte',   'finished', M['Bewo 1'],        U['juan'],   'A', 400, 9, 8)
r5ch= set_record(b5, 'chaflan', 'finished', M['Chaflaneadora'], U['maria'],  'B', 398, 8, 7)
r5m = set_record(b5, 'moleteo', 'finished', M['Moleteadora'],   U['maria'],  'A', 398, 7, 6)
r5cu= set_record(b5, 'curvado', 'finished', M['Socco 2'],       U['pedro'],  'B', 395, 6, 5)
b5.status = 'finished'; b5.save(update_fields=['status', 'updated_at'])

make_qc(r5c, 9, 'T1', 'Cliente A', 'Manubrio 920', 'Honda XR 250',
        'si', 'hr', 'si', 'HSS Ø22.2', '1800 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '920.0', '919.9', '920.2', 'Pedido urgente revisado', U['juan'])
make_logs(r5c, U['juan'], [
    {'piece':1,'l1':'Longitud (mm)','v1':'920.0','result':'conforme'},
    {'piece':2,'l1':'Longitud (mm)','v1':'919.9','result':'conforme'},
    {'piece':3,'l1':'Longitud (mm)','v1':'920.2','result':'conforme'},
    {'piece':4,'l1':'Longitud (mm)','v1':'920.1','result':'conforme'},
    {'piece':5,'l1':'Longitud (mm)','v1':'919.8',
     'result':'no_conforme','notes':'Ligeramente fuera de tolerancia, aprobado por supervisor'},
    {'piece':6,'l1':'Longitud (mm)','v1':'920.0','result':'conforme'},
])
make_qc(r5ch, 8, 'T2', 'Cliente A', 'Manubrio 920', 'Honda XR 250',
        'si', 'hr', 'si', 'NA', 'NA',
        'verificado', 'conforme', '16 mm', 'conforme',
        '16.0', '16.1', '15.9', '', U['maria'])
make_logs(r5ch, U['maria'], [
    {'piece':1,'l1':'Distancia moleteo (mm)','v1':'16.0','result':'conforme'},
    {'piece':2,'l1':'Distancia moleteo (mm)','v1':'16.1','result':'conforme'},
    {'piece':3,'l1':'Distancia moleteo (mm)','v1':'15.9','result':'conforme'},
])
print(f"✓ {b5.batch_code}  Manubrio 920 — Terminado + QC")

# ── 6. Tubo corte 910 — TERMINADO ────────────────────────────────────────────
b6 = make_batch(P['Tubo corte 910'], 800, 'media', 2, U['pedro'])
r6c = set_record(b6, 'corte', 'finished', M['Bewo 1'], U['juan'], 'A', 800, 6, 5)
b6.status = 'finished'; b6.save(update_fields=['status', 'updated_at'])

make_qc(r6c, 6, 'T1', 'Cliente D', 'Tubo 910', 'Varias',
        'si', 'hr', 'si', 'TCT Ø25.4', '2000 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '910.1', '910.0', '909.9', '', U['juan'])
make_logs(r6c, U['juan'], [
    {'piece':1,'l1':'Longitud (mm)','v1':'910.1','result':'conforme'},
    {'piece':2,'l1':'Longitud (mm)','v1':'910.0','result':'conforme'},
    {'piece':3,'l1':'Longitud (mm)','v1':'909.9','result':'conforme'},
    {'piece':4,'l1':'Longitud (mm)','v1':'910.2','result':'conforme'},
    {'piece':5,'l1':'Longitud (mm)','v1':'910.1','result':'conforme'},
    {'piece':6,'l1':'Longitud (mm)','v1':'910.0','result':'conforme'},
])
print(f"✓ {b6.batch_code}  Tubo corte 910 — Terminado + QC")

# ── 7. Manubrio 838 — EN PROCESO (corte ✓, chaflan en proceso) ───────────────
b7 = make_batch(P['Manubrio 838'], 600, 'alta', 1, sup)
r7c = set_record(b7, 'corte',   'finished',   M['Bewo 2'],        U['pedro'], 'A', 600, 4, 3)
r7ch= set_record(b7, 'chaflan', 'in_process', M['Chaflaneadora'], U['maria'], 'A', None, 3, None)
b7.status = 'in_process'; b7.save(update_fields=['status', 'updated_at'])

make_qc(r7c, 4, 'T1', 'Cliente A', 'Manubrio 838', 'Honda CG 150',
        'si', 'hr', 'si', 'HSS Ø22.2', '1800 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '838.0', '838.1', '837.9', '', U['pedro'])
make_logs(r7c, U['pedro'], [
    {'piece':1,'l1':'Longitud (mm)','v1':'838.0','result':'conforme'},
    {'piece':2,'l1':'Longitud (mm)','v1':'838.1','result':'conforme'},
    {'piece':3,'l1':'Longitud (mm)','v1':'837.9','result':'conforme'},
    {'piece':4,'l1':'Longitud (mm)','v1':'838.2','result':'conforme'},
    {'piece':5,'l1':'Longitud (mm)','v1':'838.0','result':'conforme'},
])
# Puesta a punto del chaflanado (ya iniciado, sin mediciones aún)
make_qc(r7ch, 3, 'T1', 'Cliente A', 'Manubrio 838', 'Honda CG 150',
        'si', 'hr', 'si', 'NA', 'NA',
        'verificado', 'conforme', '15 mm', 'conforme',
        '15.0', '15.1', '15.0', 'En proceso, primeras 3 muestras OK', U['maria'])
print(f"✓ {b7.batch_code}  Manubrio 838 — En proceso (chaflanado) + QC")

# ── 8. Defensa 1000 — EN PROCESO (corte ✓, curvado pendiente) ───────────────
b8 = make_batch(P['Defensa 1000'], 150, 'media', 3, U['camila'])
r8c = set_record(b8, 'corte',   'finished', M['Bewo 1'],  U['juan'],   'B', 150, 3, 2)
r8cu= set_record(b8, 'curvado', 'pending',  M['Socco 1'], U['camila'], '',  None, None, None)
b8.status = 'in_process'; b8.save(update_fields=['status', 'updated_at'])

make_qc(r8c, 3, 'T2', 'Cliente B', 'Defensa 1000', 'Honda Tornado',
        'si', 'hr', 'si', 'TCT Ø31.8', '1600 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '1000.2', '1000.0', '999.8', '', U['juan'])
make_logs(r8c, U['juan'], [
    {'piece':1,'l1':'Longitud (mm)','v1':'1000.2','result':'conforme'},
    {'piece':2,'l1':'Longitud (mm)','v1':'1000.0','result':'conforme'},
    {'piece':3,'l1':'Longitud (mm)','v1':'999.8','result':'conforme'},
    {'piece':4,'l1':'Longitud (mm)','v1':'1000.1','result':'conforme'},
    {'piece':5,'l1':'Longitud (mm)','v1':'1000.3','result':'conforme'},
])
print(f"✓ {b8.batch_code}  Defensa 1000 — En proceso (curvado pendiente) + QC")

# ── 9. Manubrio 874 — EN PROCESO (corte ✓, chaflan ✓, moleteo en proceso) ───
b9 = make_batch(P['Manubrio 874'], 450, 'alta', 0, sup, 'Segunda corrida Cliente A')
r9c = set_record(b9, 'corte',   'finished',   M['Bewo 2'],        U['pedro'], 'A', 450, 5, 4)
r9ch= set_record(b9, 'chaflan', 'finished',   M['Chaflaneadora'], U['maria'], 'B', 448, 4, 3)
r9m = set_record(b9, 'moleteo', 'in_process', M['Moleteadora'],   U['maria'], 'A', None, 2, None)
b9.status = 'in_process'; b9.save(update_fields=['status', 'updated_at'])

make_qc(r9c, 5, 'T2', 'Cliente A', 'Manubrio 874', 'Honda XR 190',
        'si', 'hr', 'si', 'HSS Ø22.2', '1800 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '874.1', '874.0', '873.9', '', U['pedro'])
make_logs(r9c, U['pedro'], [
    {'piece':1,'l1':'Longitud (mm)','v1':'874.1','result':'conforme'},
    {'piece':2,'l1':'Longitud (mm)','v1':'874.0','result':'conforme'},
    {'piece':3,'l1':'Longitud (mm)','v1':'873.9','result':'conforme'},
    {'piece':4,'l1':'Longitud (mm)','v1':'874.2','result':'conforme'},
    {'piece':5,'l1':'Longitud (mm)','v1':'874.1','result':'conforme'},
    {'piece':6,'l1':'Longitud (mm)','v1':'873.8','result':'conforme'},
])
make_qc(r9ch, 4, 'T2', 'Cliente A', 'Manubrio 874', 'Honda XR 190',
        'si', 'hr', 'si', 'NA', 'NA',
        'verificado', 'conforme', '15 mm', 'conforme',
        '15.0', '14.9', '15.1', '', U['maria'])
make_logs(r9ch, U['maria'], [
    {'piece':1,'l1':'Distancia moleteo (mm)','v1':'15.0','result':'conforme'},
    {'piece':2,'l1':'Distancia moleteo (mm)','v1':'14.9','result':'conforme'},
    {'piece':3,'l1':'Distancia moleteo (mm)','v1':'15.1','result':'conforme'},
    {'piece':4,'l1':'Distancia moleteo (mm)','v1':'15.0','result':'conforme'},
])
# Puesta a punto del moleteado (en proceso)
make_qc(r9m, 2, 'T1', 'Cliente A', 'Manubrio 874', 'Honda XR 190',
        'si', 'hr', 'si', 'NA', 'NA',
        'verificado', 'conforme', '15 mm', 'conforme',
        '15.0', '15.0', '15.1', 'Moleteado iniciado turno mañana', U['maria'])
print(f"✓ {b9.batch_code}  Manubrio 874 — En proceso (moleteado) + QC")

# ── 10. Tubo corte 910 — EN PROCESO (corte en proceso) ───────────────────────
b10 = make_batch(P['Tubo corte 910'], 500, 'media', 2, U['juan'])
r10c= set_record(b10, 'corte', 'in_process', M['Bewo 1'], U['juan'], 'C', None, 1, None)
b10.status = 'in_process'; b10.save(update_fields=['status', 'updated_at'])

# Puesta a punto de corte al iniciar el turno
make_qc(r10c, 1, 'T3', 'Cliente D', 'Tubo 910', 'Varias',
        'si', 'hr', 'si', 'TCT Ø25.4', '2000 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '910.0', '910.1', '910.2', 'Turno nocturno, revisión inicial OK', U['juan'])
print(f"✓ {b10.batch_code}  Tubo corte 910 — En proceso (corte) + QC")

# ── 11. Horquilla 1100 — EN PROCESO (corte ✓, chaflan ✓, curvado en proceso) ─
b11 = make_batch(P['Horquilla 1100'], 250, 'alta', 1, sup)
r11c = set_record(b11, 'corte',   'finished',   M['Bewo 2'],        U['pedro'],  'B', 250, 4, 3)
r11ch= set_record(b11, 'chaflan', 'finished',   M['Chaflaneadora'], U['maria'],  'A', 248, 3, 2)
r11cu= set_record(b11, 'curvado', 'in_process', M['Socco 2'],       U['camila'], 'B', None, 1, None)
b11.status = 'in_process'; b11.save(update_fields=['status', 'updated_at'])

make_qc(r11c, 4, 'T2', 'Cliente F', 'Horquilla 1100', 'Yamaha FZ 150',
        'si', 'cr', 'si', 'HSS Ø28.6', '1600 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '1100.0', '1099.8', '1100.1', '', U['pedro'])
make_logs(r11c, U['pedro'], [
    {'piece':1,'l1':'Longitud (mm)','v1':'1100.0','result':'conforme'},
    {'piece':2,'l1':'Longitud (mm)','v1':'1099.8','result':'conforme'},
    {'piece':3,'l1':'Longitud (mm)','v1':'1100.1','result':'conforme'},
    {'piece':4,'l1':'Longitud (mm)','v1':'1100.2','result':'conforme'},
    {'piece':5,'l1':'Longitud (mm)','v1':'1099.9','result':'conforme'},
])
make_qc(r11ch, 3, 'T1', 'Cliente F', 'Horquilla 1100', 'Yamaha FZ 150',
        'si', 'cr', 'si', 'NA', 'NA',
        'verificado', 'conforme', 'NA', 'no_aplica',
        'OK', 'OK', 'OK', 'Chaflan sin observaciones', U['maria'])
make_logs(r11ch, U['maria'], [
    {'piece':1,'l1':'Ángulo chaflan (°)','v1':'45','result':'conforme'},
    {'piece':2,'l1':'Ángulo chaflan (°)','v1':'45','result':'conforme'},
    {'piece':3,'l1':'Ángulo chaflan (°)','v1':'44','result':'conforme'},
])
# Puesta a punto curvado (en proceso)
make_qc(r11cu, 1, 'T2', 'Cliente F', 'Horquilla 1100', 'Yamaha FZ 150',
        'si', 'cr', 'si', 'NA', 'NA',
        'verificado', 'conforme', 'NA', 'no_aplica',
        'OK', 'OK', 'OK', 'Curvado iniciado, radio conforme', U['camila'])
print(f"✓ {b11.batch_code}  Horquilla 1100 — En proceso (curvado) + QC")

# ── 12. Cuadrado 750 — EN PROCESO (corte ✓, chaflan en proceso) ──────────────
b12 = make_batch(P['Cuadrado 750'], 350, 'media', 4, U['maria'])
r12c = set_record(b12, 'corte',   'finished',   M['Bewo 1'],        U['juan'],  'A', 350, 2, 1)
r12ch= set_record(b12, 'chaflan', 'in_process', M['Chaflaneadora'], U['maria'], 'B', None, 1, None)
b12.status = 'in_process'; b12.save(update_fields=['status', 'updated_at'])

make_qc(r12c, 2, 'T1', 'Cliente E', 'Cuadrado 750', 'Especial',
        'si', 'hr', 'si', 'TCT Ø25.4', '1400 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '750.1', '750.0', '749.9', 'Tubo cuadrado, verificar escuadra', U['juan'])
make_logs(r12c, U['juan'], [
    {'piece':1,'l1':'Longitud (mm)','v1':'750.1','l2':'Escuadra (mm)','v2':'0.2','result':'conforme'},
    {'piece':2,'l1':'Longitud (mm)','v1':'750.0','l2':'Escuadra (mm)','v2':'0.1','result':'conforme'},
    {'piece':3,'l1':'Longitud (mm)','v1':'749.9','l2':'Escuadra (mm)','v2':'0.3','result':'conforme'},
    {'piece':4,'l1':'Longitud (mm)','v1':'750.2','l2':'Escuadra (mm)','v2':'0.2','result':'conforme'},
    {'piece':5,'l1':'Longitud (mm)','v1':'750.0','l2':'Escuadra (mm)','v2':'0.1','result':'conforme'},
])
make_qc(r12ch, 1, 'T2', 'Cliente E', 'Cuadrado 750', 'Especial',
        'si', 'hr', 'si', 'NA', 'NA',
        'verificado', 'conforme', 'NA', 'no_aplica',
        'OK', 'OK', 'OK', 'Chaflan en proceso turno tarde', U['maria'])
print(f"✓ {b12.batch_code}  Cuadrado 750 — En proceso (chaflanado) + QC")

# ── 13–18. Lotes EN CANASTA (sin procesos iniciados, sin QC) ─────────────────
b13 = make_batch(P['Defensa 900'],    175, 'baja',  7, sup)
b14 = make_batch(P['Manubrio 838'],   280, 'media', 5, sup)
b15 = make_batch(P['Tubo corte 650'], 750, 'baja', 10, U['pedro'])
b16 = make_batch(P['Defensa 1000'],   200, 'media', 8, sup, 'Revisar tolerancias antes de iniciar')
b17 = make_batch(P['Horquilla 1100'], 120, 'alta',  3, sup, 'Pedido prioritario Cliente F')
b18 = make_batch(P['Cuadrado 750'],   400, 'baja', 14, U['juan'])
for b, label in [(b13,'Defensa 900'),(b14,'Manubrio 838'),(b15,'Tubo corte 650'),
                 (b16,'Defensa 1000'),(b17,'Horquilla 1100'),(b18,'Cuadrado 750')]:
    print(f"✓ {b.batch_code}  {label} — En canasta")

# ══════════════════════════════════════════════════════════════════
print("""
=== Seed completo ===

USUARIOS
  supervisor / admin1234   → Supervisor (admin Django)
  juan       / op1234      → Operario  (Bewo 1, Bewo 2, Socco 1)
  maria      / op1234      → Operario  (Chaflaneadora, Moleteadora)
  pedro      / op1234      → Operario  (Bewo 1, Bewo 2, Socco 2)
  camila     / op1234      → Operario  (Socco 1, Socco 2)

LOTES (18 total)
  Terminados : 6   (incluye 2 despachados)
  En proceso : 6   (cada uno en distinta etapa)
  En canasta : 6

CALIDAD
  QualityCheck  : 1 por cada ProcessRecord iniciado/terminado
  DimensionalLog: mediciones por pieza en todos los cortes terminados
""")
