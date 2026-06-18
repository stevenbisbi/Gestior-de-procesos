from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'tube-specs',        views.TubeSpecViewSet)
router.register(r'product-types',     views.ProductTypeViewSet)
router.register(r'machines',          views.MachineViewSet)
router.register(r'batches',           views.ProductionBatchViewSet)
router.register(r'records',           views.ProcessRecordViewSet)
router.register(r'cutting-programs',  views.CuttingProgramViewSet)
router.register(r'cutting-lines',     views.CuttingProgramLineViewSet)
router.register(r'tube-receptions',   views.TubeReceptionViewSet)

urlpatterns = [
    path('health/',      views.health_check),  # público, para healthchecks
    path('auth/login/',  views.login_view),
    path('auth/logout/', views.logout_view),
    path('auth/me/',     views.me_view),

    path('supervisor/dashboard/', views.supervisor_dashboard),
    path('supervisor/machines/',  views.machines_status),
    path('operator/tasks/',       views.operator_tasks),

    path('', include(router.urls)),
]
