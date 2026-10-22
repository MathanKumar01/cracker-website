import io
from django.utils import timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT


def generate_order_pdf(order):
    """
    Generates a professional, print-ready PDF invoice for a single Order.
    Includes shop branding, customer details, itemized breakdown, and status.
    """
    buffer = io.BytesIO()
    # A4 dimensions: 595.27 x 841.89 pt. 36pt = 0.5 in margins -> width available = 523.27 pt
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    brand_style = ParagraphStyle(
        "BrandTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#9E2C18"),
    )
    tagline_style = ParagraphStyle(
        "BrandTagline",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#B8471C"),
    )
    address_style = ParagraphStyle(
        "BrandAddress",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#555555"),
    )
    doc_title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#2A160D"),
    )
    doc_sub_style = ParagraphStyle(
        "DocSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#666666"),
    )

    box_header_style = ParagraphStyle(
        "BoxHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#9E2C18"),
    )
    box_content_style = ParagraphStyle(
        "BoxContent",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#2A160D"),
    )
    box_content_bold = ParagraphStyle(
        "BoxContentBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#2A160D"),
    )

    th_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
    )
    th_right_style = ParagraphStyle(
        "TableHeaderRight",
        parent=th_style,
        alignment=TA_RIGHT,
    )
    th_center_style = ParagraphStyle(
        "TableHeaderCenter",
        parent=th_style,
        alignment=TA_CENTER,
    )

    td_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#2A160D"),
    )
    td_right_style = ParagraphStyle(
        "TableCellRight",
        parent=td_style,
        alignment=TA_RIGHT,
    )
    td_center_style = ParagraphStyle(
        "TableCellCenter",
        parent=td_style,
        alignment=TA_CENTER,
    )
    td_bold_style = ParagraphStyle(
        "TableCellBold",
        parent=td_style,
        fontName="Helvetica-Bold",
    )

    story = []

    # 1. Header Banner: Brand Info on Left, Invoice & Order Number on Right
    left_header = [
        Paragraph("🪔 THASWIKA CRACKERS", brand_style),
        Paragraph("Sivakasi Direct Fireworks · Wholesale & Retail", tagline_style),
        Paragraph("234A, Aandalpuram St, Chatrapatti Main Road, Sivakasi – 626 123", address_style),
        Paragraph("Phone / WhatsApp: +91 9943349987 · Email: sales@thaswika.store", address_style),
    ]

    status_str = (order.status or "new").upper()
    status_color = "#9E2C18"
    if status_str == "CONFIRMED":
        status_color = "#15803D"  # Green
    elif status_str in ("PACKED", "COMPLETED"):
        status_color = "#0369A1"  # Blue

    created_date = order.created_at.strftime("%d-%b-%Y %I:%M %p") if order.created_at else "N/A"

    right_header = [
        Paragraph("ORDER INVOICE", doc_title_style),
        Spacer(1, 2),
        Paragraph(f"<b>Order #:</b> {order.order_number}", doc_sub_style),
        Paragraph(f"<b>Date:</b> {created_date}", doc_sub_style),
        Paragraph(f"<b>Status:</b> <font color='{status_color}'><b>{status_str}</b></font>", doc_sub_style),
    ]

    header_table = Table(
        [[left_header, right_header]],
        colWidths=[310, 213],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(header_table)

    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#9E2C18"), spaceAfter=10))

    # 2. Customer and Delivery Info Block
    username_val = order.user.username if order.user else "Guest Customer"
    user_email_val = order.user.email if (order.user and order.user.email) else "N/A"

    customer_info = [
        Paragraph("CUSTOMER & ACCOUNT DETAILS", box_header_style),
        Spacer(1, 3),
        Paragraph(f"<b>Name:</b> {order.customer_name}", box_content_style),
        Paragraph(f"<b>Account:</b> @{username_val}", box_content_style),
        Paragraph(f"<b>Phone:</b> {order.phone}", box_content_style),
        Paragraph(f"<b>Email:</b> {user_email_val}", box_content_style),
    ]

    delivery_info = [
        Paragraph("DELIVERY ADDRESS & NOTES", box_header_style),
        Spacer(1, 3),
        Paragraph(f"<b>Shipping Address:</b><br/>{order.address.replace(chr(10), '<br/>')}", box_content_style),
    ]
    if order.notes:
        delivery_info.append(Spacer(1, 3))
        delivery_info.append(Paragraph(f"<b>Notes:</b> <i>{order.notes}</i>", box_content_style))

    info_table = Table(
        [[customer_info, delivery_info]],
        colWidths=[255, 268],
    )
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAF6F0")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5D5C5")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5D5C5")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 12))

    # 3. Order Items Table
    # Available width: 523pt
    # Col widths: # (25), Code (55), Product Name (253), Qty (40), Price (75), Subtotal (75) = 523pt
    col_widths = [25, 55, 253, 40, 75, 75]
    table_data = [
        [
            Paragraph("#", th_center_style),
            Paragraph("Code", th_center_style),
            Paragraph("Product Description", th_style),
            Paragraph("Qty", th_center_style),
            Paragraph("Rate (₹)", th_right_style),
            Paragraph("Subtotal (₹)", th_right_style),
        ]
    ]

    items = list(order.items.all())
    total_qty = 0
    for idx, item in enumerate(items, start=1):
        total_qty += item.quantity
        table_data.append([
            Paragraph(str(idx), td_center_style),
            Paragraph(str(item.product_code or "-"), td_center_style),
            Paragraph(item.product_name, td_style),
            Paragraph(str(item.quantity), td_center_style),
            Paragraph(f"₹{item.unit_price:,.2f}", td_right_style),
            Paragraph(f"₹{item.subtotal:,.2f}", td_right_style),
        ])

    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#9E2C18")),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5D5C5")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]

    # Alternating row backgrounds
    for r in range(1, len(table_data)):
        if r % 2 == 0:
            table_style.append(("BACKGROUND", (0, r), (-1, r), colors.HexColor("#FCFAF7")))
        else:
            table_style.append(("BACKGROUND", (0, r), (-1, r), colors.white))

    items_table.setStyle(TableStyle(table_style))
    story.append(items_table)
    story.append(Spacer(1, 8))

    # 4. Totals and Summary Box
    summary_data = [
        [
            Paragraph("<b>Total Items Count:</b>", td_style),
            Paragraph(f"<b>{total_qty} units ({len(items)} items)</b>", td_bold_style),
            Paragraph("<b>Grand Total:</b>", ParagraphStyle("GTLabel", parent=td_right_style, fontName="Helvetica-Bold", fontSize=11)),
            Paragraph(f"<b>₹{order.total:,.2f}</b>", ParagraphStyle("GTVal", parent=td_right_style, fontName="Helvetica-Bold", fontSize=12, textColor=colors.HexColor("#9E2C18"))),
        ]
    ]
    summary_table = Table(
        summary_data,
        colWidths=[120, 150, 120, 133],
    )
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAF6F0")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#9E2C18")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 14))

    # 5. Order Confirmation & Admin Notes
    confirmation_text = "<b>Status Note:</b> "
    if status_str == "CONFIRMED":
        confirmation_text += "<font color='#15803D'><b>This order has been verified and CONFIRMED by Thaswika Crackers Admin.</b></font> Packing and dispatch are underway."
    elif status_str == "PACKED":
        confirmation_text += "<font color='#0369A1'><b>This order has been securely packed and prepared for delivery.</b></font>"
    elif status_str == "COMPLETED":
        confirmation_text += "<font color='#15803D'><b>This order has been successfully delivered and completed.</b></font>"
    else:
        confirmation_text += "This order has been received and is pending confirmation by store admin."

    footer_box = [
        Paragraph(confirmation_text, box_content_style),
        Spacer(1, 4),
        Paragraph("<b>Payment Terms:</b> Payment accepted via GPay / PhonePe / Cash on Delivery upon order verification call.", address_style),
        Spacer(1, 4),
        Paragraph("<b>Safety Guidelines:</b> Always ignite fireworks under adult supervision in open areas. Keep a bucket of water and sand nearby. Store crackers in cool, dry places.", address_style),
        Spacer(1, 6),
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E5D5C5"), spaceAfter=6),
        Paragraph("Thank you for shopping with Thaswika Crackers Sivakasi! Wishing you and your family a safe, happy & sparkling Diwali! ✨", ParagraphStyle("TY", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.5, alignment=TA_CENTER, textColor=colors.HexColor("#9E2C18"))),
    ]

    footer_table = Table([[footer_box]], colWidths=[523])
    footer_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FCFAF7")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5D5C5")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(KeepTogether(footer_table))

    doc.build(story)
    return buffer.getvalue()
