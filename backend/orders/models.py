from django.conf import settings
from django.db import models
class Order(models.Model):
    STATUS = [(x,x.title()) for x in ["new","confirmed","packed","completed","cancelled"]]
    order_number = models.CharField(max_length=32, unique=True, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="orders")
    customer_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=30)
    address = models.TextField()
    notes = models.TextField(blank=True)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS, default="new")
    created_at = models.DateTimeField(auto_now_add=True)
    def save(self,*args,**kwargs):
        if not self.order_number:
            from django.utils import timezone
            self.order_number = "TC" + timezone.now().strftime("%y%m%d%H%M%S") + str(__import__("secrets").randbelow(900)+100)
        super().save(*args,**kwargs)
    def __str__(self): return f"{self.order_number} - {self.customer_name}"
class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    product_code = models.CharField(max_length=20)
    product_name = models.CharField(max_length=220)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    def __str__(self): return f"{self.product_name} x {self.quantity}"
