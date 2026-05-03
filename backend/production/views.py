from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, login, logout
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q

from .models import TubeSpec, ProductType, Machine, ProductionBatch, ProcessRecord
from .serializers import (TubeSpecSerializer, ProductTypeSerializer, MachineSerializer,
                          ProductionBatchSerializer, BatchListSerializer,
                          ProcessRecordSerializer, UserMiniSerializer)


# ─── Auth ────────────────────────────────────────────────

@api_view(['POST'])
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

    @action(detail=True, methods=['post'], url_path='dispatch')
    def dispatch_batch(self, request, pk=None):
        batch = self.get_object()
        if batch.status != 'finished':
            return Response({'detail': 'El lote debe estar terminado para despachar.'}, status=400)
        batch.status = 'dispatched'
        batch.dispatched_at = timezone.now()
        batch.save()
        return Response(ProductionBatchSerializer(batch).data)


# ─── Process Records ────────────────────────────────────

class ProcessRecordViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ProcessRecord.objects.select_related('batch__product_type__tube_spec','machine','operator')
    serializer_class = ProcessRecordSerializer

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        record = self.get_object()
        if record.status != 'pending':
            return Response({'detail': 'El proceso no está pendiente.'}, status=400)
        if not record.batch.is_available_for_process(record.process_type):
            return Response({'detail': 'El proceso anterior no ha terminado.'}, status=400)

        machine_id = request.data.get('machine_id')
        machine = None
        if machine_id:
            machine = Machine.objects.filter(pk=machine_id).first()
        else:
            machine = Machine.objects.filter(
                operators=request.user, process_type=record.process_type, is_active=True
            ).first()

        record.start(user=request.user, machine=machine, shift=request.data.get('shift', ''))
        return Response(ProcessRecordSerializer(record).data)

    @action(detail=True, methods=['post'])
    def finish(self, request, pk=None):
        record = self.get_object()
        if record.status != 'in_process':
            return Response({'detail': 'El proceso no está activo.'}, status=400)
        qty = int(request.data.get('qty_done', 0))
        if qty < 1 or qty > record.qty_assigned:
            return Response({'detail': f'Cantidad inválida (1-{record.qty_assigned}).'}, status=400)
        record.finish(qty_done=qty, user=request.user,
                      signature=request.data.get('signature', ''),
                      notes=request.data.get('notes', ''))
        return Response(ProcessRecordSerializer(record).data)


# ─── Dashboards ─────────────────────────────────────────

@api_view(['GET'])
def supervisor_dashboard(request):
    active = ProductionBatch.objects.exclude(status='dispatched')
    process_stats = {}
    for pt in ['corte', 'chaflan', 'moleteo', 'curvado']:
        process_stats[pt] = {
            'in_process': ProcessRecord.objects.filter(process_type=pt, status='in_process').count(),
            'finished':   ProcessRecord.objects.filter(process_type=pt, status='finished').count(),
            'pending':    ProcessRecord.objects.filter(process_type=pt, status='pending').count(),
        }
    return Response({
        'process_stats': process_stats,
        'in_basket':  active.filter(status='in_basket').count(),
        'in_process': active.filter(status='in_process').count(),
        'finished':   active.filter(status='finished').count(),
        'total':      active.count(),
    })


@api_view(['GET'])
def operator_tasks(request):
    machines = Machine.objects.filter(operators=request.user, is_active=True)
    process_types = list(machines.values_list('process_type', flat=True).distinct())

    available = ProcessRecord.objects.filter(
        process_type__in=process_types,
        status__in=['pending', 'in_process'],
        batch__status__in=['in_basket', 'in_process']
    ).select_related('batch__product_type__tube_spec', 'machine')

    my_active   = available.filter(status='in_process', operator=request.user)
    pending_ids = [r.id for r in available.filter(status='pending')
                   if r.batch.is_available_for_process(r.process_type)]
    pending     = available.filter(id__in=pending_ids)

    return Response({
        'machines': MachineSerializer(machines, many=True).data,
        'process_types': process_types,
        'my_active': ProcessRecordSerializer(my_active, many=True).data,
        'pending': ProcessRecordSerializer(pending, many=True).data,
    })
