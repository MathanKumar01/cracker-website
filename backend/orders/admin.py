from django.contrib import admin
from .models import Order, OrderItem
class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product_code","product_name","quantity","unit_price","subtotal")
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number","customer_name","phone","total","status","created_at")
    list_filter = ("status","created_at")
    search_fields = ("order_number","customer_name","phone")
    inlines = [OrderItemInline]
