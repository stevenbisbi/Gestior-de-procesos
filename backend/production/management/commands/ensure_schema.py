"""
Auto-reparación de esquema para correr en cada deploy (después de `migrate`).

Contexto: en algún momento la base de datos de producción quedó con la
migración `0007` registrada como aplicada, pero SIN las columnas/tabla que
esa migración debía crear (estado inconsistente). Un `migrate` normal no lo
detecta porque cree que ya está aplicada, así que la API que serializa
`ProcessRecord` (recibir material, tareas del operario) revienta con
errores tipo "column qty_defective does not exist".

Este comando es idempotente: revisa el esquema real contra el modelo y crea
SOLO lo que falte, usando el generador de Django (schema_editor) para que el
SQL coincida exactamente con los modelos en cualquier backend (Postgres/SQLite).
Si no falta nada, no hace nada.
"""

from django.core.management.base import BaseCommand
from django.db import connection
from django.db.migrations.recorder import MigrationRecorder

from production.models import ProcessRecord, ProcessShiftEntry, ReworkEntry

MIGRATION_0007 = ('production', '0007_processrecord_qty_defective_and_more')


class Command(BaseCommand):
    help = 'Verifica y repara el esquema de la migración 0007 si quedó inconsistente.'

    def _columns(self, table):
        with connection.cursor() as cursor:
            return {c.name for c in connection.introspection.get_table_description(cursor, table)}

    def _tables(self):
        return set(connection.introspection.table_names())

    def handle(self, *args, **options):
        repaired = []

        pr_cols = self._columns('production_processrecord')
        se_cols = self._columns('production_processshiftentry')
        tables  = self._tables()

        with connection.schema_editor() as editor:
            if 'qty_defective' not in pr_cols:
                editor.add_field(ProcessRecord, ProcessRecord._meta.get_field('qty_defective'))
                repaired.append('ProcessRecord.qty_defective')
            if 'qty_scrapped' not in pr_cols:
                editor.add_field(ProcessRecord, ProcessRecord._meta.get_field('qty_scrapped'))
                repaired.append('ProcessRecord.qty_scrapped')
            if 'qty_defective' not in se_cols:
                editor.add_field(ProcessShiftEntry, ProcessShiftEntry._meta.get_field('qty_defective'))
                repaired.append('ProcessShiftEntry.qty_defective')
            if 'production_reworkentry' not in tables:
                editor.create_model(ReworkEntry)
                repaired.append('tabla ReworkEntry')

        if repaired:
            self.stdout.write(self.style.WARNING(
                'Esquema inconsistente detectado — reparado: ' + ', '.join(repaired)
            ))
        else:
            self.stdout.write(self.style.SUCCESS('Esquema OK — nada que reparar.'))

        # Asegurar que Django registre 0007 como aplicada (sin volver a tocar el esquema).
        recorder = MigrationRecorder(connection)
        if MIGRATION_0007 not in recorder.applied_migrations():
            recorder.record_applied(*MIGRATION_0007)
            self.stdout.write(self.style.SUCCESS('Migración 0007 marcada como aplicada.'))
