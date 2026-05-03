from django.contrib import admin
from django.utils.html import format_html
from .models import QualityCheck, DimensionalLog


@admin.register(QualityCheck)
class QualityCheckAdmin(admin.ModelAdmin):
    list_display = ['__str__','date','shift','client','status_badge','created_by','created_at']
    list_filter  = ['dimensions_ok','cut_appearance','appearance_ok']
    search_fields = ['process_record__batch__batch_code','client']

    def status_badge(self, obj):
        if obj.has_nonconformity:
            return format_html('<span style="color:red;font-weight:bold">⚠️ NC</span>')
        return format_html('<span style="color:green">✅ OK</span>')


@admin.register(DimensionalLog)
class DimensionalLogAdmin(admin.ModelAdmin):
    list_display = ['__str__','result','operator','logged_at']
    list_filter  = ['result']
