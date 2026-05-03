from django.contrib import admin
from django.utils.html import format_html
from .models import TubeSpec, ProductType, Machine, ProductionBatch, ProcessRecord


@admin.register(TubeSpec)
class TubeSpecAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'shape', 'outer_diameter', 'thickness', 'material']
    list_filter  = ['shape', 'material']


class ProcessRecordInline(admin.TabularInline):
    model    = ProcessRecord
    extra    = 0
    fields   = ['process_type','sequence','machine','operator','status','qty_assigned','qty_done']
    readonly_fields = ['started_at','finished_at']
    can_delete = False


@admin.register(ProductType)
class ProductTypeAdmin(admin.ModelAdmin):
    list_display  = ['name','tube_spec','cut_length','client','default_priority',
                     'requires_chaflan','requires_moleteo','requires_curvado']
    list_filter   = ['default_priority','requires_chaflan','requires_moleteo','requires_curvado']
    search_fields = ['name','client']


@admin.register(Machine)
class MachineAdmin(admin.ModelAdmin):
    list_display      = ['name','process_type','is_active']
    list_filter       = ['process_type','is_active']
    filter_horizontal = ['operators']


@admin.register(ProductionBatch)
class ProductionBatchAdmin(admin.ModelAdmin):
    list_display = ['batch_code','product_type','total_quantity','status','priority','progress_pct']
    list_filter  = ['status','priority']
    inlines      = [ProcessRecordInline]
    readonly_fields = ['batch_code','created_at','updated_at']

    def progress_pct(self, obj):
        return f'{obj.progress_pct}%'


@admin.register(ProcessRecord)
class ProcessRecordAdmin(admin.ModelAdmin):
    list_display = ['batch','process_type','machine','operator','status','qty_assigned','qty_done']
    list_filter  = ['status','process_type']
