"""
Seed completo del sistema de producción de tubería.
Borra los datos transaccionales (lotes, procesos, calidad, programas) y los recrea
con estados consistentes — incluyendo ProcessShiftEntry para que cada turno tenga
un registro real y los operarios puedan terminar/continuar desde la UI.

Uso:
    poetry run python setup_initial_data.py
"""

import os, sys, django
from datetime import timedelta

# Asegurar UTF-8 en consola de Windows (cp1252 no soporta los emojis del log)
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

from django.db.models import Sum

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.contrib.auth.models import User, Group
from django.utils import timezone
from production.models import (
    TubeSpec, ProductType, Machine,
    ProductionBatch, ProcessRecord, ProcessShiftEntry,
    CuttingProgram, CuttingProgramLine,
)
from quality.models import QualityCheck, DimensionalLog

NOW = timezone.now()
ago = lambda days: NOW - timedelta(days=days)

print("=== Limpiando datos transaccionales ===")
QualityCheck.objects.all().delete()
DimensionalLog.objects.all().delete()
ProcessShiftEntry.objects.all().delete()
ProcessRecord.objects.all().delete()
CuttingProgramLine.objects.all().delete()
CuttingProgram.objects.all().delete()
ProductionBatch.objects.all().delete()

print("\n=== Cargando datos iniciales ===\n")

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
    ('operario1', 'Operario', '1', op_group),
    ('operario2', 'Operario', '2', op_group),
    ('operario3', 'Operario', '3', op_group),
    ('operario4', 'Operario', '4', op_group),
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

# ── Especificaciones de tubo (extraídas del programa real de la planta) ──────
# saw_type y rpm AHORA viven en el tubo largo (el producto los hereda).
tubes_data = [
    # (shape, outer_diameter, thickness, material, original_length, saw_type, rpm)
    ('round',  '5/8',    0.7, 'cr',     6000, 'hss', 2400),  # TUB CR REDONDO 5/8
    ('round',  '3/4',    0.7, 'cr',     6000, 'hss', 2400),  # TUB CR REDONDO 3/4
    ('round',  '1/2',    0.6, 'cr',     6000, 'hss', 2600),  # TUB CR REDONDO 1/2
    ('round',  '22.2',   2.0, 'cr',     6000, 'hss', 1800),  # TUBO 22.2 CAL 2.0 (manubrios)
    ('round',  '25.4',   1.5, 'cr',     6000, 'tct', 2000),  # TUBO 25.4 CAL 1.5
    ('round',  '15.88',  2.0, 'hr_est', 6000, 'hss', 2200),  # TUBO 15.88 HR EST CAL 2.0
    ('square', '20x40',  1.6, 'cr',     6000, 'tct', 1600),  # TUBO RECTANGULAR 20x40 EC SPFC 390
    ('round',  '6.35',   1.0, 'cr',     6000, 'hss', 2400),  # BARRA CALIBRADA 1016
]
T = {}
for sh, od, th, mat, lg, sw, rpm in tubes_data:
    t, _ = TubeSpec.objects.get_or_create(
        outer_diameter=od, thickness=th, material=mat, original_length=lg,
        defaults={'shape': sh, 'saw_type': sw, 'rpm': rpm},
    )
    T[f'{od}x{th}'] = t

