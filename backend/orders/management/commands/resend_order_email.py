from django.core.management.base import BaseCommand
from orders.models import Order
from orders.email_notifications import send_admin_order_notification


class Command(BaseCommand):
    help = "Resend admin email notification for a specific order (or latest order)"

    def add_arguments(self, parser):
        parser.add_argument(
            "order_id",
            nargs="?",
            type=str,
            default=None,
            help="Order ID (primary key) or Order Number (e.g. KC261022134802888). Defaults to latest order.",
        )

    def handle(self, *args, **options):
        order_arg = options.get("order_id")

        if order_arg:
            order = (
                Order.objects.filter(id=order_arg).first()
                if order_arg.isdigit()
                else Order.objects.filter(order_number__iexact=order_arg).first()
            )
            if not order:
                self.stdout.write(self.style.ERROR(f"[ERROR] Order '{order_arg}' not found!"))
                return
        else:
            order = Order.objects.order_by("-id").first()
            if not order:
                self.stdout.write(self.style.ERROR("[ERROR] No orders exist in the database!"))
                return

        self.stdout.write(
            f"Found Order #{order.order_number} (ID: {order.id}) placed by {order.customer_name} for Rs. {order.total}"
        )

        from django.conf import settings
        host_user = getattr(settings, "EMAIL_HOST_USER", "").strip()
        host_pwd = getattr(settings, "EMAIL_HOST_PASSWORD", "").strip()

        if not host_user or not host_pwd:
            self.stdout.write(self.style.ERROR(
                "[ERROR] Cannot send: EMAIL_HOST_USER or EMAIL_HOST_PASSWORD is not set in backend/.env!"
            ))
            return

        success = send_admin_order_notification(order, synchronous=True)
        if success:
            self.stdout.write(self.style.SUCCESS(
                f"[SUCCESS] Email notification dispatched successfully for Order #{order.order_number}!"
            ))
        else:
            self.stdout.write(self.style.ERROR(
                "[FAILED] Failed to send email. Check backend logs or run 'python manage.py test_smtp' for error details."
            ))
