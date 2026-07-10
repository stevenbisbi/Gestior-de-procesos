from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes, authentication_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, login, logout
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q

from .models import TubeSpec, ProductType, Machine, ProductionBatch, ProcessRecord, ProcessShiftEntry, CuttingProgram, CuttingProgramLine, TubeReception
from .serializers import (TubeSpecSerializer, ProductTypeSerializer, MachineSerializer,
                          ProductionBatchSerializer, BatchListSerializer,
                          ProcessRecordSerializer, UserMiniSerializer,
                          CuttingProgramSerializer, CuttingProgramListSerializer,
                          CuttingProgramLineSerializer, TubeReceptionSerializer)


# ─── Health check (público — usado por Render) ──────────

@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def health_check(request):
    return Response({'status': 'ok'})


# ─── Auth ────────────────────────────────────────────────

@api_view(['POST'])
@authentication_classes([])   # ← quita SessionAuthentication (que exige CSRF en POST)
@permission_classes([AllowAny])
def login_view(request):
    user = authenticate(username=request.data.get('username'),
                         password=request.data.get('password'))
    if not user:
        return Response({'detail': 'Credenciales incorrectas'}, status=401)
    token, _ = Token.objects.get_or_create(user=user)
    login(request, user)
    return Response({
        'token': token.key,
        'user': UserMiniSerializer(user).data,
        'is_supervisor': user.is_staff or user.groups.filter(name='Supervisor').exists(),
    })


@api_view(['POST'])
def logout_view(request):
    Token.objects.filter(user=request.user).delete()
    logout(request)
    return Response({'ok': True})


@api_view(['GET'])
def me_view(request):
    user = request.user
    machines = Machine.objects.filter(operators=user, is_active=True)
    return Response({
        'user': UserMiniSerializer(user).data,
        'is_supervisor': user.is_staff or user.groups.filter(name='Supervisor').exists(),
        'machines': MachineSerializer(machines, many=True).data,
        'process_types': list(machines.values_list('process_type', flat=True).distinct()),
    })


# ─── Catálogos ──────────────────────────────────────────

class TubeSpecViewSet(viewsets.ModelViewSet):
    queryset = TubeSpec.objects.all()
    serializer_class = TubeSpecSerializer


class ProductTypeViewSet(viewsets.ModelViewSet):
    queryset = ProductType.objects.select_related('tube_spec').all()
    serializer_class = ProductTypeSerializer


class MachineViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Machine.objects.filter(is_active=True).prefetch_related('operators')
    serializer_class = MachineSerializer


# ─── Lotes ──────────────────────────────────────────────