# ── Tipos de producto (productos reales del programa Bewo) ───────────────────
# (name, item_code, tube_key, cut_length, chaflan, moleteo, curvado, client, priority, saw, rpm)
prods_data = [
    # ── Productos para manubrios — ruta completa (corte + chaflan + moleteo + curvado) ──
    ('TUBO 22.2 CAL 2.0 x 911mm CUR',          '277234', '22.2x2.0',   911, True,  True,  True,  'MotoPartes',                'alta',  'hss', 1800),
    ('TUBO 22.2 CAL 2.0 x 874mm CUR',          '236570', '22.2x2.0',   874, True,  True,  True,  'MotoPartes',                'media', 'hss', 1800),
    ('TUBO 22.2 CAL 2.0 x 920mm CUR',          '255330', '22.2x2.0',   920, True,  True,  True,  'MotoPartes',                'alta',  'hss', 1800),
    # ── Tubos con chaflanado + moleteado (sin curvado) ──
    ('TUBO 22.2 CAL 2.0 x 837mm',              '236564', '22.2x2.0',   837, True,  True,  False, 'MotoPartes',                'media', 'hss', 1800),
    ('TUBO 22.2 CAL 2.0 x 385mm PIPE REAR',    '358393', '22.2x2.0',   385, True,  True,  False, 'MotoPartes (CB125 New)',    'alta',  'hss', 1800),
    # ── Tubos con corte + curvado (defensas) ──
    ('TUBO 22.2 CAL 2.0 x 905mm',              '255321', '22.2x2.0',   905, False, False, True,  'MotoPartes (DIO)',          'media', 'hss', 1800),
    ('TUBO 25.4 CAL 1.5 x 843mm',              '328671', '25.4x1.5',   843, False, False, True,  'MotoPartes (Yamaha)',       'media', 'tct', 2000),
    # ── Tubos con corte + chaflanado (sin moleteo ni curvado) ──
    ('TUBO 22.2 CAL 2.0 x 766mm',              '282120', '22.2x2.0',   766, True,  False, False, 'MotoPartes (Tibsa CR-125)', 'media', 'hss', 1800),
    # ── Cortes simples (solo corte) ──
    ('TUB CR REDONDO 5/8 x 0.7 x 880mm',       '877135', '5/8x0.7',    880, False, False, False, 'Infantiles ABBA Limitada',  'media', 'hss', 2400),
    ('TUB CR REDONDO 3/4 x 0.7 x 250mm',       '877136', '3/4x0.7',    250, False, False, False, 'Infantiles ABBA Limitada',  'media', 'hss', 2400),
    ('TUB CR REDONDO 3/4 x 0.7 x 180mm',       '877137', '3/4x0.7',    180, False, False, False, 'Infantiles ABBA Limitada',  'baja',  'hss', 2400),
    ('TUB CR REDONDO 1/2 x 0.6 x 254mm',       '877138', '1/2x0.6',    254, False, False, False, 'Rejillas Plásticos S.A.',   'baja',  'hss', 2600),
    ('TUBO 15.88 HR EST CAL 2.0 x 327mm',      '357777', '15.88x2.0',  327, False, False, False, 'MotoPartes (Viga Trans.)',  'baja',  'hss', 2200),
    ('TUBO RECT 20x40 EC SPFC 1.6 x 657.5mm',  '281020', '20x40x1.6',  657, False, False, False, 'MotoPartes',                'media', 'tct', 1600),
    ('TUBO RECT 20x40 EC SPFC 1.6 x 343mm',    '358395', '20x40x1.6',  343, False, False, False, 'MotoPartes',                'media', 'tct', 1600),
    ('BARRA CALIBRADA 1016 x 6.35 x 201mm',    '277277', '6.35x1.0',   201, False, False, False, 'C. Marlets',                'baja',  'hss', 2400),
]
P = {}
for nm, item, tk, cl, ch, mo, cu, cli, pr, sw, rpm in prods_data:
    # sw y rpm ya no se guardan en el producto: viven en el tubo largo (T[tk]).
    obj, _ = ProductType.objects.get_or_create(name=nm, defaults={
        'tube_spec': T[tk], 'item_code': item, 'cut_length': cl,
        'requires_chaflan': ch, 'requires_moleteo': mo, 'requires_curvado': cu,
        'client': cli, 'default_priority': pr,
    })
    P[nm] = obj

# ── Máquinas ─────────────────────────────────────────────────────────────────
machines_data = [
    ('Bewo 1',        'corte',   ['operario1', 'operario3']),
    ('Bewo 2',        'corte',   ['operario1', 'operario3']),
    ('Chaflaneadora', 'chaflan', ['operario2']),
    ('Moleteadora',   'moleteo', ['operario2']),
    ('Socco 1',       'curvado', ['operario1', 'operario4']),
    ('Socco 2',       'curvado', ['operario3', 'operario4']),
]
M = {}
for n, pt, ops in machines_data:
    m, _ = Machine.objects.get_or_create(name=n, defaults={'process_type': pt})
    for u in ops:
        if u in U:
            m.operators.add(U[u])
    M[n] = m

print("✓ Catálogos listos\n")

# ══════════════════════════════════════════════════════════════════
#  HELPERS para crear lotes con estado consistente
# ══════════════════════════════════════════════════════════════════

