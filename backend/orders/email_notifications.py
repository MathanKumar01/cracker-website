import base64
import json
import logging
import threading
import urllib.error
import urllib.request
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger(__name__)


def _send_via_brevo_api(subject, text_body, html_body, to_list, from_email, attachment=None):
    """
    Sends an email via Brevo REST API v3 over standard HTTPS (Port 443).
    Bypasses cloud provider SMTP firewall blocks (e.g. Render Free plan).
    """
    brevo_key = getattr(settings, "BREVO_API_KEY", "").strip()
    if not brevo_key:
        return False

    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "api-key": brevo_key,
        "content-type": "application/json",
    }

    sender_name = "Thaswika Crackers"
    sender_email = from_email or "thaswikacrackers@gmail.com"
    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": r} for r in to_list],
        "subject": subject,
        "htmlContent": html_body,
    }
    if text_body:
        payload["textContent"] = text_body

    if attachment:
        filename, file_bytes, _ = attachment
        payload["attachment"] = [
            {
                "name": filename,
                "content": base64.b64encode(file_bytes).decode("utf-8"),
            }
        ]

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            logger.info(f"Brevo API response {resp.status}: Successfully dispatched email to {to_list}")
            return True
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8") if e.fp else str(e)
        logger.error(f"Brevo API HTTP Error {e.code}: {err_msg}")
        raise RuntimeError(f"Brevo API Error ({e.code}): {err_msg}")
    except Exception as e:
        logger.error(f"Brevo API request failed: {e}")
        raise e


def _send_email_worker(subject, text_body, html_body, recipient, attachment=None, raise_exceptions=False):
    """
    Worker function to send an email. First attempts Brevo HTTP API (if configured),
    otherwise falls back to Django SMTP backend.
    """
    try:
        from_email = (
            getattr(settings, "DEFAULT_FROM_EMAIL", "").strip()
            or getattr(settings, "EMAIL_HOST_USER", "").strip()
            or "thaswikacrackers@gmail.com"
        )
        if isinstance(recipient, str):
            to_list = [r.strip() for r in recipient.split(",") if r.strip()]
        else:
            to_list = [r.strip() for r in recipient if r and str(r).strip()]

        if not to_list:
            logger.warning("No valid recipients for email notification.")
            if raise_exceptions:
                raise ValueError("No recipient email specified.")
            return False

        # 1. Prefer Brevo HTTP API over Port 443 HTTPS (works on Render free tier!)
        brevo_key = getattr(settings, "BREVO_API_KEY", "").strip()
        if brevo_key:
            return _send_via_brevo_api(subject, text_body, html_body, to_list, from_email, attachment=attachment)

        # 2. Fall back to standard Django SMTP
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=from_email,
            to=to_list,
        )
        if html_body:
            msg.attach_alternative(html_body, "text/html")

        if attachment:
            filename, content, mimetype = attachment
            msg.attach(filename, content, mimetype)

        msg.send(fail_silently=False)
        logger.info(f"Successfully sent order email to {to_list} for '{subject}'")
        return True
    except Exception as e:
        logger.error(f"Failed to send email notification to {recipient}: {e}", exc_info=True)
        if raise_exceptions:
            raise e
        return False


