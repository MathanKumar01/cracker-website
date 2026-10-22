from django.core.management.base import BaseCommand
from django.conf import settings
from django.core.mail import send_mail


class Command(BaseCommand):
    help = "Test Gmail SMTP configuration and send a test email to verify credentials"

    def add_arguments(self, parser):
        parser.add_argument(
            "--recipient",
            type=str,
            default=None,
            help="Optional recipient email address. Defaults to ADMIN_NOTIFICATION_EMAIL or EMAIL_HOST_USER.",
        )

    def handle(self, *args, **options):
        self.stdout.write("=== TESTING SMTP EMAIL CONFIGURATION ===")

        host = getattr(settings, "EMAIL_HOST", "")
        port = getattr(settings, "EMAIL_PORT", 587)
        tls = getattr(settings, "EMAIL_USE_TLS", True)
        host_user = getattr(settings, "EMAIL_HOST_USER", "").strip()
        host_pwd = getattr(settings, "EMAIL_HOST_PASSWORD", "").strip()
        admin_email = getattr(settings, "ADMIN_NOTIFICATION_EMAIL", "").strip() or host_user
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "").strip() or host_user

        recipient = options["recipient"] or admin_email

        self.stdout.write(f"EMAIL_HOST          : {host}")
        self.stdout.write(f"EMAIL_PORT          : {port}")
        self.stdout.write(f"EMAIL_USE_TLS       : {tls}")
        self.stdout.write(f"EMAIL_HOST_USER     : {host_user if host_user else '[NOT SET - EMPTY]'}")
        self.stdout.write(f"EMAIL_HOST_PASSWORD : {'[SET - ' + str(len(host_pwd)) + ' chars]' if host_pwd else '[NOT SET - EMPTY]'}")
        self.stdout.write(f"DEFAULT_FROM_EMAIL  : {from_email if from_email else '[NOT SET - EMPTY]'}")
        self.stdout.write(f"RECIPIENT EMAIL     : {recipient if recipient else '[NOT SET - EMPTY]'}")

        if not host_user or not host_pwd:
            self.stdout.write(self.style.ERROR(
                "\n[ERROR] EMAIL_HOST_USER or EMAIL_HOST_PASSWORD is missing in backend/.env!\n"
                "Please add your Gmail address and 16-character App Password to backend/.env:\n\n"
                "  EMAIL_HOST_USER=yourstore@gmail.com\n"
                "  EMAIL_HOST_PASSWORD=xxxx xxxx xxxx xxxx\n"
                "  ADMIN_NOTIFICATION_EMAIL=yourstore@gmail.com\n"
            ))
            return

        if not recipient:
            self.stdout.write(self.style.ERROR(
                "\n[ERROR] No recipient email configured! Set ADMIN_NOTIFICATION_EMAIL in backend/.env."
            ))
            return

        self.stdout.write(f"\nAttempting to send test email to: {recipient} ...")

        try:
            sent_count = send_mail(
                subject="Test Email from Thaswika Crackers Store",
                message=(
                    "Congratulations!\n\n"
                    "Your Gmail SMTP email notification system is working correctly.\n"
                    "You will now receive instant email alerts whenever a customer places an order.\n\n"
                    "- Thaswika Crackers Automated System"
                ),
                from_email=from_email,
                recipient_list=[r.strip() for r in recipient.split(",") if r.strip()],
                fail_silently=False,
            )
            if sent_count > 0:
                self.stdout.write(self.style.SUCCESS(
                    f"\n[SUCCESS] Test email sent successfully to {recipient}!\n"
                    "Please check your inbox (and Spam folder if you do not see it immediately)."
                ))
            else:
                self.stdout.write(self.style.WARNING("\n[WARNING] Django returned 0 emails sent."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"\n[FAILED] Error sending email: {e}"))
            err_str = str(e).lower()
            if "authentication" in err_str or "username and password not accepted" in err_str or "535" in err_str:
                self.stdout.write(self.style.WARNING(
                    "\n[HINT] Google rejected your username or password!\n"
                    "Gmail requires a 16-character 'App Password', NOT your standard personal Gmail login password.\n"
                    "To generate one:\n"
                    "1. Go to https://myaccount.google.com/security\n"
                    "2. Make sure '2-Step Verification' is turned ON.\n"
                    "3. Search for 'App passwords' or visit https://myaccount.google.com/apppasswords\n"
                    "4. Create an App Password called 'Crackers Store' and copy the 16 letters into EMAIL_HOST_PASSWORD in backend/.env."
                ))
