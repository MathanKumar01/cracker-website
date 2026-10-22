from django.urls import path
from .views import (
    CreateOrderView,
    CustomerOrdersView,
    CustomerOrderPdfView,
    AdminOrdersView,
    AdminOrderDetailView,
    AdminOrderPdfView,
    ExportOrdersView,
    ExportOrdersExcelView,
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
    path("orders/<str:pk>/pdf/", CustomerOrderPdfView.as_view(), name="customer-order-pdf"),
    path("orders/<str:pk>/pdf", CustomerOrderPdfView.as_view()),
    path("admin/orders/", AdminOrdersView.as_view(), name="admin-orders"),
    path("admin/orders/export/", ExportOrdersView.as_view(), name="export-orders"),
    path("admin/orders/export-excel/", ExportOrdersExcelView.as_view(), name="export-orders-excel"),
    path("admin/orders/<str:pk>/", AdminOrderDetailView.as_view(), name="admin-order-detail"),
    path("admin/orders/<str:pk>/pdf/", AdminOrderPdfView.as_view(), name="admin-order-pdf"),
    path("admin/orders/<str:pk>/pdf", AdminOrderPdfView.as_view()),
]