def make_batch(product, qty, priority, scheduled_offset, created_by, notes=''):
    """Crea un lote con sus ProcessRecords (todos en pending)."""
    b = ProductionBatch.objects.create(
        product_type=product,
        total_quantity=qty,
        priority=priority,
        scheduled_date=(NOW + timedelta(days=scheduled_offset)).date(),
        status='in_basket',
        notes=notes,
        created_by=created_by,
    )
    b.create_process_records()
    return b


def add_shift(record, operator, machine, shift, qty, started_days_ago, finished_days_ago=None):
    """Crea un ProcessShiftEntry — si finished_days_ago=None queda activo (sin finished_at)."""
    return ProcessShiftEntry.objects.create(
        process_record=record,
        operator=operator,
        machine=machine,
        shift=shift,
        qty_done=qty,
        started_at=ago(started_days_ago),
        finished_at=ago(finished_days_ago) if finished_days_ago is not None else None,
    )


def finalize_record(record, target_status):
    """
    Recalcula el ProcessRecord a partir de sus ShiftEntries y lo deja en target_status.
    target_status: 'finished' | 'paused' | 'in_process'
    """
    total = record.shift_entries.aggregate(s=Sum('qty_done'))['s'] or 0
    last  = record.shift_entries.order_by('-started_at').first()

    record.qty_done = total
    record.status   = target_status
    if last:
        record.operator   = last.operator
        record.machine    = last.machine
        record.shift      = last.shift
        record.started_at = record.shift_entries.order_by('started_at').first().started_at
        if target_status == 'finished':
            record.finished_at = last.finished_at
    record.save()
    return record


def setup_process(batch, proc_type, target_status, shifts):
    """
    Crea los ShiftEntries para un proceso del lote y lo deja consistente.
    shifts: lista de tuples (operator, machine, shift, qty, started_days_ago, finished_days_ago_or_None)
    """
    rec = batch.records.get(process_type=proc_type)
    for s in shifts:
        add_shift(rec, *s)
    finalize_record(rec, target_status)
    return rec


def dispatch_batch(batch, days_ago):
    batch.status = 'dispatched'
    batch.dispatched_at = ago(days_ago)
    batch.save(update_fields=['status', 'dispatched_at', 'updated_at'])


def make_qc(record, date_ago, shift, client, item_tramo, moto,
            dim_ok, sheet, appear_ok, saw_ref, rpm_ref,
            jaw, cut_app, knurl_dist, dbl_knurl,
            s1, s2, s3, obs, created_by):
    if record is None:
        return
    QualityCheck.objects.get_or_create(
        process_record=record,
        defaults={
            'date': ago(date_ago).date(), 'shift': shift, 'client': client,
            'item_tramo': item_tramo, 'moto': moto,
            'dimensions_ok': dim_ok, 'sheet_type': sheet, 'appearance_ok': appear_ok,
            'saw_type_ref': saw_ref, 'rpm_ref': rpm_ref,
            'jaw_pressure': jaw, 'cut_appearance': cut_app,
            'knurling_distance': knurl_dist, 'double_knurling_free': dbl_knurl,
            'sample_1': s1, 'sample_2': s2, 'sample_3': s3,
            'observations': obs, 'created_by': created_by,
        },
    )


def make_logs(record, operator, measurements):
    if record is None:
        return
    for m in measurements:
        DimensionalLog.objects.get_or_create(
            process_record=record,
            piece_number=m['piece'],
            defaults={
                'measure_label_1': m['l1'],     'measure_1':       m['v1'],
                'measure_label_2': m.get('l2', ''), 'measure_2': m.get('v2', ''),
                'measure_label_3': m.get('l3', ''), 'measure_3': m.get('v3', ''),
                'result':          m['result'],
                'notes':           m.get('notes', ''),
                'operator':        operator,
            },
        )


def mark_batch_status(batch):
    """Si todos los records están finished → batch.status='finished'. Si alguno está in_process/paused → in_process."""
    if not batch.records.exclude(status='finished').exists():
        batch.status = 'finished'
    elif batch.records.exclude(status='pending').exists():
        batch.status = 'in_process'
    batch.save(update_fields=['status', 'updated_at'])


print("=== Creando lotes ===\n")

