from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


# ─────────────────────────────────────────────
#  CATÁLOGOS BASE
# ─────────────────────────────────────────────

class TubeSpec(models.Model):
    SHAPE_CHOICES = [('round', 'Redondo'), ('square', 'Cuadrado')]
    MATERIAL_CHOICES = [('cr','CR'),('hr','HR'),('cr_est','CR EST'),('hr_est','HR EST')]

    shape           = models.CharField(max_length=10, choices=SHAPE_CHOICES)
    # CharField — admite valores fraccionados como "1/2", "5/8" o decimales "22.2"
    outer_diameter  = models.CharField(max_length=20, verbose_name='Diámetro/lado (mm)')
    thickness       = models.FloatField(verbose_name='Espesor (mm)')
    material        = models.CharField(max_length=10, choices=MATERIAL_CHOICES)
    original_length = models.FloatField(default=6000, verbose_name='Longitud original (mm)')
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['outer_diameter', 'thickness', 'material', 'original_length']
        ordering = ['outer_diameter', 'thickness']

    def __str__(self):
        return f'{self.outer_diameter} × {self.thickness} × {self.original_length:.0f} mm ({self.get_material_display()})'


class ProductType(models.Model):
    PRIORITY_CHOICES = [('alta','Alta'),('media','Media'),('baja','Baja')]

    name              = models.CharField(max_length=100)
    item_code         = models.CharField(max_length=50, blank=True, verbose_name='Item')
    tube_spec         = models.ForeignKey(TubeSpec, on_delete=models.PROTECT, related_name='product_types')
    cut_length        = models.FloatField(verbose_name='Longitud de corte (mm)')
    client            = models.CharField(max_length=200, blank=True)
    default_priority  = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='media')
    requires_chaflan  = models.BooleanField(default=False)
    requires_moleteo  = models.BooleanField(default=False)
    requires_curvado  = models.BooleanField(default=False)
    saw_type          = models.CharField(max_length=4, choices=[('hss','HSS'),('tct','TCT'),('none','Ninguno')], default='none')
    rpm               = models.IntegerField(null=True, blank=True)
    notes             = models.TextField(blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.name} — {self.tube_spec} @{self.cut_length:.0f}mm'

    def get_process_route(self):
        route = ['corte']
        if self.requires_chaflan: route.append('chaflan')
        if self.requires_moleteo: route.append('moleteo')
        if self.requires_curvado: route.append('curvado')
        return route


class Machine(models.Model):
    PROCESS_CHOICES = [('corte','Corte'),('chaflan','Chaflanado'),('moleteo','Moleteado'),('curvado','Curvado')]

    name         = models.CharField(max_length=100)
    process_type = models.CharField(max_length=10, choices=PROCESS_CHOICES)
    operators    = models.ManyToManyField(User, related_name='machines', blank=True)
    is_active    = models.BooleanField(default=True)

    def __str__(self):
        return f'{self.name} ({self.get_process_type_display()})'


# ─────────────────────────────────────────────
#  LOTES Y PROCESOS
# ─────────────────────────────────────────────

PROCESS_LABELS = {'corte':'Corte','chaflan':'Chaflanado','moleteo':'Moleteado','curvado':'Curvado'}

