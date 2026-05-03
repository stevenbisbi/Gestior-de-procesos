from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'checks',  views.QualityCheckViewSet)
router.register(r'logs',    views.DimensionalLogViewSet)

urlpatterns = [
    path('report/', views.supervisor_quality_report),
    path('', include(router.urls)),
]
