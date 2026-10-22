import csv
import hmac
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.conf import settings
from django.http import HttpResponse
from rest_framework import status, permissions, authentication
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import AuthenticationFailed

from .models import Order
from .serializers import OrderSerializer, CreateOrderSerializer


class AdminKeyUser:
    """Lightweight principal representing authenticated access via Admin API Key."""
    is_authenticated = True
    is_staff = True
    is_superuser = True
    username = "admin_api_key"
    email = "admin@thaswika.store"

    def __str__(self):
        return "admin_api_key"


class AdminApiKeyAuthentication(authentication.BaseAuthentication):
    """
    Authenticates requests using the 'X-Admin-Key' HTTP header
    or 'admin_key' query parameter against settings.ADMIN_API_KEY.
    """
    def authenticate(self, request):
        supplied = request.headers.get("X-Admin-Key") or request.query_params.get("admin_key")
        if not supplied:
            return None
        expected = getattr(settings, "ADMIN_API_KEY", "")
        if expected and hmac.compare_digest(str(supplied).strip(), str(expected).strip()):
            return (AdminKeyUser(), supplied)
        raise AuthenticationFailed("Invalid Admin API Key.")


class IsAdminOrHasApiKey(permissions.BasePermission):
    """
    Allows access if user is a Django staff member OR provided a valid Admin API Key.
    """
    def has_permission(self, request, view):
        if isinstance(getattr(request, "user", None), AdminKeyUser):
            return True
        supplied = request.headers.get("X-Admin-Key") or request.query_params.get("admin_key")
        expected = getattr(settings, "ADMIN_API_KEY", "")
        if supplied and expected and hmac.compare_digest(str(supplied).strip(), str(expected).strip()):
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class AdminKeyVerifyView(APIView):
    """
    Validates an admin key sent from the frontend admin login page.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        supplied = str(request.data.get("api_key", "")).strip()
        expected = getattr(settings, "ADMIN_API_KEY", "").strip()
        if not supplied or not expected or not hmac.compare_digest(supplied, expected):
            return Response({"detail": "Invalid Admin API Key."}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({
            "status": "ok",
            "message": "Admin API key verified.",
            "is_staff": True,
            "auth_type": "api_key"
        })


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = str(request.data.get("username", "")).strip()
        password = str(request.data.get("password", ""))
        email = str(request.data.get("email", "")).strip()

        if len(username) < 3 or len(username) > 150:
            return Response({"detail": "Username must be 3 to 150 characters."}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 8:
            return Response({"detail": "Password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username__iexact=username).exists():
            return Response({"detail": "That username is already taken. Please choose another."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, password=password, email=email)
        token = Token.objects.create(user=user)
        return Response({
            "token": token.key,
            "username": user.username,
            "is_staff": user.is_staff
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = str(request.data.get("username", "")).strip()
        password = str(request.data.get("password", ""))
        user = authenticate(username=username, password=password)
        if user is None:
            return Response({"detail": "Invalid username or password."}, status=status.HTTP_401_UNAUTHORIZED)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            "token": token.key,
            "username": user.username,
            "is_staff": user.is_staff
        })


class CurrentUserView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({
            "username": request.user.username,
            "is_staff": request.user.is_staff,
            "email": request.user.email
        })


class CreateOrderView(APIView):
    """
    Requires customers to be logged in to place an order.
    Saves the ordered items under their account profile.
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {"detail": "Please log in or create an account to place an order."},
                status=status.HTTP_401_UNAUTHORIZED
            )
        serializer = CreateOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save(user=request.user)

        # Trigger instant notification to store owner and customer (runs in background thread)
        try:
            from .email_notifications import send_admin_order_notification, send_customer_order_confirmation
            send_admin_order_notification(order)
            send_customer_order_confirmation(order)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to dispatch order notification: {e}")

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class CustomerOrdersView(APIView):
    """
    Returns orders placed by the currently logged-in customer.
    Shows the ordered details and real-time status (including admin confirmation).
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        orders = Order.objects.filter(user=request.user).prefetch_related("items").order_by("-created_at")
        return Response(OrderSerializer(orders, many=True).data)


def get_order_by_identifier(pk, user=None):
    """
    Finds an Order by integer ID or string order_number, optionally filtered by user.
    """
    qs = Order.objects.prefetch_related("items").select_related("user")
    if user and user.is_authenticated:
        qs = qs.filter(user=user)

    identifier = str(pk).strip()
    if identifier.isdigit():
        order = qs.filter(pk=int(identifier)).first()
        if order:
            return order

    # Lookup by unique order_number
    return qs.filter(order_number=identifier).first()


class CustomerOrderPdfView(APIView):
    """
    Allows a customer to download the PDF invoice for their own order.
    Supports lookup by order ID or order_number.
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        order = get_order_by_identifier(pk, user=request.user)
        if order is None:
            return Response({"detail": f"Order '{pk}' not found."}, status=status.HTTP_404_NOT_FOUND)

        from .pdf_generator import generate_order_pdf
        pdf_bytes = generate_order_pdf(order)

        disposition = "inline" if request.query_params.get("view") == "1" else "attachment"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'{disposition}; filename="Order-{order.order_number}.pdf"'
        return response