class ProductionBatch(models.Model):
    STATUS_CHOICES = [
        ('waiting_material', 'Esperando material'),  # creado, pero almacén no entregó tubería todavía
        ('in_basket',  'En canasta'),                 # material recibido por el cortador, listo para cortar
        ('in_process', 'En proceso'),
        ('finished',   'Terminado'),
        ('dispatched', 'Despachado'),
    ]
    PRIORITY_CHOICES = [('alta','Alta'),('media','Media'),('baja','Baja')]

    batch_code      = models.CharField(max_length=20, unique=True, blank=True)
    product_type    = models.ForeignKey(ProductType, on_delete=models.PROTECT, related_name='batches')
    total_quantity  = models.IntegerField()
    priority        = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='media')
    scheduled_date  = models.DateField(null=True, blank=True)
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='waiting_material')
    notes           = models.TextField(blank=True)
    created_by      = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='batches_created')
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)
    dispatched_at   = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.batch_code} — {self.product_type.name}'

    def save(self, *args, **kwargs):
        if not self.batch_code:
            last = ProductionBatch.objects.order_by('-id').first()
            next_id = (last.id + 1) if last else 1
            self.batch_code = f'LOTE-{next_id:04d}'
        super().save(*args, **kwargs)

    def create_process_records(self):
        for seq, proc in enumerate(self.product_type.get_process_route(), start=1):
            ProcessRecord.objects.get_or_create(
                batch=self, process_type=proc,
                defaults={'sequence': seq, 'qty_assigned': self.total_quantity}
            )

    def is_available_for_process(self, process_type):
        route = self.product_type.get_process_route()
        if process_type not in route:
            return False
        idx = route.index(process_type)
        if idx == 0:
            return self.status in ('in_basket', 'in_process')
        prev = self.records.filter(process_type=route[idx-1]).first()
        # El proceso anterior debe estar terminado (todo lo bueno ya producido)
        return prev and prev.status == 'finished'

    def upstream_good_qty(self, process_type):
        """
        Cuántas piezas buenas tiene disponibles el proceso anterior para que
        este consuma. Si es el primero, retorna qty_assigned del lote.
        """
        route = self.product_type.get_process_route()
        if process_type not in route:
            return 0
        idx = route.index(process_type)
        if idx == 0:
            return self.total_quantity
        prev = self.records.filter(process_type=route[idx-1]).first()
        return prev.qty_good if prev else 0

    def sync_records_qty(self):
        """
        Reaplica total_quantity como qty_assigned a todos los procesos y recalcula
        sus estados según lo ya producido. Se llama cuando el supervisor corrige el conteo.
        """
        for rec in self.records.all():
            rec.qty_assigned = self.total_quantity
            if rec.active_shift:
                rec.status = 'in_process'
            elif rec.qty_done >= self.total_quantity and rec.qty_done > 0:
                rec.status = 'finished'
                if not rec.finished_at:
                    rec.finished_at = timezone.now()
            elif rec.qty_done > 0:
                rec.status = 'paused'
            else:
                rec.status = 'pending'
            rec.save(update_fields=['qty_assigned', 'status', 'finished_at'])
        self._recalc_status()

    def _recalc_status(self):
        """Recalcula el estado del lote a partir de sus procesos (no toca dispatched ni waiting_material)."""
        if self.status in ('dispatched', 'waiting_material'):
            return
        if not self.records.exists():
            return
        if not self.records.exclude(status='finished').exists():
            self.status = 'finished'
        elif self.records.exclude(status='pending').exists():
            self.status = 'in_process'
        else:
            self.status = 'in_basket'
        self.save(update_fields=['status', 'updated_at'])

    def receive_material(self, user, tube_spec=None, quantity=None, delivered_by='', notes=''):
        """
        El cortador confirma recepción del material → lote pasa de
        'waiting_material' a 'in_basket' (listo para cortar).
        Opcionalmente registra el TubeReception para inventario / auditoría.
        """
        from django.core.exceptions import ValidationError
        if self.status != 'waiting_material':
            raise ValidationError('Este lote no está esperando material.')
        self.status = 'in_basket'
        self.save(update_fields=['status', 'updated_at'])
        if tube_spec and quantity:
            TubeReception.objects.create(
                tube_spec=tube_spec, quantity=quantity,
                delivered_by=delivered_by or '', notes=notes or '',
                received_by=user, batch=self,
            )

    @property
    def progress_pct(self):
        """Avance ponderado real: suma de uds hechas en TODOS los procesos / total esperado."""
        from django.db.models import Sum
        agg = self.records.aggregate(done=Sum('qty_done'), total=Sum('qty_assigned'))
        total = agg['total'] or 0
        done  = agg['done']  or 0
        if total == 0:
            return 0
        return int((done / total) * 100)


