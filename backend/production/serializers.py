from rest_framework import serializers
from django.contrib.auth.models import User
from .models import TubeSpec, ProductType, Machine, ProductionBatch, ProcessRecord, ProcessShiftEntry, CuttingProgram, CuttingProgramLine, TubeReception


class UserMiniSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'is_staff']
    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class TubeSpecSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField()
    shape_display = serializers.CharField(source='get_shape_display', read_only=True)
    material_display = serializers.CharField(source='get_material_display', read_only=True)

    class Meta:
        model = TubeSpec
        fields = '__all__'
    def get_label(self, obj):
        return str(obj)


class TubeReceptionSerializer(serializers.ModelSerializer):
    tube_spec_data   = TubeSpecSerializer(source='tube_spec', read_only=True)
    received_by_data = UserMiniSerializer(source='received_by', read_only=True)

    class Meta:
        model  = TubeReception
        fields = '__all__'
        read_only_fields = ['received_by', 'received_at']


class ProductTypeSerializer(serializers.ModelSerializer):
    tube_spec_data = TubeSpecSerializer(source='tube_spec', read_only=True)
    process_route  = serializers.SerializerMethodField()

    class Meta:
        model = ProductType
        fields = '__all__'
    def get_process_route(self, obj):
        return obj.get_process_route()


class MachineSerializer(serializers.ModelSerializer):
    process_label = serializers.CharField(source='get_process_type_display', read_only=True)
    operators_data = UserMiniSerializer(source='operators', many=True, read_only=True)

    class Meta:
        model = Machine
        fields = '__all__'


class ProcessShiftEntrySerializer(serializers.ModelSerializer):
    operator_data  = UserMiniSerializer(source='operator', read_only=True)
    machine_data   = MachineSerializer(source='machine', read_only=True)
    shift_display  = serializers.CharField(source='get_shift_display', read_only=True)

    class Meta:
        model  = ProcessShiftEntry
        fields = ['id', 'process_record', 'operator', 'operator_data', 'machine', 'machine_data',
                  'shift', 'shift_display', 'qty_done', 'started_at', 'finished_at',
                  'signature', 'notes']


class ProcessRecordSerializer(serializers.ModelSerializer):
    process_label  = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    operator_data  = UserMiniSerializer(source='operator', read_only=True)
    machine_data   = MachineSerializer(source='machine', read_only=True)
    has_quality_check = serializers.SerializerMethodField()
    qty_remaining  = serializers.IntegerField(read_only=True)
    progress_pct   = serializers.IntegerField(read_only=True)
    shift_entries  = ProcessShiftEntrySerializer(many=True, read_only=True)
    active_shift_operator = serializers.SerializerMethodField()
    # Datos del lote para evitar fetchs extra en frontend
    batch_code             = serializers.CharField(source='batch.batch_code',     read_only=True)
    batch_priority         = serializers.CharField(source='batch.priority',        read_only=True)
    batch_priority_display = serializers.CharField(source='batch.get_priority_display', read_only=True)
    product_name           = serializers.CharField(source='batch.product_type.name', read_only=True)

    class Meta:
        model = ProcessRecord
        fields = ['id','batch','batch_code','batch_priority','batch_priority_display','product_name',
                  'process_type','process_label','sequence','machine','machine_data',
                  'operator','operator_data','shift','status','status_display','qty_assigned',
                  'qty_done','qty_remaining','progress_pct','started_at','finished_at',
                  'notes','signature','has_quality_check','shift_entries','active_shift_operator']
        read_only_fields = ['signature']

    def get_process_label(self, obj):
        return obj.get_process_label()

    def get_has_quality_check(self, obj):
        return hasattr(obj, 'quality_check')

    def get_active_shift_operator(self, obj):
        active = obj.active_shift
        if active and active.operator:
            return UserMiniSerializer(active.operator).data
        return None


class ProductionBatchSerializer(serializers.ModelSerializer):
    product_type_data = ProductTypeSerializer(source='product_type', read_only=True)
    records           = ProcessRecordSerializer(many=True, read_only=True)
    progress_pct      = serializers.IntegerField(read_only=True)
    status_display    = serializers.CharField(source='get_status_display', read_only=True)
    priority_display  = serializers.CharField(source='get_priority_display', read_only=True)
    created_by_data   = UserMiniSerializer(source='created_by', read_only=True)

    class Meta:
        model  = ProductionBatch
        fields = ['id','batch_code','product_type','product_type_data','total_quantity',
                  'priority','priority_display','scheduled_date','status','status_display',
                  'notes','progress_pct','records','created_by','created_by_data',
                  'created_at','updated_at','dispatched_at']
        read_only_fields = ['batch_code','status','dispatched_at']