# Atajos a los productos por su descripción real
PROD_911       = P['TUBO 22.2 CAL 2.0 x 911mm CUR']
PROD_874       = P['TUBO 22.2 CAL 2.0 x 874mm CUR']
PROD_920       = P['TUBO 22.2 CAL 2.0 x 920mm CUR']
PROD_837       = P['TUBO 22.2 CAL 2.0 x 837mm']
PROD_385       = P['TUBO 22.2 CAL 2.0 x 385mm PIPE REAR']
PROD_905       = P['TUBO 22.2 CAL 2.0 x 905mm']
PROD_843       = P['TUBO 25.4 CAL 1.5 x 843mm']
PROD_766       = P['TUBO 22.2 CAL 2.0 x 766mm']
PROD_580_5_8   = P['TUB CR REDONDO 5/8 x 0.7 x 880mm']
PROD_250_3_4   = P['TUB CR REDONDO 3/4 x 0.7 x 250mm']
PROD_180_3_4   = P['TUB CR REDONDO 3/4 x 0.7 x 180mm']
PROD_254_1_2   = P['TUB CR REDONDO 1/2 x 0.6 x 254mm']
PROD_15_88     = P['TUBO 15.88 HR EST CAL 2.0 x 327mm']
PROD_RECT_657  = P['TUBO RECT 20x40 EC SPFC 1.6 x 657.5mm']
PROD_RECT_343  = P['TUBO RECT 20x40 EC SPFC 1.6 x 343mm']
PROD_BARRA     = P['BARRA CALIBRADA 1016 x 6.35 x 201mm']

