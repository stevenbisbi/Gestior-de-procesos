from django.contrib import admin
from django.utils.html import format_html
from .models import TubeSpec, ProductType, Machine, ProductionBatch, ProcessRecord, ProcessShiftEntry, CuttingProgram, CuttingProgramLine


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


class ProcessShiftEntryInline(admin.TabularInline):
    model  = ProcessShiftEntry
    extra  = 0
    fields = ['operator', 'machine', 'shift', 'qty_done', 'started_at', 'finished_at']
    readonly_fields = ['started_at']


@admin.register(ProcessRecord)
class ProcessRecordAdmin(admin.ModelAdmin):
    list_display = ['batch','process_type','machine','operator','status','qty_assigned','qty_done']
    list_filter  = ['status','process_type']
    inlines      = [ProcessShiftEntryInline]


@admin.register(ProcessShiftEntry)
class ProcessShiftEntryAdmin(admin.ModelAdmin):
    list_display = ['process_record','operator','machine','shift','qty_done','started_at','finished_at']
    list_filter  = ['shift']


class CuttingProgramLineInline(admin.TabularInline):
    model  = CuttingProgramLine
    extra  = 0
    fields = ['product_type','pedido_quantity','total_quantity','start_date','end_date',
              'saw_type','rpm','client','batch']
    readonly_fields = ['batch']


@admin.register(CuttingProgram)
class CuttingProgramAdmin(admin.ModelAdmin):
    list_display    = ['__str__', 'month', 'version', 'status', 'created_by', 'created_at']
    list_filter     = ['status']
    inlines         = [CuttingProgramLineInline]
    readonly_fields = ['created_at', 'updated_at']


@admin.register(CuttingProgramLine)
class CuttingProgramLineAdmin(admin.ModelAdmin):
    list_display    = ['program','product_type','pedido_quantity','total_quantity',
                       'client','saw_type','rpm','batch']
    list_filter     = ['saw_type']
    search_fields   = ['product_type__name','client','tube_description']
    readonly_fields = ['batch']
