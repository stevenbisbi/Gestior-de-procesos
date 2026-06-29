from rest_framework import serializers
from production.serializers import UserMiniSerializer
from .models import QualityCheck, DimensionalLog


class QualityCheckSerializer(serializers.ModelSerializer):
    has_nonconformity = serializers.BooleanField(read_only=True)
    created_by_data   = UserMiniSerializer(source='created_by', read_only=True)
    batch_code        = serializers.CharField(source='process_record.batch.batch_code', read_only=True)
    product_name      = serializers.CharField(source='process_record.batch.product_type.name', read_only=True)
    process_label     = serializers.SerializerMethodField()
    process_type      = serializers.CharField(source='process_record.process_type', read_only=True)

    class Meta:
        model = QualityCheck
        fields = '__all__'
        read_only_fields = ['process_record','created_by','created_at','updated_at']

    def get_process_label(self, obj):
        return obj.process_record.get_process_label()


class DimensionalLogSerializer(serializers.ModelSerializer):
    operator_data = UserMiniSerializer(source='operator', read_only=True)
    result_display = serializers.CharField(source='get_result_display', read_only=True)

    class Meta:
        model  = DimensionalLog
        fields = '__all__'
        read_only_fields = ['process_record','operator','logged_at']