# ─────────────────────────────────────────────
#  CANASTA DE TUBERÍA (recepción de materia prima)
# ─────────────────────────────────────────────

class TubeReception(models.Model):
    """
    Registro de recepción de tubería cruda desde almacén.
    - tube_spec: qué tipo de tubo llegó
    - quantity: cuántos
    - batch (opcional): si la recepción fue contra un lote específico, queda enlazado
    """
    tube_spec    = models.ForeignKey(TubeSpec, on_delete=models.PROTECT, related_name='receptions')
    quantity     = models.IntegerField(verbose_name='Cantidad de tubos recibidos')
    delivered_by = models.CharField(max_length=200, blank=True, verbose_name='Entregado por (almacén)')
    notes        = models.TextField(blank=True)
    received_by  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='tube_receptions')
    received_at  = models.DateTimeField(auto_now_add=True)
    batch        = models.ForeignKey(
        'ProductionBatch', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='material_receptions',
    )

    class Meta:
        ordering = ['-received_at']

    def __str__(self):
        return f'{self.quantity}× {self.tube_spec} ({self.received_at:%Y-%m-%d})'


# ─────────────────────────────────────────────
#  PROGRAMA DE CORTE
# ─────────────────────────────────────────────

class CuttingProgram(models.Model):
    STATUS_CHOICES = [
        ('draft',  'Borrador'),
        ('active', 'Activo'),
        ('closed', 'Cerrado'),
    ]
    month      = models.DateField(verbose_name='Mes del programa')   # primer día del mes
    version    = models.IntegerField(default=1)
    status     = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    notes      = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='cutting_programs')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-month', '-version']

    def __str__(self):
        MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
        return f'Programa {MONTHS[self.month.month - 1]} {self.month.year} v{self.version}'

    def activate(self):
        """Activa este programa y cierra cualquier otro activo."""
        CuttingProgram.objects.filter(status='active').exclude(pk=self.pk).update(status='closed')
        self.status = 'active'
        self.save(update_fields=['status', 'updated_at'])


class CuttingProgramLine(models.Model):
    SAW_CHOICES = [('hss', 'HSS'), ('tct', 'TCT')]

    program      = models.ForeignKey(CuttingProgram, on_delete=models.CASCADE, related_name='lines')
    batch        = models.OneToOneField(
        'ProductionBatch', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='program_line',
    )
    product_type = models.ForeignKey(
        ProductType, on_delete=models.PROTECT, related_name='program_lines',
    )

    # Programación (fechas reales). Nullable a nivel DB; el form las exige.
    start_date      = models.DateField(null=True, blank=True, verbose_name='Fecha inicio')
    end_date        = models.DateField(null=True, blank=True, verbose_name='Fecha final')
    pieces_per_hour = models.FloatField(null=True, blank=True, verbose_name='Piezas/hora')

    # Identificación (tal como aparece en el documento físico)
    item_code        = models.CharField(max_length=50, blank=True, verbose_name='Item')
    tube_description = models.CharField(max_length=300, verbose_name='Descripción tramo cortado')

    # Cantidades
    # pedido_quantity = piezas pequeñas pedidas por el cliente (= total a cortar normalmente)
    pedido_quantity   = models.IntegerField(verbose_name='Cantidad pedida (piezas)')
    total_quantity    = models.IntegerField(verbose_name='Total a cortar (piezas)')
    # tubos largos disponibles y cuántos cortes salen de cada uno
    tube_count        = models.IntegerField(null=True, blank=True, verbose_name='Tubos largos (cantidad)')
    sections_per_tube = models.IntegerField(null=True, blank=True, verbose_name='Tramos por tubo')
    tube_length_mm    = models.FloatField(null=True, blank=True, verbose_name='Tubo largo (mm)')

    # Sierra
    saw_type   = models.CharField(max_length=5, choices=SAW_CHOICES, verbose_name='Tipo sierra')
    saw_teeth  = models.IntegerField(null=True, blank=True, verbose_name='Número de dientes')
    rpm        = models.IntegerField(null=True, blank=True, verbose_name='RPM')

    # Avance — agrupa las dos velocidades disponibles para esta pieza
    advance_high = models.FloatField(null=True, blank=True, verbose_name='Avance High')
    advance_low  = models.FloatField(null=True, blank=True, verbose_name='Avance Low')

    # Comercial
    client    = models.CharField(max_length=200, verbose_name='Cliente')
    packaging = models.CharField(max_length=100, blank=True, verbose_name='Embalaje')
    notes     = models.TextField(blank=True)

    class Meta:
        ordering = ['program', 'id']

    def __str__(self):
        return f'{self.program} | {self.product_type.name}'

    def create_batch(self, user):
        """Crea y asocia el ProductionBatch de este renglón si todavía no existe."""
        if self.batch:
            return self.batch
        batch = ProductionBatch.objects.create(
            product_type=self.product_type,
            total_quantity=self.total_quantity,
            priority=self.product_type.default_priority,
            scheduled_date=self.start_date,
            notes=f'Generado desde {self.program}',
            created_by=user,
        )
        batch.create_process_records()
        self.batch = batch
        self.save(update_fields=['batch'])
        return batch


