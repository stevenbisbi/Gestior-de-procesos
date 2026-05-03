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
    outer_diameter  = models.FloatField(verbose_name='Diámetro/lado (mm)')
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
        ('in_basket','En canasta'),('in_process','En proceso'),
        ('finished','Terminado'),('dispatched','Despachado'),
    ]
    PRIORITY_CHOICES = [('alta','Alta'),('media','Media'),('baja','Baja')]

    batch_code      = models.CharField(max_length=20, unique=True, blank=True)
    product_type    = models.ForeignKey(ProductType, on_delete=models.PROTECT, related_name='batches')
    total_quantity  = models.IntegerField()
    priority        = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='media')
    scheduled_date  = models.DateField(null=True, blank=True)
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_basket')
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
        return prev and prev.status == 'finished'

    @property
    def progress_pct(self):
        total = self.records.count()
        if total == 0: return 0
        done = self.records.filter(status='finished').count()
        return int((done / total) * 100)


class ProcessRecord(models.Model):
    STATUS_CHOICES = [('pending','Pendiente'),('in_process','En proceso'),('finished','Terminado')]
    SHIFT_CHOICES = [('A','Turno A (06:00–14:00)'),('B','Turno B (14:00–22:00)'),('C','Turno C (22:00–06:00)')]

    batch        = models.ForeignKey(ProductionBatch, on_delete=models.CASCADE, related_name='records')
    process_type = models.CharField(max_length=10)
    sequence     = models.IntegerField(default=1)
    machine      = models.ForeignKey(Machine, on_delete=models.SET_NULL, null=True, blank=True, related_name='process_records')
    operator     = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='process_records')
    shift        = models.CharField(max_length=1, choices=SHIFT_CHOICES, blank=True)
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    qty_assigned = models.IntegerField()
    qty_done     = models.IntegerField(default=0)
    started_at   = models.DateTimeField(null=True, blank=True)
    finished_at  = models.DateTimeField(null=True, blank=True)
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

    def start(self, user, machine=None, shift=''):
        self.status = 'in_process'
        self.operator = user
        self.machine = machine
        self.shift = shift
        self.started_at = timezone.now()
        self.save()
        self.batch.status = 'in_process'
        self.batch.save(update_fields=['status', 'updated_at'])

    def finish(self, qty_done, user, signature='', notes=''):
        self.status = 'finished'
        self.qty_done = qty_done
        self.operator = user
        self.finished_at = timezone.now()
        self.signature = signature
        self.notes = notes
        self.save()
        if not self.batch.records.exclude(status='finished').exists():
            self.batch.status = 'finished'
            self.batch.save(update_fields=['status', 'updated_at'])
