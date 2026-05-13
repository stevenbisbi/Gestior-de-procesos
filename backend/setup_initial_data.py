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
    ('round',  '22.2', 1.6, 'hr',  6000),
    ('round',  '19.1', 1.2, 'hr',  6000),
    ('round',  '25.4', 1.6, 'hr',  6000),
    ('round',  '31.8', 1.6, 'hr',  6000),
    ('square', '25.4', 1.6, 'hr',  6000),
    ('round',  '28.6', 1.6, 'cr',  6000),
]
T = {}
for sh, od, th, mat, lg in tubes_data:
    t, _ = TubeSpec.objects.get_or_create(
        outer_diameter=od, thickness=th, material=mat, original_length=lg,
        defaults={'shape': sh},
    )
    T[f'{od}x{th}'] = t

# ── Tipos de producto ────────────────────────────────────────────────────────
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

# ══════════════════════════════════════════════════════════════════
# 1. Manubrio 838 — TERMINADO (4 procesos completos)
# ══════════════════════════════════════════════════════════════════
b1 = make_batch(P['Manubrio 838'], 500, 'alta', -2, sup)
r1c  = setup_process(b1, 'corte',   'finished', [(U['juan'],   M['Bewo 1'],        'A', 500, 13, 12)])
r1ch = setup_process(b1, 'chaflan', 'finished', [(U['maria'],  M['Chaflaneadora'], 'A', 498, 12, 11)])
r1m  = setup_process(b1, 'moleteo', 'finished', [(U['maria'],  M['Moleteadora'],   'A', 498, 11, 10)])
r1cu = setup_process(b1, 'curvado', 'finished', [(U['camila'], M['Socco 1'],       'B', 498, 10, 10)])
mark_batch_status(b1)
make_qc(r1c, 13, 'T1', 'Cliente A', 'Manubrio 838', 'Honda CG 150',
        'si', 'hr', 'si', 'HSS Ø22.2', '1800 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '838.1', '837.9', '838.2', '', U['juan'])
make_logs(r1c, U['juan'], [
    {'piece': i, 'l1': 'Longitud (mm)', 'v1': v, 'result': 'conforme'}
    for i, v in enumerate(['838.1','837.9','838.0','838.3','838.2','837.8','838.4','838.1'], 1)
])
print(f"✓ {b1.batch_code}  Manubrio 838 — Terminado")

# ══════════════════════════════════════════════════════════════════
# 2. Manubrio 874 — DESPACHADO
# ══════════════════════════════════════════════════════════════════
b2 = make_batch(P['Manubrio 874'], 300, 'media', -5, sup)
r2c  = setup_process(b2, 'corte',   'finished', [(U['pedro'],  M['Bewo 2'],        'B', 300, 20, 18)])
r2ch = setup_process(b2, 'chaflan', 'finished', [(U['maria'],  M['Chaflaneadora'], 'A', 298, 18, 17)])
r2m  = setup_process(b2, 'moleteo', 'finished', [(U['maria'],  M['Moleteadora'],   'B', 298, 17, 16)])
r2cu = setup_process(b2, 'curvado', 'finished', [(U['camila'], M['Socco 2'],       'A', 296, 16, 15)])
mark_batch_status(b2)
dispatch_batch(b2, 14)
make_qc(r2c, 20, 'T2', 'Cliente A', 'Manubrio 874', 'Honda XR 190',
        'si', 'hr', 'si', 'HSS Ø22.2', '1800 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '874.0', '873.8', '874.2', '', U['pedro'])
print(f"✓ {b2.batch_code}  Manubrio 874 — Despachado")

# ══════════════════════════════════════════════════════════════════
# 3. Defensa 900 — DESPACHADO
# ══════════════════════════════════════════════════════════════════
b3 = make_batch(P['Defensa 900'], 200, 'media', -8, sup)
r3c  = setup_process(b3, 'corte',   'finished', [(U['juan'],   M['Bewo 1'],  'A', 200, 22, 21)])
r3cu = setup_process(b3, 'curvado', 'finished', [(U['camila'], M['Socco 1'], 'A', 200, 21, 20)])
mark_batch_status(b3)
dispatch_batch(b3, 19)
make_qc(r3c, 22, 'T1', 'Cliente B', 'Defensa 900', 'Honda CB 250',
        'si', 'hr', 'si', 'TCT Ø22.2', '2200 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '900.1', '899.9', '900.0', '', U['juan'])
print(f"✓ {b3.batch_code}  Defensa 900 — Despachado")

# ══════════════════════════════════════════════════════════════════
# 4. Tubo corte 650 — TERMINADO
# ══════════════════════════════════════════════════════════════════
b4 = make_batch(P['Tubo corte 650'], 1000, 'baja', -1, U['juan'])
r4c = setup_process(b4, 'corte', 'finished', [(U['pedro'], M['Bewo 2'], 'C', 1000, 8, 7)])
mark_batch_status(b4)
make_qc(r4c, 8, 'T3', 'Cliente C', 'Tubo 650', 'Varias',
        'si', 'hr', 'si', 'HSS Ø19.1', '2400 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '650.0', '649.8', '650.1', 'Lote de tubos simples', U['pedro'])
print(f"✓ {b4.batch_code}  Tubo corte 650 — Terminado")

# ══════════════════════════════════════════════════════════════════
# 5. Manubrio 920 — TERMINADO con corte hecho en 2 turnos (handoff)
# ══════════════════════════════════════════════════════════════════
b5 = make_batch(P['Manubrio 920'], 400, 'alta', -1, sup, 'Pedido urgente Cliente A')
# Corte: Juan cerró su turno con 200, Pedro continuó y terminó las 200 restantes
r5c  = setup_process(b5, 'corte', 'finished', [
    (U['juan'],  M['Bewo 1'], 'A', 200, 9, 9),
    (U['pedro'], M['Bewo 1'], 'B', 200, 9, 8),
])
r5ch = setup_process(b5, 'chaflan', 'finished', [(U['maria'],  M['Chaflaneadora'], 'B', 398, 8, 7)])
r5m  = setup_process(b5, 'moleteo', 'finished', [(U['maria'],  M['Moleteadora'],   'A', 398, 7, 6)])
r5cu = setup_process(b5, 'curvado', 'finished', [(U['pedro'],  M['Socco 2'],       'B', 395, 6, 5)])
mark_batch_status(b5)
make_qc(r5c, 9, 'T1', 'Cliente A', 'Manubrio 920', 'Honda XR 250',
        'si', 'hr', 'si', 'HSS Ø22.2', '1800 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '920.0', '919.9', '920.2', 'Pedido urgente revisado', U['juan'])
print(f"✓ {b5.batch_code}  Manubrio 920 — Terminado (corte en 2 turnos)")

# ══════════════════════════════════════════════════════════════════
# 6. Tubo corte 910 — TERMINADO
# ══════════════════════════════════════════════════════════════════
b6 = make_batch(P['Tubo corte 910'], 800, 'media', 2, U['pedro'])
r6c = setup_process(b6, 'corte', 'finished', [(U['juan'], M['Bewo 1'], 'A', 800, 6, 5)])
mark_batch_status(b6)
make_qc(r6c, 6, 'T1', 'Cliente D', 'Tubo 910', 'Varias',
        'si', 'hr', 'si', 'TCT Ø25.4', '2000 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '910.1', '910.0', '909.9', '', U['juan'])
print(f"✓ {b6.batch_code}  Tubo corte 910 — Terminado")

# ══════════════════════════════════════════════════════════════════
# 7. Manubrio 838 — EN PROCESO (corte ✓, chaflan en proceso por María)
# ══════════════════════════════════════════════════════════════════
b7 = make_batch(P['Manubrio 838'], 600, 'alta', 1, sup)
r7c  = setup_process(b7, 'corte', 'finished', [(U['pedro'], M['Bewo 2'], 'A', 600, 4, 3)])
# Chaflan: María lleva 200 en su turno actual (sin cerrar)
r7ch = b7.records.get(process_type='chaflan')
add_shift(r7ch, U['maria'], M['Chaflaneadora'], 'A', 200, 1, None)  # turno activo
finalize_record(r7ch, 'in_process')
mark_batch_status(b7)
make_qc(r7c, 4, 'T1', 'Cliente A', 'Manubrio 838', 'Honda CG 150',
        'si', 'hr', 'si', 'HSS Ø22.2', '1800 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '838.0', '838.1', '837.9', '', U['pedro'])
print(f"✓ {b7.batch_code}  Manubrio 838 — En proceso (chaflanado activo, 200/600)")

# ══════════════════════════════════════════════════════════════════
# 8. Defensa 1000 — PAUSADO en corte (Juan cerró turno con 80/150)
# ══════════════════════════════════════════════════════════════════
b8 = make_batch(P['Defensa 1000'], 150, 'media', 3, U['camila'])
r8c = b8.records.get(process_type='corte')
add_shift(r8c, U['juan'], M['Bewo 1'], 'B', 80, 1, 1)  # turno cerrado parcial
finalize_record(r8c, 'paused')
mark_batch_status(b8)
make_qc(r8c, 1, 'T2', 'Cliente B', 'Defensa 1000', 'Honda Tornado',
        'si', 'hr', 'si', 'TCT Ø31.8', '1600 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '1000.2', '1000.0', '999.8', 'Cierre de turno - faltan 70 uds', U['juan'])
print(f"✓ {b8.batch_code}  Defensa 1000 — Pausado (corte 80/150, esperando relevo)")

# ══════════════════════════════════════════════════════════════════
# 9. Manubrio 874 — EN PROCESO (corte ✓, chaflan ✓, moleteo PAUSADO)
# ══════════════════════════════════════════════════════════════════
b9 = make_batch(P['Manubrio 874'], 450, 'alta', 0, sup, 'Segunda corrida Cliente A')
r9c  = setup_process(b9, 'corte',   'finished', [(U['pedro'], M['Bewo 2'],        'A', 450, 5, 4)])
r9ch = setup_process(b9, 'chaflan', 'finished', [(U['maria'], M['Chaflaneadora'], 'B', 448, 4, 3)])
# Moleteo: María hizo 250 y cerró turno (queda pausado)
r9m = b9.records.get(process_type='moleteo')
add_shift(r9m, U['maria'], M['Moleteadora'], 'A', 250, 2, 2)
finalize_record(r9m, 'paused')
mark_batch_status(b9)
make_qc(r9c, 5, 'T2', 'Cliente A', 'Manubrio 874', 'Honda XR 190',
        'si', 'hr', 'si', 'HSS Ø22.2', '1800 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '874.1', '874.0', '873.9', '', U['pedro'])
print(f"✓ {b9.batch_code}  Manubrio 874 — En proceso (moleteo pausado 250/450)")

# ══════════════════════════════════════════════════════════════════
# 10. Tubo corte 910 — EN PROCESO (corte activo por Juan)
# ══════════════════════════════════════════════════════════════════
b10 = make_batch(P['Tubo corte 910'], 500, 'media', 2, U['juan'])
r10c = b10.records.get(process_type='corte')
add_shift(r10c, U['juan'], M['Bewo 1'], 'C', 120, 1, None)  # turno activo
finalize_record(r10c, 'in_process')
mark_batch_status(b10)
make_qc(r10c, 1, 'T3', 'Cliente D', 'Tubo 910', 'Varias',
        'si', 'hr', 'si', 'TCT Ø25.4', '2000 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '910.0', '910.1', '910.2', 'Turno nocturno, revisión inicial OK', U['juan'])
print(f"✓ {b10.batch_code}  Tubo corte 910 — En proceso (corte activo, 120/500)")

# ══════════════════════════════════════════════════════════════════
# 11. Horquilla 1100 — EN PROCESO (curvado activo por Camila)
# ══════════════════════════════════════════════════════════════════
b11 = make_batch(P['Horquilla 1100'], 250, 'alta', 1, sup)
r11c  = setup_process(b11, 'corte',   'finished', [(U['pedro'], M['Bewo 2'],        'B', 250, 4, 3)])
r11ch = setup_process(b11, 'chaflan', 'finished', [(U['maria'], M['Chaflaneadora'], 'A', 248, 3, 2)])
r11cu = b11.records.get(process_type='curvado')
add_shift(r11cu, U['camila'], M['Socco 2'], 'B', 80, 1, None)  # turno activo
finalize_record(r11cu, 'in_process')
mark_batch_status(b11)
make_qc(r11c, 4, 'T2', 'Cliente F', 'Horquilla 1100', 'Yamaha FZ 150',
        'si', 'cr', 'si', 'HSS Ø28.6', '1600 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '1100.0', '1099.8', '1100.1', '', U['pedro'])
print(f"✓ {b11.batch_code}  Horquilla 1100 — En proceso (curvado activo, 80/250)")

# ══════════════════════════════════════════════════════════════════
# 12. Cuadrado 750 — EN PROCESO (chaflan activo por María)
# ══════════════════════════════════════════════════════════════════
b12 = make_batch(P['Cuadrado 750'], 350, 'media', 4, U['maria'])
r12c = setup_process(b12, 'corte', 'finished', [(U['juan'], M['Bewo 1'], 'A', 350, 2, 1)])
r12ch = b12.records.get(process_type='chaflan')
add_shift(r12ch, U['maria'], M['Chaflaneadora'], 'B', 100, 1, None)  # turno activo
finalize_record(r12ch, 'in_process')
mark_batch_status(b12)
make_qc(r12c, 2, 'T1', 'Cliente E', 'Cuadrado 750', 'Especial',
        'si', 'hr', 'si', 'TCT Ø25.4', '1400 RPM',
        'verificado', 'conforme', 'NA', 'no_aplica',
        '750.1', '750.0', '749.9', 'Tubo cuadrado, verificar escuadra', U['juan'])
print(f"✓ {b12.batch_code}  Cuadrado 750 — En proceso (chaflanado activo, 100/350)")

# ══════════════════════════════════════════════════════════════════
# 13–18. Lotes EN CANASTA (sin procesos iniciados)
# ══════════════════════════════════════════════════════════════════
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

LOTES (18 total, todos consistentes con ProcessShiftEntry)
  Terminados (4):  LOTE-0001, LOTE-0004, LOTE-0005, LOTE-0006
  Despachados (2): LOTE-0002, LOTE-0003
  Pausados (2):    LOTE-0008 (corte 80/150),  LOTE-0009 (moleteo 250/450)
  Activos (4):     LOTE-0007 (chaflan 200/600), LOTE-0010 (corte 120/500),
                   LOTE-0011 (curvado 80/250),  LOTE-0012 (chaflan 100/350)
  En canasta (6):  LOTE-0013 al LOTE-0018

CALIDAD
  QualityCheck creado para cada proceso terminado o activo
  DimensionalLog con 5–8 mediciones por lote terminado de corte
""")
