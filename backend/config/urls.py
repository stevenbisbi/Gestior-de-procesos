from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('production.urls')),
    path('api/quality/', include('quality.urls')),
]

# En producción servimos el index.html de React para todas las rutas no-API
if not settings.DEBUG or (settings.BASE_DIR / 'frontend_build').exists():
    urlpatterns += static(settings.STATIC_URL, document_root=settings.BASE_DIR / 'frontend_build')
    urlpatterns += [
        path('', TemplateView.as_view(template_name='index.html')),
        # SPA catch-all (React Router maneja las rutas)
        path('<path:path>', TemplateView.as_view(template_name='index.html')),
    ]