class ProductionBatchViewSet(viewsets.ModelViewSet):
    queryset = ProductionBatch.objects.select_related('product_type__tube_spec') \
                                       .prefetch_related('records__machine','records__operator')

    def get_serializer_class(self):
        return BatchListSerializer if self.action == 'list' else ProductionBatchSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # En LISTADOS: los lotes de un programa en BORRADOR no son trabajo
        # liberado a planta, así que no deben aparecer para recibir material,
        # en canasta ni en otros listados. (Los lotes sin programa —manuales— y
        # los de programas activos/cerrados sí.) En el detalle (get_object) no se
        # filtra, para que el supervisor pueda abrir el lote desde el programa.
        if self.action == 'list':
            qs = qs.exclude(program_line__program__status='draft')
        # Filtros de query params
        status_param = self.request.query_params.get('status')
        q = self.request.query_params.get('q')
        exclude_dispatched = self.request.query_params.get('exclude_dispatched')

        if exclude_dispatched in ('1','true','yes'):
            qs = qs.exclude(status='dispatched')
        if status_param:
            qs = qs.filter(status=status_param)
        if q:
            qs = qs.filter(
                Q(batch_code__icontains=q) |
                Q(product_type__name__icontains=q) |
                Q(product_type__tube_spec__outer_diameter__icontains=q)
            )
        return qs

    def perform_create(self, serializer):
        batch = serializer.save(created_by=self.request.user)
        batch.create_process_records()

    def perform_update(self, serializer):
        old_qty = serializer.instance.total_quantity
        batch = serializer.save()
        # Si el supervisor corrigió la cantidad, propagar a los procesos
        if batch.total_quantity != old_qty:
            batch.sync_records_qty()

    @action(detail=True, methods=['post'], url_path='adjust-tubes')
    def adjust_tubes(self, request, pk=None):
        """Corrige la cantidad de tubos largos recibidos del lote (crea un ajuste con la diferencia)."""
        batch = self.get_object()
        try:
            target = int(request.data.get('quantity'))
        except (TypeError, ValueError):
            return Response({'detail': 'Cantidad inválida.'}, status=400)
        if target < 0:
            return Response({'detail': 'La cantidad no puede ser negativa.'}, status=400)

        current = batch.tube_stock
        delta = target - current
        if delta != 0:
            tube_spec = batch.product_type.tube_spec
            TubeReception.objects.create(
                tube_spec=tube_spec, quantity=delta,
                delivered_by='Ajuste de conteo',
                notes=f'Ajuste manual: {current} → {target}',
                received_by=request.user, batch=batch,
            )
        return Response(ProductionBatchSerializer(batch).data)

    @action(detail=True, methods=['post'], url_path='receive')
    def receive_material(self, request, pk=None):
        """Cortador confirma recepción del material. Lote pasa de waiting_material → in_basket."""
        batch = self.get_object()
        if batch.status != 'waiting_material':
            return Response({'detail': 'Este lote no está esperando material.'}, status=400)
        line = getattr(batch, 'program_line', None)
        if line and line.program.status == 'draft':
            return Response({'detail': 'El programa de este lote aún no está activo.'}, status=400)
        tube_spec = None
        ts_id = request.data.get('tube_spec') or batch.product_type.tube_spec_id
        if ts_id:
            tube_spec = TubeSpec.objects.filter(pk=ts_id).first()
        try:
            batch.receive_material(
                user=request.user,
                tube_spec=tube_spec,
                quantity=int(request.data.get('quantity') or 0) or None,
                delivered_by=request.data.get('delivered_by', ''),
                notes=request.data.get('notes', ''),
            )
        except Exception as e:
            return Response({'detail': str(e)}, status=400)
        return Response(ProductionBatchSerializer(batch).data)

    @action(detail=True, methods=['post'], url_path='dispatch')
    def dispatch_batch(self, request, pk=None):
        """
        Despacha el lote.
        - Sin payload o con all=true → despacha todos los medios pendientes (o el lote completo
          si el producto no usa medios de manejo).
        - Con unit_ids=[...] → despacha solo esos medios (despacho parcial).
        """
        batch = self.get_object()
        dispatch_all = request.data.get('all') in (True, 'true', '1', 1) or not request.data.get('unit_ids')
        unit_ids = request.data.get('unit_ids') or []
        try:
            batch.dispatch_units(unit_ids=unit_ids, dispatch_all=dispatch_all)
        except Exception as e:
            return Response({'detail': str(e)}, status=400)
        return Response(ProductionBatchSerializer(batch).data)


# ─── Process Records ────────────────────────────────────

class ProcessRecordViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ProcessRecord.objects.select_related('batch__product_type__tube_spec','machine','operator')
    serializer_class = ProcessRecordSerializer

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Inicia (o reanuda) un turno de trabajo en el proceso."""
        record = self.get_object()
        if record.status == 'finished':
            return Response({'detail': 'El proceso ya está terminado.'}, status=400)
        if record.status == 'in_process':
            return Response({'detail': 'Ya hay un turno activo en este proceso.'}, status=400)
        if not record.batch.is_available_for_process(record.process_type):
            return Response({'detail': 'El proceso anterior no ha terminado.'}, status=400)

        machine_id = request.data.get('machine_id')
        if machine_id:
            machine = Machine.objects.filter(pk=machine_id).first()
        else:
            machine = Machine.objects.filter(
                operators=request.user, process_type=record.process_type, is_active=True
            ).first()

        try:
            record.start_shift(user=request.user, machine=machine, shift=request.data.get('shift', ''))
        except Exception as e:
            return Response({'detail': str(e)}, status=400)
        return Response(ProcessRecordSerializer(record).data)

    @action(detail=True, methods=['post'])
    def finish(self, request, pk=None):
        """Cierra el turno activo. Si no se completó la cantidad total, queda en 'paused' para otro operario."""
        record = self.get_object()
        if record.status != 'in_process':
            return Response({'detail': 'No hay turno activo en este proceso.'}, status=400)

        qty = int(request.data.get('qty_done', 0))
        qty_def = int(request.data.get('qty_defective', 0) or 0)
        finalize = request.data.get('finalize') in (True, 'true', '1', 1)
        remaining = record.qty_remaining
        if qty < 1 or qty > remaining:
            return Response(
                {'detail': f'Cantidad inválida. Debe ser entre 1 y {remaining} (restante).'},
                status=400,
            )
        if qty_def < 0 or qty_def > qty:
            return Response(
                {'detail': f'Defectuosas inválidas (entre 0 y {qty}).'},
                status=400,
            )
        try:
            record.end_shift(
                qty_done_this_shift=qty,
                user=request.user,
                signature=request.data.get('signature', ''),
                notes=request.data.get('notes', ''),
                finalize=finalize,
                qty_defective_this_shift=qty_def,
            )
        except Exception as e:
            return Response({'detail': str(e)}, status=400)

        # Si es CORTE, descontar los tubos largos consumidos de la canasta
        if record.process_type == 'corte':
            record.batch.consume_tubes_for_cut(qty, request.user)

        # Medios de manejo (estibas/cajas) reportados en este turno — solo proceso final
        packing = request.data.get('packing_units') or []
        if packing and record.process_type == record.batch.product_type.final_process:
            quantities = [int(q) for q in packing if int(q or 0) > 0]
            if quantities:
                record.batch.add_packing_units(request.user, quantities)

        return Response(ProcessRecordSerializer(record).data)

    @action(detail=True, methods=['post'])
    def rework(self, request, pk=None):
        """Procesa parte del pool de defectuosos: recupera y/o descarta."""
        record = self.get_object()
        try:
            record.process_rework(
                user=request.user,
                qty_reworked=int(request.data.get('qty_reworked', 0) or 0),
                qty_scrapped=int(request.data.get('qty_scrapped', 0) or 0),
                notes=request.data.get('notes', ''),
            )
        except Exception as e:
            return Response({'detail': str(e)}, status=400)
        return Response(ProcessRecordSerializer(record).data)


# ─── Programa de corte ──────────────────────────────────

class CuttingProgramViewSet(viewsets.ModelViewSet):
    queryset = CuttingProgram.objects.prefetch_related(
        'lines__product_type__tube_spec', 'lines__batch'
    ).select_related('created_by')

    def get_serializer_class(self):
        return CuttingProgramListSerializer if self.action == 'list' else CuttingProgramSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        program = self.get_object()
        program.activate()
        return Response(CuttingProgramSerializer(program).data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        program = self.get_object()
        program.status = 'closed'
        program.save(update_fields=['status', 'updated_at'])
        return Response(CuttingProgramSerializer(program).data)

    @action(detail=False, methods=['get'], url_path='active')
    def active_program(self, request):
        program = CuttingProgram.objects.filter(status='active').prefetch_related(
            'lines__product_type__tube_spec', 'lines__batch'
        ).select_related('created_by').first()
        if not program:
            return Response({'detail': 'No hay programa activo.'}, status=404)
        return Response(CuttingProgramSerializer(program).data)


class CuttingProgramLineViewSet(viewsets.ModelViewSet):
    queryset = CuttingProgramLine.objects.select_related(
        'program', 'product_type__tube_spec', 'batch'
    )
    serializer_class = CuttingProgramLineSerializer

    def perform_create(self, serializer):
        line = serializer.save()
        line.create_batch(self.request.user)

    def perform_update(self, serializer):
        line = serializer.save()
        # Si cambia total_quantity y ya tiene lote, actualiza el lote
        # y propaga la nueva cantidad a los procesos (incluso si ya iniciaron).
        if line.batch and line.batch.total_quantity != line.total_quantity:
            line.batch.total_quantity = line.total_quantity
            line.batch.save(update_fields=['total_quantity', 'updated_at'])
            line.batch.sync_records_qty()

    def perform_destroy(self, instance):
        # No permitir borrar si el lote ya está en proceso o terminado
        if instance.batch and instance.batch.status not in ('in_basket',):
            from rest_framework.exceptions import ValidationError
            raise ValidationError('No se puede eliminar: el lote ya inició producción.')
        instance.delete()


# ─── Canasta de tubería (recepciones) ───────────────────

class TubeReceptionViewSet(viewsets.ModelViewSet):
    """
    El cortador registra cada llegada de tubería desde almacén.
    GET  /tube-receptions/         lista (filtros: ?tube_spec=ID)
    POST /tube-receptions/         crear recepción
    GET  /tube-receptions/basket/  vista de canasta — totales por TubeSpec
    """
    queryset = TubeReception.objects.select_related('tube_spec', 'received_by').all()
    serializer_class = TubeReceptionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        tube_spec = self.request.query_params.get('tube_spec')
        if tube_spec:
            qs = qs.filter(tube_spec_id=tube_spec)
        return qs

    def perform_create(self, serializer):
        serializer.save(received_by=self.request.user)

    @action(detail=False, methods=['get'])
    def basket(self, request):
        """Devuelve total de tubos disponibles por especificación."""
        from django.db.models import Sum, Max
        rows = (TubeReception.objects
                .values('tube_spec')
                .annotate(total=Sum('quantity'), last_at=Max('received_at'))
                .order_by('-last_at'))
        tube_ids   = [r['tube_spec'] for r in rows]
        tube_specs = TubeSpec.objects.in_bulk(tube_ids)
        out = []
        for r in rows:
            ts = tube_specs.get(r['tube_spec'])
            if not ts:
                continue
            out.append({
                'tube_spec':      TubeSpecSerializer(ts).data,
                'total':          r['total'],
                'last_received':  r['last_at'],
            })
        return Response(out)

    @action(detail=False, methods=['post'], url_path='adjust-spec')
    def adjust_spec(self, request):
        """Ajusta el stock total de un tipo de tubo (supervisor). Crea una recepción con la diferencia."""
        from django.db.models import Sum
        ts_id = request.data.get('tube_spec_id')
        try:
            target = int(request.data.get('quantity'))
        except (TypeError, ValueError):
            return Response({'detail': 'Cantidad inválida.'}, status=400)
        if target < 0:
            return Response({'detail': 'La cantidad no puede ser negativa.'}, status=400)
        try:
            tube_spec = TubeSpec.objects.get(id=ts_id)
        except TubeSpec.DoesNotExist:
            return Response({'detail': 'Especificación no encontrada.'}, status=404)
        current = TubeReception.objects.filter(tube_spec=tube_spec).aggregate(t=Sum('quantity'))['t'] or 0
        delta = target - current
        if delta != 0:
            TubeReception.objects.create(
                tube_spec=tube_spec, quantity=delta,
                delivered_by='Ajuste de conteo',
                notes=f'Ajuste manual: {current} → {target}',
                received_by=request.user,
            )
        return Response({'tube_spec_id': ts_id, 'new_total': target})


# ─── Dashboards ─────────────────────────────────────────

@api_view(['GET'])
def supervisor_dashboard(request):
    # Excluye despachados y lotes de programas en borrador (no liberados a planta).
    active = (ProductionBatch.objects
              .exclude(status='dispatched')
              .exclude(program_line__program__status='draft'))
    process_stats = {}
    for pt in ['corte', 'chaflan', 'moleteo', 'curvado']:
        process_stats[pt] = {
            'in_process': ProcessRecord.objects.filter(process_type=pt, status='in_process').count(),
            'paused':     ProcessRecord.objects.filter(process_type=pt, status='paused').count(),
            'finished':   ProcessRecord.objects.filter(process_type=pt, status='finished').count(),
            'pending':    ProcessRecord.objects.filter(process_type=pt, status='pending').count(),
        }
    # Lotes con defectos pendientes (qty_defective > 0 en al menos un proceso)
    batches_with_defects = active.filter(records__qty_defective__gt=0).distinct()
    from django.db.models import Sum
    defect_agg = ProcessRecord.objects.filter(
        batch__in=active, qty_defective__gt=0,
    ).aggregate(total=Sum('qty_defective'))

    # Canasta real: inventario de tubos largos por tipo (independiente del lote).
    # Cuenta los TubeSpec con stock > 0 y el total físico de tubos disponibles.
    basket_rows = (TubeReception.objects
                   .values('tube_spec')
                   .annotate(total=Sum('quantity'))
                   .filter(total__gt=0))
    basket_specs = len(basket_rows)
    basket_tubes = sum(r['total'] for r in basket_rows)

    return Response({
        'process_stats': process_stats,
        'waiting_material': active.filter(status='waiting_material').count(),
        'in_basket':        active.filter(status='in_basket').count(),
        'basket_specs':     basket_specs,
        'basket_tubes':     basket_tubes,
        'in_process':       active.filter(status='in_process').count(),
        'finished':         active.filter(status='finished').count(),
        'with_defects':     batches_with_defects.count(),
        'defective_qty':    defect_agg['total'] or 0,
        'total':            active.count(),
    })


@api_view(['GET'])
def machines_status(request):
    """Estado en tiempo real de todas las máquinas activas de la planta."""
    machines = Machine.objects.filter(is_active=True).prefetch_related('operators')
    out = []
    for m in machines:
        # Turno actualmente abierto en esta máquina
        active = (ProcessShiftEntry.objects
                  .filter(machine=m, finished_at__isnull=True)
                  .select_related('process_record__batch__product_type__tube_spec', 'operator')
                  .first())
        # Última actividad cerrada
        last = (ProcessShiftEntry.objects
                .filter(machine=m, finished_at__isnull=False)
                .select_related('process_record__batch__product_type', 'operator')
                .order_by('-finished_at')
                .first())
        # Procesos disponibles para esta máquina (pendientes o pausados).
        # waiting_material cuenta si la canasta ya tiene tubos del tipo
        # (is_available_for_process decide); borradores de programa no.
        candidate_records = ProcessRecord.objects.filter(
            process_type=m.process_type,
            status__in=['pending', 'paused'],
            batch__status__in=['waiting_material', 'in_basket', 'in_process'],
        ).exclude(batch__program_line__program__status='draft') \
         .select_related('batch')
        queue = [r for r in candidate_records if r.batch.is_available_for_process(r.process_type)]

        item = {
            'machine': MachineSerializer(m).data,
            'state':   'active' if active else 'idle',
            'active':  None,
            'last_activity': None,
            'queue_count': len(queue),
            'queue_pending': sum(1 for r in queue if r.status == 'pending'),
            'queue_paused':  sum(1 for r in queue if r.status == 'paused'),
        }

        if active:
            rec = active.process_record
            item['active'] = {
                'shift_entry_id': active.id,
                'batch_id':       rec.batch_id,
                'batch_code':     rec.batch.batch_code,
                'product_name':   rec.batch.product_type.name,
                'tube_label':     str(rec.batch.product_type.tube_spec) if rec.batch.product_type.tube_spec else '',
                'process_type':   rec.process_type,
                'process_label':  rec.get_process_label(),
                'operator':       UserMiniSerializer(active.operator).data if active.operator else None,
                'shift':          active.shift,
                'shift_display':  active.get_shift_display(),
                'started_at':     active.started_at,
                'qty_assigned':   rec.qty_assigned,
                'qty_done':       rec.qty_done,
                'qty_remaining':  rec.qty_remaining,
                'progress_pct':   rec.progress_pct,
            }

        if last:
            item['last_activity'] = {
                'batch_id':     last.process_record.batch_id,
                'batch_code':   last.process_record.batch.batch_code,
                'product_name': last.process_record.batch.product_type.name,
                'operator':     UserMiniSerializer(last.operator).data if last.operator else None,
                'finished_at':  last.finished_at,
                'qty_done':     last.qty_done,
            }

        out.append(item)
    return Response(out)


@api_view(['GET'])
def operator_tasks(request):
    machines = Machine.objects.filter(operators=request.user, is_active=True)
    process_types = list(machines.values_list('process_type', flat=True).distinct())

    # waiting_material se incluye porque el corte puede arrancar si la canasta
    # (pila compartida) ya tiene tubos del tipo — is_available_for_process decide.
    # Se excluyen los lotes de programas en borrador (no liberados a planta).
    available = ProcessRecord.objects.filter(
        process_type__in=process_types,
        status__in=['pending', 'in_process', 'paused'],
        batch__status__in=['waiting_material', 'in_basket', 'in_process']
    ).exclude(batch__program_line__program__status='draft') \
     .select_related('batch__product_type__tube_spec', 'machine')

    # "Mis activos": turnos que YO tengo abiertos en este momento
    my_active   = available.filter(status='in_process', operator=request.user)
    # "Disponibles": pendientes nuevos + pausados que esperan a que alguien continúe
    pending_ids = [r.id for r in available.filter(status__in=['pending', 'paused'])
                   if r.batch.is_available_for_process(r.process_type)]
    pending     = available.filter(id__in=pending_ids)

    return Response({
        'machines': MachineSerializer(machines, many=True).data,
        'process_types': process_types,
        'my_active': ProcessRecordSerializer(my_active, many=True).data,
        'pending': ProcessRecordSerializer(pending, many=True).data,
    })
