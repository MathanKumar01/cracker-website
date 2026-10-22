import logging
import threading
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger(__name__)


def _send_email_worker(subject, text_body, html_body, recipient):
    """
    Worker function executed in a background daemon thread to send an email
    without blocking API response times.
    """
    try:
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or getattr(settings, "EMAIL_HOST_USER", None)
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=from_email,
            to=[recipient],
        )
        if html_body:
            msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
        logger.info(f"Successfully sent admin order notification to {recipient} for '{subject}'")
    except Exception as e:
        logger.error(f"Failed to send email notification to {recipient}: {e}", exc_info=True)


def send_admin_order_notification(order):
    """
    Dispatches a professional, instant email alert to the store owner
    whenever a customer places a new order. Runs in a background thread.
    """
    host_user = getattr(settings, "EMAIL_HOST_USER", "")
    host_pwd = getattr(settings, "EMAIL_HOST_PASSWORD", "")
    recipient = getattr(settings, "ADMIN_NOTIFICATION_EMAIL", "") or host_user

    # If email credentials are not set, log and skip gracefully
    if not host_user or not host_pwd:
        logger.info("Order email notification skipped: EMAIL_HOST_USER or EMAIL_HOST_PASSWORD is not configured in .env.")
        return False

    if not recipient:
        logger.warning("Order email notification skipped: No ADMIN_NOTIFICATION_EMAIL configured.")
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
    .total-card {{ background: #FAF6F0; border: 2px solid #9E2C18; border-radius: 8px; padding: 14px 18px; margin: 20px 0; display: flex; justify-content: space-between; align-items: center; }}
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

        # Dispatch in background daemon thread
        t = threading.Thread(
            target=_send_email_worker,
            args=(subject, text_body, html_body, recipient),
            daemon=True,
        )
        t.start()
        return True

    except Exception as e:
        logger.error(f"Error preparing order notification email for order {getattr(order, 'order_number', '?')}: {e}", exc_info=True)
        return False
