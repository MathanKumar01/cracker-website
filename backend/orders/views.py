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
    email = "admin@kathiravan.store"

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
    Allows placing orders for both authenticated customers and guest customers.
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = CreateOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user if (request.user and request.user.is_authenticated) else None
        order = serializer.save(user=user)
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class CustomerOrdersView(APIView):
    """
    Returns orders placed by the currently logged-in customer.
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        orders = Order.objects.filter(user=request.user).prefetch_related("items").order_by("-created_at")
        return Response(OrderSerializer(orders, many=True).data)


class AdminOrdersView(APIView):
    """
    Lists all store orders. Accessible by staff users or holders of the ADMIN_API_KEY.
    """
    authentication_classes = [TokenAuthentication, AdminApiKeyAuthentication]
    permission_classes = [IsAdminOrHasApiKey]

    def get(self, request):
        orders = Order.objects.prefetch_related("items").order_by("-created_at")
        return Response(OrderSerializer(orders, many=True).data)


class AdminOrderDetailView(APIView):
    """
    View/update/delete an order. Accessible by staff users or holders of the ADMIN_API_KEY.
    """
    authentication_classes = [TokenAuthentication, AdminApiKeyAuthentication]
    permission_classes = [IsAdminOrHasApiKey]

    def get_order(self, pk):
        try:
            return Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return None

    def get(self, request, pk):
        order = self.get_order(pk)
        if order is None:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(OrderSerializer(order).data)

    def patch(self, request, pk):
        order = self.get_order(pk)
        if order is None:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
        new_status = request.data.get("status")
        if new_status not in dict(Order.STATUS):
            return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
        order.status = new_status
        order.save(update_fields=["status"])
        return Response(OrderSerializer(order).data)

    def delete(self, request, pk):
        order = self.get_order(pk)
        if order is None:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
        order.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ExportOrdersView(APIView):
    """
    Exports all orders into an Excel-compatible CSV file.
    """
    authentication_classes = [TokenAuthentication, AdminApiKeyAuthentication]
    permission_classes = [IsAdminOrHasApiKey]

    def get(self, request):
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="kathiravan-orders.csv"'
        response.write("\ufeff")  # UTF-8 BOM for Microsoft Excel
        writer = csv.writer(response)
        writer.writerow(["Order #", "Date", "Customer Name", "Phone", "Address", "Notes", "Products", "Total (Rs)", "Status"])
        for o in Order.objects.prefetch_related("items").order_by("-created_at"):
            items_str = "; ".join(f"{i.product_name} x {i.quantity}" for i in o.items.all())
            writer.writerow([
                o.order_number,
                o.created_at.strftime("%Y-%m-%d %H:%M"),
                o.customer_name,
                o.phone,
                o.address,
                o.notes,
                items_str,
                o.total,
                o.status
            ])
        return response


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@authentication_classes([])
def health(request):
    return Response({
        "status": "ok",
        "service": "Kathiravan Crackers API",
        "database": "connected"
    })

