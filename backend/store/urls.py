from django.contrib import admin
from django.urls import path, include
from orders.views import health
urlpatterns = [path("django-admin/", admin.site.urls), path("api/", include("orders.urls")), path("health/", health)]
