from django.core.management.base import BaseCommand
from django.conf import settings
from orders.email_notifications import _send_email_worker


class Command(BaseCommand):
    help = "Test email notification system (Brevo HTTP API or Gmail SMTP)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--recipient",
            type=str,
            default=None,
            help="Optional recipient email address. Defaults to ADMIN_NOTIFICATION_EMAIL or EMAIL_HOST_USER.",
        )

    def handle(self, *args, **options):
        self.stdout.write("=== TESTING EMAIL CONFIGURATION ===")

        brevo_key = getattr(settings, "BREVO_API_KEY", "").strip()
        host = getattr(settings, "EMAIL_HOST", "smtp.gmail.com")
        port = getattr(settings, "EMAIL_PORT", 587)
        tls = getattr(settings, "EMAIL_USE_TLS", True)
        host_user = getattr(settings, "EMAIL_HOST_USER", "").strip()
        host_pwd = getattr(settings, "EMAIL_HOST_PASSWORD", "").strip()
        admin_email = getattr(settings, "ADMIN_NOTIFICATION_EMAIL", "").strip() or host_user
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "").strip() or host_user

        recipient = options["recipient"] or admin_email

        self.stdout.write(f"BREVO_API_KEY       : {'[SET - ' + str(len(brevo_key)) + ' chars]' if brevo_key else '[NOT SET]'}")
        self.stdout.write(f"EMAIL_HOST          : {host}")
        self.stdout.write(f"EMAIL_PORT          : {port}")
        self.stdout.write(f"EMAIL_USE_TLS       : {tls}")
        self.stdout.write(f"EMAIL_HOST_USER     : {host_user if host_user else '[NOT SET]'}")
        self.stdout.write(f"EMAIL_HOST_PASSWORD : {'[SET - ' + str(len(host_pwd)) + ' chars]' if host_pwd else '[NOT SET]'}")
        self.stdout.write(f"DEFAULT_FROM_EMAIL  : {from_email if from_email else '[NOT SET]'}")
        self.stdout.write(f"RECIPIENT EMAIL     : {recipient if recipient else '[NOT SET]'}")

        if not brevo_key and (not host_user or not host_pwd):
            self.stdout.write(self.style.ERROR(
                "\n[ERROR] Neither BREVO_API_KEY nor SMTP credentials configured!\n"
                "To bypass Render port 587 block, add BREVO_API_KEY to backend/.env and Render.\n"
            ))
            return

        if not recipient:
            self.stdout.write(self.style.ERROR(
                "\n[ERROR] No recipient email configured! Set ADMIN_NOTIFICATION_EMAIL in backend/.env."
            ))
            return

        mode = "Brevo HTTPS API (Port 443)" if brevo_key else f"Gmail SMTP (Port {port})"
        self.stdout.write(f"\nAttempting to send test email via {mode} to: {recipient} ...")

        try:
            success = _send_email_worker(
                subject="Test Email from Thaswika Crackers Store",
                text_body=(
                    "Congratulations!\n\n"
                    "Your automated email notification system is working correctly.\n"
                    "You will now receive instant email alerts whenever a customer places an order.\n\n"
                    "- Thaswika Crackers Automated System"
                ),
                html_body=(
                    "<html><body>"
                    "<h2>Congratulations!</h2>"
                    "<p>Your automated email notification system is working correctly.</p>"
                    "<p>You will now receive instant email alerts whenever a customer places an order.</p>"
                    "</body></html>"
                ),
                recipient=recipient,
                raise_exceptions=True,
            )
            if success:
                self.stdout.write(self.style.SUCCESS(
                    f"\n[SUCCESS] Test email sent successfully to {recipient} via {mode}!\n"
                    "Please check your inbox (and Spam folder if you do not see it immediately)."
                ))
            else:
                self.stdout.write(self.style.WARNING("\n[WARNING] Email dispatch returned False."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"\n[FAILED] Error sending email: {e}"))
