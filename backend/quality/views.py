from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from production.models import ProcessRecord, ProcessShiftEntry
from .models import QualityCheck, DimensionalLog
from .serializers import QualityCheckSerializer, DimensionalLogSerializer


class QualityCheckViewSet(viewsets.ModelViewSet):
    queryset = QualityCheck.objects.select_related(
        'process_record__batch__product_type', 'process_record__machine',
        'shift_entry__operator', 'created_by'
    )
    serializer_class = QualityCheckSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        record_pk = self.request.query_params.get('record')
        if record_pk:
            qs = qs.filter(process_record_id=record_pk)
        shift_pk = self.request.query_params.get('shift_entry')
        if shift_pk:
            qs = qs.filter(shift_entry_id=shift_pk)
        only_nc = self.request.query_params.get('only_nc')
        if only_nc in ('1','true','yes'):
            qs = [q for q in qs if q.has_nonconformity]
            return qs
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        if isinstance(qs, list):  # only_nc filter result
            ser = self.get_serializer(qs, many=True)
            return Response(ser.data)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        """Crea la puesta a punto del TURNO. Requiere shift_entry."""
        se_id = request.data.get('shift_entry')
        if not se_id:
            return Response({'detail': 'Falta el turno (shift_entry).'}, status=400)
        shift_entry = get_object_or_404(ProcessShiftEntry, pk=se_id)
        if hasattr(shift_entry, 'quality_check'):
            return Response({'detail': 'Este turno ya tiene control de calidad.'}, status=400)
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(process_record=shift_entry.process_record,
                 shift_entry=shift_entry, created_by=request.user)
        return Response(ser.data, status=201)


class DimensionalLogViewSet(viewsets.ModelViewSet):
    queryset = DimensionalLog.objects.select_related('process_record__batch','operator')
    serializer_class = DimensionalLogSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        record_pk = self.request.query_params.get('record')
        if record_pk:
            qs = qs.filter(process_record_id=record_pk).order_by('piece_number')
        return qs

    def create(self, request, *args, **kwargs):
        record = get_object_or_404(ProcessRecord, pk=request.data.get('process_record'))
        if record.status != 'in_process':
            return Response({'detail': 'El proceso debe estar activo para registrar mediciones.'}, status=400)
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(process_record=record, operator=request.user)
        return Response(ser.data, status=201)


@api_view(['GET'])
def supervisor_quality_report(request):
    checks = QualityCheck.objects.select_related(
        'process_record__batch__product_type','process_record__machine',
        'shift_entry__operator','created_by'
    ).order_by('-created_at')
    # Filtros por fecha
    date     = request.query_params.get('date')      # fecha exacta
    date_from = request.query_params.get('from')
    date_to   = request.query_params.get('to')
    if date:
        checks = checks.filter(date=date)
    if date_from:
        checks = checks.filter(date__gte=date_from)
    if date_to:
        checks = checks.filter(date__lte=date_to)
    checks = checks[:200]
    data = QualityCheckSerializer(checks, many=True).data
    nc = [c for c in data if c.get('has_nonconformity')]
    return Response({'checks': data, 'nc_checks': nc, 'total': len(data), 'nc_total': len(nc)})
