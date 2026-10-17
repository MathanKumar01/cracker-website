from django.urls import path
from .views import (
    CreateOrderView,
    CustomerOrdersView,
    AdminOrdersView,
    AdminOrderDetailView,
    ExportOrdersView,
    RegisterView,
    LoginView,
    CurrentUserView,
    AdminKeyVerifyView,
)

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/me/", CurrentUserView.as_view(), name="current-user"),
    path("auth/admin-verify/", AdminKeyVerifyView.as_view(), name="admin-verify"),
    path("orders/", CreateOrderView.as_view(), name="create-order"),
    path("orders/my-orders/", CustomerOrdersView.as_view(), name="customer-orders"),
    path("admin/orders/", AdminOrdersView.as_view(), name="admin-orders"),
    path("admin/orders/export/", ExportOrdersView.as_view(), name="export-orders"),
    path("admin/orders/<int:pk>/", AdminOrderDetailView.as_view(), name="admin-order-detail"),
]

