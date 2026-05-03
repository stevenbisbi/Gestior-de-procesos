from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'tube-specs',    views.TubeSpecViewSet)
router.register(r'product-types', views.ProductTypeViewSet)
router.register(r'machines',      views.MachineViewSet)
router.register(r'batches',       views.ProductionBatchViewSet)
router.register(r'records',       views.ProcessRecordViewSet)

urlpatterns = [
    path('auth/login/',  views.login_view),
    path('auth/logout/', views.logout_view),
    path('auth/me/',     views.me_view),

    path('supervisor/dashboard/', views.supervisor_dashboard),
    path('operator/tasks/',       views.operator_tasks),

    path('', include(router.urls)),
]