class ProcessRecord(models.Model):
    STATUS_CHOICES = [
        ('pending',    'Pendiente'),
        ('in_process', 'En proceso'),
        ('paused',     'Pausado (turno cerrado)'),
        ('finished',   'Terminado'),
    ]
    SHIFT_CHOICES = [('A','Turno A (06:00–14:00)'),('B','Turno B (14:00–22:00)'),('C','Turno C (22:00–06:00)')]

    batch        = models.ForeignKey(ProductionBatch, on_delete=models.CASCADE, related_name='records')
    process_type = models.CharField(max_length=10)
    sequence     = models.IntegerField(default=1)
    # Estos campos reflejan el ÚLTIMO turno (legacy / acceso rápido). El detalle real va en shift_entries.
    machine      = models.ForeignKey(Machine, on_delete=models.SET_NULL, null=True, blank=True, related_name='process_records')
    operator     = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='process_records')
    shift        = models.CharField(max_length=1, choices=SHIFT_CHOICES, blank=True)
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    qty_assigned = models.IntegerField()
    qty_done     = models.IntegerField(default=0)  # acumulado de todos los turnos (buenas + defectuosas)
    qty_defective= models.IntegerField(default=0)  # defectuosas que NO se han recuperado todavía
    qty_scrapped = models.IntegerField(default=0)  # defectuosas descartadas definitivamente (merma)
    started_at   = models.DateTimeField(null=True, blank=True)   # primer arranque
    finished_at  = models.DateTimeField(null=True, blank=True)   # cuando se completó qty_assigned
    signature    = models.TextField(blank=True)
    notes        = models.TextField(blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['batch', 'process_type']
        ordering = ['batch', 'sequence']

    def __str__(self):
        return f'{self.batch.batch_code} — {self.get_process_label()} [{self.get_status_display()}]'

    def get_process_label(self):
        return PROCESS_LABELS.get(self.process_type, self.process_type.title())

    @property
    def qty_good(self):
        """Piezas conformes que pueden pasar al siguiente proceso."""
        return max(0, self.qty_done - self.qty_defective)

    @property
    def qty_remaining(self):
        return max(0, self.qty_assigned - self.qty_done)

    @property
    def qty_available_for_next(self):
        """
        Piezas disponibles para que el SIGUIENTE proceso las consuma.
        Igual a qty_good si este proceso está finished/paused/in_process.
        """
        return self.qty_good

    @property
    def progress_pct(self):
        if self.qty_assigned == 0:
            return 0
        return int((self.qty_done / self.qty_assigned) * 100)

    @property
    def sections_per_tube(self):
        """Cuántos tramos de corte salen de un tubo largo (longitud original ÷ corte)."""
        pt  = self.batch.product_type
        ts  = pt.tube_spec if pt else None
        cut = pt.cut_length if pt else 0
        if not ts or not ts.original_length or not cut or cut <= 0:
            return 0
        import math
        return math.floor(ts.original_length / cut)

    @property
    def tubes_remaining(self):
        """
        Tubos largos que aún quedan en canasta para este lote, estimados a
        partir de lo ya cortado. Solo aplica al proceso de corte.
            tubes_remaining = tubos_recibidos − floor(qty_done / sections_per_tube)
        Retorna None si no aplica (no es corte, sin recepciones, o sin datos de corte).
        """
        if self.process_type != 'corte':
            return None
        spt = self.sections_per_tube
        if spt <= 0:
            return None
        from django.db.models import Sum
        agg = self.batch.material_receptions.aggregate(total=Sum('quantity'))
        received = agg['total'] or 0
        if received <= 0:
            return None
        import math
        consumed = math.floor(self.qty_done / spt)
        return max(0, received - consumed)

    @property
    def active_shift(self):
        """Turno actualmente en curso (sin finished_at), o None."""
        return self.shift_entries.filter(finished_at__isnull=True).first()

    # ── Operaciones ────────────────────────────────────────
    def start_shift(self, user, machine=None, shift=''):
        """Crea un nuevo turno de trabajo. Falla si ya hay uno activo."""
        from django.core.exceptions import ValidationError
        if self.status == 'finished':
            raise ValidationError('Este proceso ya está terminado.')
        if self.active_shift:
            raise ValidationError('Ya hay un turno activo en este proceso.')

        entry = ProcessShiftEntry.objects.create(
            process_record=self,
            operator=user,
            machine=machine,
            shift=shift,
            started_at=timezone.now(),
        )
        # Reflejo en campos legacy
        self.operator = user
        self.machine  = machine
        self.shift    = shift
        if not self.started_at:
            self.started_at = entry.started_at
        self.status = 'in_process'
        self.save(update_fields=['operator','machine','shift','started_at','status'])

        if self.batch.status == 'in_basket':
            self.batch.status = 'in_process'
            self.batch.save(update_fields=['status', 'updated_at'])
        return entry

    def end_shift(self, qty_done_this_shift, user, signature='', notes='', finalize=False,
                  qty_defective_this_shift=0):
        """
        Cierra el turno activo.
        - qty_done_this_shift: piezas producidas (buenas + defectuosas)
        - qty_defective_this_shift: cuántas de esas salieron defectuosas (default 0)
        Estado resultante:
          - Si total >= qty_assigned → finished
          - Si finalize=True → finished aunque falten unidades (merma de material)
          - Sino → paused
        """
        from django.core.exceptions import ValidationError
        from django.db.models import Sum
        active = self.active_shift
        if not active:
            raise ValidationError('No hay un turno activo en este proceso.')
        if qty_defective_this_shift < 0 or qty_defective_this_shift > qty_done_this_shift:
            raise ValidationError('La cantidad defectuosa no puede exceder lo producido.')

        active.qty_done      = qty_done_this_shift
        active.qty_defective = qty_defective_this_shift
        active.finished_at   = timezone.now()
        active.signature     = signature
        active.notes         = notes
        active.save()

        # Recalcular acumulados desde los shifts
        agg = self.shift_entries.aggregate(d=Sum('qty_done'), b=Sum('qty_defective'))
        self.qty_done      = agg['d'] or 0
        # Defectos pendientes = sum(defectivos en turnos) - sum(reworked+scrapped en reworks)
        rework_agg = self.rework_entries.aggregate(r=Sum('qty_reworked'), s=Sum('qty_scrapped'))
        resolved = (rework_agg['r'] or 0) + (rework_agg['s'] or 0)
        self.qty_defective = max(0, (agg['b'] or 0) - resolved)
        self.signature     = signature

        if self.qty_done >= self.qty_assigned or finalize:
            self.status      = 'finished'
            self.finished_at = active.finished_at
        else:
            self.status = 'paused'

        self.save(update_fields=['qty_done','qty_defective','signature','status','finished_at'])

        # Si el lote completó todos sus procesos → finished
        if self.status == 'finished' and not self.batch.records.exclude(status='finished').exists():
            self.batch.status = 'finished'
            self.batch.save(update_fields=['status', 'updated_at'])

        return active

    def process_rework(self, user, qty_reworked=0, qty_scrapped=0, notes=''):
        """
        Procesa parte del pool de defectuosos:
        - qty_reworked: vuelven al flujo (cuentan como buenas para el siguiente proceso)
        - qty_scrapped: descartadas como merma definitiva
        La suma no puede exceder el pool actual de defectuosos.
        """
        from django.core.exceptions import ValidationError
        total = qty_reworked + qty_scrapped
        if total <= 0:
            raise ValidationError('Indica cuántas se recuperaron y/o cuántas se descartaron.')
        if total > self.qty_defective:
            raise ValidationError(
                f'No puede procesarse más que el pool actual ({self.qty_defective} defectuosas).'
            )

        ReworkEntry.objects.create(
            process_record=self,
            operator=user,
            qty_reworked=qty_reworked,
            qty_scrapped=qty_scrapped,
            notes=notes,
        )

        # Reducir el pool de defectuosos
        self.qty_defective = max(0, self.qty_defective - total)
        # Las descartadas se contabilizan como scrap acumulado
        self.qty_scrapped += qty_scrapped
        self.save(update_fields=['qty_defective', 'qty_scrapped'])

    # ── Compatibilidad con código existente ────────────────
    def start(self, user, machine=None, shift=''):
        return self.start_shift(user, machine=machine, shift=shift)

    def finish(self, qty_done, user, signature='', notes=''):
        return self.end_shift(qty_done, user=user, signature=signature, notes=notes)


class ProcessShiftEntry(models.Model):
    """Cada vez que un operario abre un turno y lo cierra dentro de un ProcessRecord."""
    SHIFT_CHOICES = ProcessRecord.SHIFT_CHOICES

    process_record = models.ForeignKey(ProcessRecord, on_delete=models.CASCADE, related_name='shift_entries')
    operator       = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='shift_entries')
    machine        = models.ForeignKey(Machine, on_delete=models.SET_NULL, null=True, blank=True, related_name='shift_entries')
    shift          = models.CharField(max_length=1, choices=SHIFT_CHOICES, blank=True)
    qty_done       = models.IntegerField(default=0)        # piezas producidas en el turno (buenas + defectuosas)
    qty_defective  = models.IntegerField(default=0)        # cuántas de las producidas salieron defectuosas
    started_at     = models.DateTimeField()
    finished_at    = models.DateTimeField(null=True, blank=True)
    signature      = models.TextField(blank=True)
    notes          = models.TextField(blank=True)

    class Meta:
        ordering = ['process_record', 'started_at']

    def __str__(self):
        return f'{self.process_record} | {self.operator} ({self.qty_done})'


class ReworkEntry(models.Model):
    """
    Cada vez que se procesa un grupo de defectuosos de un ProcessRecord:
    parte se recupera (vuelve al flujo) y parte se descarta (merma definitiva).
    """
    process_record = models.ForeignKey(ProcessRecord, on_delete=models.CASCADE, related_name='rework_entries')
    operator       = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='rework_entries')
    qty_reworked   = models.IntegerField(default=0, verbose_name='Piezas recuperadas')
    qty_scrapped   = models.IntegerField(default=0, verbose_name='Piezas descartadas (merma)')
    notes          = models.TextField(blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.process_record} | rework {self.qty_reworked} / scrap {self.qty_scrapped}'
