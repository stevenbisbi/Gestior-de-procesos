"""
Repara qty_assigned y el estado de todos los procesos de todos los lotes.

Recalcula la cadena completa (cada proceso recibe las piezas buenas del
anterior) usando ProductionBatch.sync_records_qty(). Es idempotente: si todo
ya está consistente, no cambia nada.

Sirve para sanear datos que quedaron mal por el bug donde un proceso aguas
abajo se marcaba 'Terminado' con 0 piezas (qty_assigned=0 → 0>=0 → finished)
antes de que el proceso anterior le entregara material.

Uso:
    python manage.py repair_status
"""

from django.core.management.base import BaseCommand
from production.models import ProductionBatch


class Command(BaseCommand):
    help = 'Recalcula qty_assigned y estado de todos los procesos de cada lote.'

    def handle(self, *args, **options):
        batches = ProductionBatch.objects.all()
        total = batches.count()
        self.stdout.write(f'Recalculando {total} lotes…')
        for b in batches:
            b.sync_records_qty()
        self.stdout.write(self.style.SUCCESS(f'✓ {total} lotes recalculados.'))