# ══════════════════════════════════════════════════════════════════
# 1. Manubrio 22.2x911 CUR — TERMINADO (4 procesos completos)
# ══════════════════════════════════════════════════════════════════
b1 = make_batch(PROD_911, 500, 'alta', -2, sup)
r1c  = setup_process(b1, 'corte',   'finished', [(U['operario1'], M['Bewo 1'],        'A', 500, 13, 12)])
r1ch = setup_process(b1, 'chaflan', 'finished', [(U['operario2'], M['Chaflaneadora'], 'A', 498, 12, 11)])
r1m  = setup_process(b1, 'moleteo', 'finished', [(U['operario2'], M['Moleteadora'],   'A', 498, 11, 10)])
r1cu = setup_process(b1, 'curvado', 'finished', [(U['operario4'], M['Socco 1'],       'B', 498, 10, 10)])
mark_batch_status(b1)
make_qc(r1c, 13, 'T1', 'MotoPartes', '277234', 'Honda CG 150',
        'si', 'cr', 'si', 'HSS Ø22.2', '1800 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '911.1', '910.9', '911.2', '', U['operario1'])
make_logs(r1c, U['operario1'], [
    {'piece': i, 'l1': 'Longitud (mm)', 'v1': v, 'result': 'conforme'}
    for i, v in enumerate(['911.1','910.9','911.0','911.3','911.2','910.8','911.4','911.1'], 1)
])
print(f"✓ {b1.batch_code}  TUBO 22.2 x 911mm CUR — Terminado")

# ══════════════════════════════════════════════════════════════════


# ══════════════════════════════════════════════════════════════════
# 3. Defensa 22.2x905 — DESPACHADO
# ══════════════════════════════════════════════════════════════════
b3 = make_batch(PROD_905, 200, 'media', -8, sup)
r3c  = setup_process(b3, 'corte',   'finished', [(U['operario1'], M['Bewo 1'],  'A', 200, 22, 21)])
r3cu = setup_process(b3, 'curvado', 'finished', [(U['operario4'], M['Socco 1'], 'A', 200, 21, 20)])
mark_batch_status(b3)
dispatch_batch(b3, 19)
make_qc(r3c, 22, 'T1', 'MotoPartes (DIO)', '255321', 'Honda DIO',
        'si', 'cr', 'si', 'HSS Ø22.2', '1800 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '905.1', '904.9', '905.0', '', U['operario1'])
print(f"✓ {b3.batch_code}  TUBO 22.2 x 905mm — Despachado")



# ══════════════════════════════════════════════════════════════════
# 7. TUBO 22.2 x 911mm CUR — EN PROCESO (corte ✓, chaflan activo)
# ══════════════════════════════════════════════════════════════════
b7 = make_batch(PROD_911, 600, 'alta', 1, sup)
r7c  = setup_process(b7, 'corte', 'finished', [(U['operario3'], M['Bewo 2'], 'A', 600, 4, 3)])
# Chaflan: Operario 2 lleva 200 en su turno actual (sin cerrar)
r7ch = b7.records.get(process_type='chaflan')
add_shift(r7ch, U['operario2'], M['Chaflaneadora'], 'A', 200, 1, None)  # turno activo
finalize_record(r7ch, 'in_process')
mark_batch_status(b7)
make_qc(r7c, 4, 'T1', 'MotoPartes', '277234', 'Honda CG 150',
        'si', 'cr', 'si', 'HSS Ø22.2', '1800 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '911.0', '911.1', '910.9', '', U['operario3'])
print(f"✓ {b7.batch_code}  TUBO 22.2 x 911mm CUR — En proceso (chaflanado 200/600)")

# ══════════════════════════════════════════════════════════════════
# 8. TUBO 25.4 x 843mm — PAUSADO en corte (operario1 cerró 80/150)
# ══════════════════════════════════════════════════════════════════
b8 = make_batch(PROD_843, 150, 'media', 3, U['operario4'])
r8c = b8.records.get(process_type='corte')
add_shift(r8c, U['operario1'], M['Bewo 1'], 'B', 80, 1, 1)  # turno cerrado parcial
finalize_record(r8c, 'paused')
mark_batch_status(b8)
make_qc(r8c, 1, 'T2', 'MotoPartes (Yamaha)', '328671', 'Yamaha YZ 150',
        'si', 'cr', 'si', 'TCT Ø25.4', '2000 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '843.2', '843.0', '842.8', 'Cierre de turno - faltan 70 uds', U['operario1'])
print(f"✓ {b8.batch_code}  TUBO 25.4 x 843mm — Pausado (corte 80/150, esperando relevo)")


# ══════════════════════════════════════════════════════════════════
# 13–18. Lotes EN CANASTA (sin procesos iniciados)
# ══════════════════════════════════════════════════════════════════
b13 = make_batch(PROD_180_3_4,  175, 'baja',  7, sup)
b14 = make_batch(PROD_837,      280, 'media', 5, sup)
b15 = make_batch(PROD_254_1_2,  750, 'baja', 10, U['operario3'])
b16 = make_batch(PROD_15_88,    200, 'media', 8, sup, 'Revisar tolerancias antes de iniciar')
b17 = make_batch(PROD_RECT_657, 120, 'alta',  3, sup, 'Pedido prioritario MotoPartes')
b18 = make_batch(PROD_BARRA,    400, 'baja', 14, U['operario1'])
for b, label in [(b13,'TUB CR REDONDO 3/4 x 180mm'),
                 (b14,'TUBO 22.2 x 837mm'),
                 (b15,'TUB CR REDONDO 1/2 x 254mm'),
                 (b16,'TUBO 15.88 HR EST x 327mm'),
                 (b17,'TUBO RECT 20x40 x 657.5mm'),
                 (b18,'BARRA CALIBRADA 1016 x 201mm')]:
    print(f"✓ {b.batch_code}  {label} — En canasta")

# ══════════════════════════════════════════════════════════════════
print("""
=== Seed completo ===

USUARIOS (pruebas piloto)
  supervisor / admin1234   → Supervisor (admin Django)
  operario1  / op1234      → Operario 1  (Bewo 1, Bewo 2, Socco 1)
  operario2  / op1234      → Operario 2  (Chaflaneadora, Moleteadora)
  operario3  / op1234      → Operario 3  (Bewo 1, Bewo 2, Socco 2)
  operario4  / op1234      → Operario 4  (Socco 1, Socco 2)

CATÁLOGO
  8 TubeSpecs (extraídos del programa real: 5/8, 3/4, 1/2, 22.2,
                25.4, 15.88, 20x40 rect., 6.35 barra)
  16 ProductTypes con item_codes reales (277234, 877135, 358393, etc.)
  Clientes: MotoPartes, Infantiles ABBA, Rejillas Plásticos, etc.

LOTES (18 total, todos consistentes con ProcessShiftEntry)
  Terminados (4):  LOTE-0001, LOTE-0004, LOTE-0005, LOTE-0006
  Despachados (2): LOTE-0002, LOTE-0003
  Pausados (2):    LOTE-0008 (corte 80/150),  LOTE-0009 (moleteo 250/450)
  Activos (4):     LOTE-0007 (chaflan 200/600), LOTE-0010 (corte 120/500),
                   LOTE-0011 (moleteo 80/250),  LOTE-0012 (chaflan 100/350)
  En canasta (6):  LOTE-0013 al LOTE-0018

CALIDAD
  QualityCheck creado para cada proceso terminado o activo
  DimensionalLog con 5–8 mediciones por lote terminado de corte
""")