class BatchListSerializer(serializers.ModelSerializer):
    """Versión liviana sin records anidados — para listas largas."""
    product_name      = serializers.CharField(source='product_type.name', read_only=True)
    tube_label        = serializers.CharField(source='product_type.tube_spec', read_only=True)
    cut_length        = serializers.FloatField(source='product_type.cut_length', read_only=True)
    progress_pct      = serializers.IntegerField(read_only=True)
    status_display    = serializers.CharField(source='get_status_display', read_only=True)
    priority_display  = serializers.CharField(source='get_priority_display', read_only=True)
    current_process   = serializers.SerializerMethodField()
    process_route     = serializers.SerializerMethodField()

    class Meta:
        model  = ProductionBatch
        fields = ['id','batch_code','product_name','tube_label','cut_length',
                  'total_quantity','priority','priority_display','scheduled_date',
                  'status','status_display','progress_pct','current_process',
                  'process_route','created_at']

    def get_current_process(self, obj):
        rec = obj.records.exclude(status='finished').order_by('sequence').first()
        if not rec:
            return None
        active = rec.active_shift
        return {
            'process_type':  rec.process_type,
            'label':         rec.get_process_label(),
            'status':        rec.status,
            'qty_done':      rec.qty_done,
            'qty_assigned':  rec.qty_assigned,
            'qty_remaining': rec.qty_remaining,
            'progress_pct':  rec.progress_pct,
            'operator':      (active.operator.get_full_name() or active.operator.username)
                              if active and active.operator else
                              (rec.operator.get_full_name() or rec.operator.username)
                              if rec.operator else None,
        }

    def get_process_route(self, obj):
        return [{
            'process_type': r.process_type, 'status': r.status, 'sequence': r.sequence,
            'qty_done': r.qty_done, 'qty_assigned': r.qty_assigned,
            'progress_pct': r.progress_pct,
        } for r in obj.records.order_by('sequence')]


# ── Programa de corte ────────────────────────────────────────────────────────

class CuttingProgramLineSerializer(serializers.ModelSerializer):
    product_type_data  = ProductTypeSerializer(source='product_type', read_only=True)
    saw_type_display   = serializers.CharField(source='get_saw_type_display',   read_only=True)
    speed_range_display= serializers.CharField(source='get_speed_range_display', read_only=True)
    batch_code   = serializers.SerializerMethodField()
    batch_status = serializers.SerializerMethodField()
    batch_id     = serializers.SerializerMethodField()

    class Meta:
        model  = CuttingProgramLine
        fields = '__all__'

    def get_batch_code(self, obj):
        return obj.batch.batch_code if obj.batch else None

    def get_batch_status(self, obj):
        return obj.batch.status if obj.batch else None

    def get_batch_id(self, obj):
        return obj.batch_id


class CuttingProgramSerializer(serializers.ModelSerializer):
    lines           = CuttingProgramLineSerializer(many=True, read_only=True)
    created_by_data = UserMiniSerializer(source='created_by', read_only=True)
    status_display  = serializers.CharField(source='get_status_display', read_only=True)
    month_display   = serializers.SerializerMethodField()

    class Meta:
        model  = CuttingProgram
        fields = '__all__'

    def get_month_display(self, obj):
        MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
        return f'{MONTHS[obj.month.month - 1]} {obj.month.year}'


class CuttingProgramListSerializer(serializers.ModelSerializer):
    created_by_data = UserMiniSerializer(source='created_by', read_only=True)
    status_display  = serializers.CharField(source='get_status_display', read_only=True)
    month_display   = serializers.SerializerMethodField()
    line_count      = serializers.IntegerField(source='lines.count', read_only=True)

    class Meta:
        model  = CuttingProgram
        fields = ['id', 'month', 'month_display', 'version', 'status', 'status_display',
                  'notes', 'line_count', 'created_by_data', 'created_at']

    def get_month_display(self, obj):
        MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
        return f'{MONTHS[obj.month.month - 1]} {obj.month.year}'
