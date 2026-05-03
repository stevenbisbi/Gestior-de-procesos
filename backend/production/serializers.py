from rest_framework import serializers
from django.contrib.auth.models import User
from .models import TubeSpec, ProductType, Machine, ProductionBatch, ProcessRecord


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


class ProcessRecordSerializer(serializers.ModelSerializer):
    process_label = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    operator_data = UserMiniSerializer(source='operator', read_only=True)
    machine_data  = MachineSerializer(source='machine', read_only=True)
    has_quality_check = serializers.SerializerMethodField()

    class Meta:
        model = ProcessRecord
        fields = ['id','batch','process_type','process_label','sequence','machine','machine_data',
                  'operator','operator_data','shift','status','status_display','qty_assigned',
                  'qty_done','started_at','finished_at','notes','signature','has_quality_check']
        read_only_fields = ['signature']

    def get_process_label(self, obj):
        return obj.get_process_label()

    def get_has_quality_check(self, obj):
        return hasattr(obj, 'quality_check')


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
        return {'process_type': rec.process_type, 'label': rec.get_process_label(),
                'status': rec.status} if rec else None

    def get_process_route(self, obj):
        return [{'process_type': r.process_type, 'status': r.status, 'sequence': r.sequence}
                for r in obj.records.order_by('sequence')]