def send_admin_order_notification(order, synchronous=False, raise_exceptions=False):
    """
    Dispatches a professional, instant email alert to the store owner
    whenever a customer places a new order.
    """
    brevo_key = getattr(settings, "BREVO_API_KEY", "").strip()
    host_user = getattr(settings, "EMAIL_HOST_USER", "").strip()
    host_pwd = getattr(settings, "EMAIL_HOST_PASSWORD", "").strip()
    recipient = (
        getattr(settings, "ADMIN_NOTIFICATION_EMAIL", "").strip()
        or host_user
        or "orderdesksales@gmail.com"
    )

    # If neither Brevo nor SMTP credentials are set, skip gracefully
    if not brevo_key and (not host_user or not host_pwd):
        logger.info("Order email notification skipped: Neither BREVO_API_KEY nor SMTP credentials configured.")
        if raise_exceptions:
            raise ValueError("Neither BREVO_API_KEY nor SMTP credentials configured in environment.")
        return False

    if not recipient:
        logger.warning("Order email notification skipped: No ADMIN_NOTIFICATION_EMAIL configured.")
        if raise_exceptions:
            raise ValueError("ADMIN_NOTIFICATION_EMAIL is not set in environment.")
        return False

    try:
        items = list(order.items.all())
        total_qty = sum(item.quantity for item in items)
        created_str = order.created_at.strftime("%d-%b-%Y %I:%M %p") if order.created_at else "Just now"

        subject = f"🛒 New Order #{order.order_number} - Rs. {order.total:,.2f} ({order.customer_name})"

        # Plain text version
        lines = [
            f"=== NEW ORDER RECEIVED ===",
            f"Order Number : #{order.order_number}",
            f"Date         : {created_str}",
            f"Customer     : {order.customer_name}",
            f"Phone        : {order.phone}",
            f"Account      : @{order.user.username if order.user else 'Guest'}",
            f"Address      : {order.address}",
        ]
        if order.notes:
            lines.append(f"Notes        : {order.notes}")

        lines.append("\n--- ORDER ITEMS ---")
        for idx, item in enumerate(items, start=1):
            lines.append(
                f"{idx}. [{item.product_code or '-'}] {item.product_name} - Qty: {item.quantity} x Rs. {item.unit_price:,.2f} = Rs. {item.subtotal:,.2f}"
            )

        lines.append(f"\nTotal Units: {total_qty} units ({len(items)} items)")
        lines.append(f"Grand Total: Rs. {order.total:,.2f}")
        lines.append("\nLog in to your admin panel to confirm or update status.")
        text_body = "\n".join(lines)

        # HTML items table rows
        rows_html = []
        for idx, item in enumerate(items, start=1):
            bg = "#FAF6F0" if idx % 2 == 1 else "#FFFFFF"
            rows_html.append(f"""
            <tr style="background:{bg};">
              <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #E5D5C5;font-size:12px;">{idx}</td>
              <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #E5D5C5;font-size:12px;font-family:monospace;font-weight:bold;color:#7A2213;">{item.product_code or '-'}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #E5D5C5;font-size:12px;font-weight:600;color:#2A160D;">{item.product_name}</td>
              <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #E5D5C5;font-size:12px;font-weight:bold;">{item.quantity}</td>
              <td style="padding:8px 10px;text-align:right;border-bottom:1px solid #E5D5C5;font-size:12px;">Rs. {item.unit_price:,.2f}</td>
              <td style="padding:8px 10px;text-align:right;border-bottom:1px solid #E5D5C5;font-size:12px;font-weight:bold;color:#9E2C18;">Rs. {item.subtotal:,.2f}</td>
            </tr>
            """)
        table_rows_str = "".join(rows_html)

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F5F0; margin: 0; padding: 20px; color: #2A160D; }}
    .container {{ max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #E5D5C5; box-shadow: 0 4px 14px rgba(0,0,0,0.06); }}
    .header {{ background: linear-gradient(135deg, #9E2C18 0%, #B8471C 100%); color: #ffffff; padding: 24px 28px; text-align: left; }}
    .header h1 {{ margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; }}
    .header p {{ margin: 4px 0 0 0; font-size: 13px; opacity: 0.9; }}
    .content {{ padding: 24px 28px; }}
    .badge {{ display: inline-block; background: #FAF0E6; color: #9E2C18; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 11px; margin-bottom: 12px; text-transform: uppercase; border: 1px solid #E5D5C5; }}
    .info-card {{ background: #FCFAF7; border: 1px solid #E5D5C5; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; }}
    .info-row {{ margin: 4px 0; font-size: 13px; line-height: 1.5; }}
    .info-label {{ font-weight: bold; color: #666; width: 110px; display: inline-block; }}
    .items-table {{ width: 100%; border-collapse: collapse; margin: 18px 0; border: 1px solid #E5D5C5; }}
    .items-table th {{ background: #9E2C18; color: #ffffff; font-size: 11px; font-weight: bold; text-transform: uppercase; padding: 9px 10px; }}
    .footer {{ background: #FAF6F0; padding: 16px 28px; text-align: center; font-size: 11px; color: #777; border-top: 1px solid #E5D5C5; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛒 New Order Received!</h1>
      <p>Thaswika Crackers - Instant Store Order Alert</p>
    </div>
    <div class="content">
      <span class="badge">Status: NEW ORDER</span>
      
      <div class="info-card">
        <div class="info-row"><span class="info-label">Order Number:</span> <strong style="color:#9E2C18; font-size:14px;">#{order.order_number}</strong></div>
        <div class="info-row"><span class="info-label">Order Date:</span> {created_str}</div>
        <div class="info-row"><span class="info-label">Customer Name:</span> <strong>{order.customer_name}</strong></div>
        <div class="info-row"><span class="info-label">Phone Number:</span> <a href="tel:{order.phone}" style="color:#9E2C18; font-weight:bold; text-decoration:none;">{order.phone}</a> | <a href="https://wa.me/91{order.phone.replace(' ', '').replace('-', '')}" target="_blank" style="color:#15803D; font-weight:bold; text-decoration:none;">WhatsApp</a></div>
        <div class="info-row"><span class="info-label">Account:</span> @{order.user.username if order.user else 'Guest'}</div>
        <div class="info-row"><span class="info-label">Address:</span> <span style="white-space: pre-wrap;">{order.address}</span></div>
        {f'<div class="info-row"><span class="info-label">Order Notes:</span> <em>{order.notes}</em></div>' if order.notes else ''}
      </div>

      <h3 style="margin: 20px 0 8px 0; font-size: 14px; color: #9E2C18; text-transform: uppercase;">Items Breakdown</h3>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 25px;">#</th>
            <th style="width: 55px;">Code</th>
            <th style="text-align: left;">Product Description</th>
            <th style="width: 40px;">Qty</th>
            <th style="width: 75px; text-align: right;">Rate</th>
            <th style="width: 80px; text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {table_rows_str}
        </tbody>
      </table>

      <table style="width: 100%; background: #FAF6F0; border: 2px solid #9E2C18; border-radius: 8px; padding: 12px 16px; margin-top: 16px;">
        <tr>
          <td style="font-size: 13px; color: #555;">
            Total Units: <strong>{total_qty} units ({len(items)} items)</strong>
          </td>
          <td style="text-align: right; font-size: 13px; color: #555;">
            Grand Total: <strong style="font-size: 18px; color: #9E2C18; margin-left: 6px;">Rs. {order.total:,.2f}</strong>
          </td>
        </tr>
      </table>
    </div>

    <div class="footer">
      Thaswika Crackers Sivakasi · Instant Store Notifications<br/>
      This automated alert was generated when a customer placed an order on your website.
    </div>
  </div>
</body>
</html>
        """

        # Generate and attach PDF invoice
        attachment = None
        try:
            from .pdf_generator import generate_order_pdf
            pdf_bytes = generate_order_pdf(order)
            attachment = (f"Order-{order.order_number}.pdf", pdf_bytes, "application/pdf")
        except Exception as pdf_err:
            logger.warning(f"Could not attach PDF invoice for order {order.order_number}: {pdf_err}")

        if synchronous:
            return _send_email_worker(
                subject, text_body, html_body, recipient, attachment=attachment, raise_exceptions=raise_exceptions
            )
        else:
            t = threading.Thread(
                target=_send_email_worker,
                args=(subject, text_body, html_body, recipient, attachment),
                daemon=True,
            )
            t.start()
            return True

    except Exception as e:
        logger.error(f"Error preparing order notification email for order {getattr(order, 'order_number', '?')}: {e}", exc_info=True)
        if raise_exceptions:
            raise e
        return False


def send_customer_order_confirmation(order, synchronous=False):
    """
    Sends an order confirmation receipt with attached PDF estimate to the customer
    if their email address is available on their account.
    """
    customer_email = getattr(order.user, "email", None) if order.user else None
    if not customer_email or "@" not in customer_email:
        return False

    brevo_key = getattr(settings, "BREVO_API_KEY", "").strip()
    host_user = getattr(settings, "EMAIL_HOST_USER", "").strip()
    host_pwd = getattr(settings, "EMAIL_HOST_PASSWORD", "").strip()
    if not brevo_key and (not host_user or not host_pwd):
        return False

    try:
        items = list(order.items.all())
        total_qty = sum(item.quantity for item in items)
        created_str = order.created_at.strftime("%d-%b-%Y %I:%M %p") if order.created_at else "Just now"
        subject = f"✅ Order Confirmed! #{order.order_number} - Thaswika Crackers"

        lines = [
            f"Dear {order.customer_name},",
            f"\nGreat news! Your order #{order.order_number} has been verified and CONFIRMED by Thaswika Crackers Admin.",
            f"Your crackers are now being packed for dispatch.",
            f"\nOrder Number: #{order.order_number}",
            f"Date: {created_str}",
            f"Status: CONFIRMED & PACKING",
            f"Grand Total: Rs. {order.total:,.2f}",
            f"Delivery Address:\n{order.address}",
            f"\n--- ORDER ITEMS ---",
        ]
        for idx, item in enumerate(items, start=1):
            lines.append(f"{idx}. [{item.product_code or '-'}] {item.product_name} - Qty: {item.quantity} x Rs. {item.unit_price:,.2f} = Rs. {item.subtotal:,.2f}")

        lines.extend([
            f"\nTotal Units: {total_qty} units ({len(items)} items)",
            f"\nWe will contact you at {order.phone} for dispatch details.",
            f"\nWarm regards,",
            f"Thaswika Crackers Sivakasi\nPhone / WhatsApp: +91 9943349987",
        ])
        text_body = "\n".join(lines)

        rows_html = []
        for idx, item in enumerate(items, start=1):
            bg = "#FAF6F0" if idx % 2 == 1 else "#FFFFFF"
            rows_html.append(f"""
            <tr style="background:{bg};">
              <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #E5D5C5;font-size:12px;">{idx}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #E5D5C5;font-size:12px;font-weight:600;color:#2A160D;">{item.product_name}</td>
              <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #E5D5C5;font-size:12px;font-weight:bold;">{item.quantity}</td>
              <td style="padding:8px 10px;text-align:right;border-bottom:1px solid #E5D5C5;font-size:12px;">Rs. {item.unit_price:,.2f}</td>
              <td style="padding:8px 10px;text-align:right;border-bottom:1px solid #E5D5C5;font-size:12px;font-weight:bold;color:#9E2C18;">Rs. {item.subtotal:,.2f}</td>
            </tr>
            """)
        table_rows_str = "".join(rows_html)

        html_body = f"""
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F5F0; padding: 20px; color: #2A160D; margin: 0;">
  <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #E5D5C5; box-shadow: 0 4px 14px rgba(0,0,0,0.06);">
    <div style="background: linear-gradient(135deg, #15803D 0%, #166534 100%); color: #ffffff; padding: 24px 28px;">
      <h2 style="margin: 0; font-size: 22px;">✅ Order Confirmed & Packing!</h2>
      <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Thaswika Crackers Sivakasi · Diwali Orders</p>
    </div>
    <div style="padding: 24px 28px;">
      <p style="font-size: 15px;">Dear <strong>{order.customer_name}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6; color: #166534; font-weight: bold;">
        Great news! Your order has been verified and CONFIRMED by Thaswika Crackers Admin. Your crackers are now being packed for dispatch! 🪔✨
      </p>

      <div style="background: #FCFAF7; border: 1px solid #E5D5C5; border-radius: 8px; padding: 14px 18px; margin: 18px 0;">
        <div style="margin: 4px 0; font-size: 13px;"><strong>Order Number:</strong> <span style="color:#9E2C18; font-weight:bold;">#{order.order_number}</span></div>
        <div style="margin: 4px 0; font-size: 13px;"><strong>Order Date:</strong> {created_str}</div>
        <div style="margin: 4px 0; font-size: 13px;"><strong>Status:</strong> <span style="background:#DCFCE7; color:#15803D; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:11px;">CONFIRMED</span></div>
        <div style="margin: 4px 0; font-size: 13px;"><strong>Contact Phone:</strong> {order.phone}</div>
        <div style="margin: 4px 0; font-size: 13px;"><strong>Delivery Address:</strong> <span style="white-space: pre-wrap;">{order.address}</span></div>
      </div>

      <h3 style="margin: 20px 0 8px 0; font-size: 13px; color: #9E2C18; text-transform: uppercase;">Ordered Items ({len(items)})</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #E5D5C5;">
        <thead>
          <tr style="background: #9E2C18; color: #ffffff; font-size: 11px; text-transform: uppercase;">
            <th style="padding: 8px 10px; width: 30px;">#</th>
            <th style="padding: 8px 10px; text-align: left;">Product</th>
            <th style="padding: 8px 10px; width: 45px; text-align: center;">Qty</th>
            <th style="padding: 8px 10px; width: 75px; text-align: right;">Rate</th>
            <th style="padding: 8px 10px; width: 85px; text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {table_rows_str}
        </tbody>
      </table>

      <div style="background: #FAF6F0; border: 2px solid #15803D; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <span style="font-size: 13px; color: #555;">Total Units: <strong>{total_qty} units</strong></span>
        <span style="font-size: 14px; color: #555;">Grand Total: <strong style="font-size: 18px; color: #15803D; margin-left: 6px;">Rs. {order.total:,.2f}</strong></span>
      </div>

      <p style="font-size: 13px; color: #444; line-height: 1.5;">
        📎 Your verified official PDF estimate is attached to this email.<br/>
        We will contact you shortly on <strong>{order.phone}</strong> with parcel/transport booking details.
      </p>

      <p style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #E5D5C5; color: #666; font-size: 12px;">
        Need help or modifications? Call or WhatsApp us at <strong>+91 9943349987</strong>.
      </p>
    </div>

    <div style="background: #FAF6F0; padding: 14px 28px; text-align: center; font-size: 11px; color: #777; border-top: 1px solid #E5D5C5;">
      Thaswika Crackers Sivakasi · Direct Diwali Fireworks Wholesale & Retail
    </div>
  </div>
</body>
</html>
        """

        attachment = None
        try:
            from .pdf_generator import generate_order_pdf
            pdf_bytes = generate_order_pdf(order)
            attachment = (f"Order-{order.order_number}.pdf", pdf_bytes, "application/pdf")
        except Exception:
            pass

        if synchronous:
            return _send_email_worker(subject, text_body, html_body, customer_email, attachment=attachment)
        else:
            t = threading.Thread(
                target=_send_email_worker,
                args=(subject, text_body, html_body, customer_email, attachment),
                daemon=True,
            )
            t.start()
            return True
    except Exception as e:
        logger.error(f"Error sending customer confirmation: {e}")
        return False

