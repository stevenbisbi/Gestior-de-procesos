from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/',         include('production.urls')),
    path('api/quality/', include('quality.urls')),
]

# Servir el SPA si existe el build de React
# (en producción WhiteNoise sirve los assets en /static/, aquí solo el index.html)
if (settings.BASE_DIR / 'frontend_build').exists():
    urlpatterns += [
        path('', TemplateView.as_view(template_name='index.html')),
        # Catch-all para rutas de React Router. Excluye admin/api/static.
        re_path(r'^(?!admin|api|static).*$',
                TemplateView.as_view(template_name='index.html')),
    ]