class AdminOrdersView(APIView):
    """
    Lists all store orders. Accessible by staff users or holders of the ADMIN_API_KEY.
    """
    authentication_classes = [TokenAuthentication, AdminApiKeyAuthentication]
    permission_classes = [IsAdminOrHasApiKey]

    def get(self, request):
        orders = Order.objects.prefetch_related("items").select_related("user").order_by("-created_at")
        return Response(OrderSerializer(orders, many=True).data)


class AdminOrderDetailView(APIView):
    """
    View/update/delete an order. Accessible by staff users or holders of the ADMIN_API_KEY.
    Admin confirming an order updates status to 'confirmed'.
    Supports lookup by order ID or order_number.
    """
    authentication_classes = [TokenAuthentication, AdminApiKeyAuthentication]
    permission_classes = [IsAdminOrHasApiKey]

    def get_order(self, pk):
        return get_order_by_identifier(pk)

    def get(self, request, pk):
        order = self.get_order(pk)
        if order is None:
            return Response({"detail": f"Order '{pk}' not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(OrderSerializer(order).data)

    def patch(self, request, pk):
        order = self.get_order(pk)
        if order is None:
            return Response({"detail": f"Order '{pk}' not found."}, status=status.HTTP_404_NOT_FOUND)
        new_status = request.data.get("status")
        if new_status not in dict(Order.STATUS):
            return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
        order.status = new_status
        order.save(update_fields=["status"])
        return Response(OrderSerializer(order).data)

    def delete(self, request, pk):
        order = self.get_order(pk)
        if order is None:
            return Response({"detail": f"Order '{pk}' not found."}, status=status.HTTP_404_NOT_FOUND)
        order.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminOrderPdfView(APIView):
    """
    Generates and returns an individual user's order in PDF format for the admin.
    Supports inline view (for print/preview) or direct file attachment download.
    Supports lookup by order ID or order_number.
    """
    authentication_classes = [TokenAuthentication, AdminApiKeyAuthentication]
    permission_classes = [IsAdminOrHasApiKey]

    def get(self, request, pk):
        order = get_order_by_identifier(pk)
        if order is None:
            return Response({"detail": f"Order '{pk}' not found."}, status=status.HTTP_404_NOT_FOUND)

        from .pdf_generator import generate_order_pdf
        pdf_bytes = generate_order_pdf(order)

        disposition = "inline" if request.query_params.get("view") == "1" else "attachment"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'{disposition}; filename="Order-{order.order_number}.pdf"'
        return response


class ExportOrdersExcelView(APIView):
    """
    Exports ALL orders into an Excel (.xlsx) workbook with full details and itemized breakdown.
    """
    authentication_classes = [TokenAuthentication, AdminApiKeyAuthentication]
    permission_classes = [IsAdminOrHasApiKey]

    def get(self, request):
        from .excel_generator import generate_all_orders_excel
        orders_qs = Order.objects.prefetch_related("items").select_related("user").order_by("-created_at")
        excel_bytes = generate_all_orders_excel(orders_qs)

        response = HttpResponse(
            excel_bytes,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = 'attachment; filename="thaswika-crackers-all-orders.xlsx"'
        return response


class ExportOrdersView(APIView):
    """
    Exports all orders into an Excel-compatible CSV file.
    """
    authentication_classes = [TokenAuthentication, AdminApiKeyAuthentication]
    permission_classes = [IsAdminOrHasApiKey]

    def get(self, request):
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="thaswika-orders.csv"'
        response.write("\ufeff")  # UTF-8 BOM for Microsoft Excel
        writer = csv.writer(response)
        writer.writerow([
            "Order #",
            "Date",
            "Customer Username",
            "Customer Name",
            "Phone",
            "Address",
            "Notes",
            "Total Items Qty",
            "Products Breakdown",
            "Total (Rs)",
            "Status",
            "Admin Confirmed",
        ])
        for o in Order.objects.prefetch_related("items").select_related("user").order_by("-created_at"):
            items = list(o.items.all())
            items_str = "; ".join(f"{i.product_name} x {i.quantity}" for i in items)
            order_qty = sum(i.quantity for i in items)
            is_confirmed = "YES" if o.status == "confirmed" else ("COMPLETED" if o.status == "completed" else "NO")
            username_val = o.user.username if o.user else "Guest"
            writer.writerow([
                o.order_number,
                o.created_at.strftime("%Y-%m-%d %H:%M") if o.created_at else "",
                username_val,
                o.customer_name,
                o.phone,
                o.address,
                o.notes,
                order_qty,
                items_str,
                o.total,
                o.status,
                is_confirmed,
            ])
        return response


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@authentication_classes([])
def health(request):
    return Response({
        "status": "ok",
        "service": "Thaswika Crackers API",
        "database": "connected"
    })


