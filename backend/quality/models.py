from django.db import models
from django.contrib.auth.models import User


class QualityCheck(models.Model):
    process_record = models.OneToOneField(
        'production.ProcessRecord', on_delete=models.CASCADE,
        related_name='quality_check'
    )

    # Datos generales
    date  = models.DateField()
    SHIFT = [('T1','T1'),('T2','T2'),('T3','T3'),('T5','T5')]
    shift = models.CharField(max_length=4, choices=SHIFT)
    client     = models.CharField(max_length=200)
    item_tramo = models.CharField(max_length=200)
    moto       = models.CharField(max_length=200)

    # Parámetros iniciales
    YN = [('si','Sí'),('no','No'),('otras','Otras')]
    dimensions_ok = models.CharField(max_length=10, choices=YN)
    LAMINA = [('cr','CR'),('gv','GV'),('hr','HR'),('cr_est','CR EST'),('hr_est','HR EST'),('otras','Otras')]
    sheet_type = models.CharField(max_length=10, choices=LAMINA)
    CONF = [('si','Sí'),('no','No')]
    appearance_ok = models.CharField(max_length=5, choices=CONF)
    saw_type_ref = models.CharField(max_length=100, blank=True, default='NA')
    rpm_ref      = models.CharField(max_length=50, blank=True, default='NA')

    # Verificaciones
    VER = [('verificado','Verificado'),('no_aplica','No Aplica')]
    jaw_pressure = models.CharField(max_length=20, choices=VER)
    CUT = [('conforme','Conforme'),('no_conforme','No Conforme')]
    cut_appearance = models.CharField(max_length=20, choices=CUT)
    knurling_distance = models.CharField(max_length=100, blank=True, default='NA')
    TRIPLE = [('conforme','Conforme'),('no_conforme','No Conforme'),('no_aplica','No Aplica')]
    double_knurling_free = models.CharField(max_length=20, choices=TRIPLE)

    # 3 primeras muestras
    sample_1     = models.CharField(max_length=50)
    sample_2     = models.CharField(max_length=50)
    sample_3     = models.CharField(max_length=50)
    observations = models.TextField(blank=True)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'QC — {self.process_record.batch.batch_code}'

    @property
    def has_nonconformity(self):
        return any([
            self.dimensions_ok == 'no',
            self.appearance_ok == 'no',
            self.cut_appearance == 'no_conforme',
            self.double_knurling_free == 'no_conforme',
        ])


class DimensionalLog(models.Model):
    process_record = models.ForeignKey(
        'production.ProcessRecord', on_delete=models.CASCADE,
        related_name='dimensional_logs'
    )
    piece_number = models.IntegerField()
    measure_label_1 = models.CharField(max_length=60, default='Medida 1')
    measure_1       = models.CharField(max_length=30)
    measure_label_2 = models.CharField(max_length=60, blank=True, default='')
    measure_2       = models.CharField(max_length=30, blank=True)
    measure_label_3 = models.CharField(max_length=60, blank=True, default='')
    measure_3       = models.CharField(max_length=30, blank=True)
    RESULT = [('conforme','Conforme'),('no_conforme','No Conforme')]
    result    = models.CharField(max_length=20, choices=RESULT)
    notes     = models.TextField(blank=True)
    operator  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    logged_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['process_record', 'piece_number']

    def __str__(self):
        return f'{self.process_record.batch.batch_code} | Pieza ~{self.piece_number}'
