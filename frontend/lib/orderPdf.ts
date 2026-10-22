import { jsPDF } from "jspdf";

export type OrderItem = {
  product_name: string;
  product_code?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type OrderData = {
  id?: number | string;
  order_number: string;
  customer_name: string;
  phone: string;
  address: string;
  notes?: string;
  total: number;
  status: string;
  created_at?: string;
  items?: OrderItem[];
  username?: string;
  user_email?: string;
};

const money = (n: number | string) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

function formatDate(dateStr?: string): string {
  if (!dateStr) return new Date().toLocaleDateString("en-IN");
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Generates an official, print-ready branded PDF invoice for an Order
 * entirely client-side using jsPDF.
 */
export function generateClientOrderPdf(order: OrderData, inline = false): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt
  const left = 36;
  const right = pageWidth - 36;
  const contentWidth = right - left;

  let y = 42;

  // 1. Header Banner
  // Brand title on left
  doc.setTextColor(158, 44, 24); // #9E2C18
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("THASWIKA CRACKERS", left, y);

  // Invoice label on right
  doc.setTextColor(42, 22, 13);
  doc.setFontSize(14);
  doc.text("ORDER INVOICE", right, y, { align: "right" });

  y += 16;
  doc.setTextColor(184, 71, 28); // #B8471C
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Sivakasi Direct Fireworks · Wholesale & Retail", left, y);

  // Order Number on right
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "bold");
  doc.text(`Order #: ${order.order_number}`, right, y, { align: "right" });

  y += 14;
  doc.setTextColor(90, 90, 90);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("234A, Aandalpuram St, Chatrapatti Main Road, Sivakasi - 626 123", left, y);

  const formattedDate = formatDate(order.created_at);
  doc.text(`Date: ${formattedDate}`, right, y, { align: "right" });

  y += 12;
  doc.text("Phone / WhatsApp: +91 9943349987 · Email: sales@thaswika.store", left, y);

  const statusStr = (order.status || "new").toUpperCase();
  doc.setFont("helvetica", "bold");
  if (statusStr === "CONFIRMED") {
    doc.setTextColor(21, 128, 61); // Green
  } else if (statusStr === "PACKED" || statusStr === "COMPLETED") {
    doc.setTextColor(3, 105, 161); // Blue
  } else {
    doc.setTextColor(158, 44, 24);
  }
  doc.text(`Status: ${statusStr}`, right, y, { align: "right" });

  y += 10;
  // Header underline
  doc.setDrawColor(158, 44, 24);
  doc.setLineWidth(1.5);
  doc.line(left, y, right, y);
  y += 12;

  // 2. Customer & Delivery Info Dual-Box
  const boxWidth = (contentWidth - 12) / 2;
  const boxHeight = 74;

  // Box 1: Customer Details
  doc.setFillColor(250, 246, 240); // #FAF6F0
  doc.setDrawColor(229, 213, 197); // #E5D5C5
  doc.setLineWidth(0.5);
  doc.roundedRect(left, y, boxWidth, boxHeight, 4, 4, "FD");

  doc.setTextColor(158, 44, 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("CUSTOMER DETAILS", left + 8, y + 14);

  doc.setTextColor(42, 22, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Name: ${order.customer_name || "N/A"}`, left + 8, y + 28);
  const accountStr = order.username ? `@${order.username}` : "Guest Customer";
  doc.text(`Account: ${accountStr}`, left + 8, y + 41);
  doc.text(`Phone: ${order.phone || "N/A"}`, left + 8, y + 54);
  if (order.user_email) {
    doc.text(`Email: ${order.user_email}`, left + 8, y + 66);
  }

  // Box 2: Delivery Details & Notes - explicitly re-set fill and draw colors
  const box2X = left + boxWidth + 12;
  doc.setFillColor(250, 246, 240); // #FAF6F0
  doc.setDrawColor(229, 213, 197); // #E5D5C5
  doc.setLineWidth(0.5);
  doc.roundedRect(box2X, y, boxWidth, boxHeight, 4, 4, "FD");

  doc.setTextColor(158, 44, 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("DELIVERY ADDRESS & NOTES", box2X + 8, y + 14);

  doc.setTextColor(42, 22, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const cleanAddr = (order.address || "N/A").replace(/\r/g, "");
  const addrLines = doc.splitTextToSize(cleanAddr, boxWidth - 16);
  doc.text(addrLines.slice(0, 3), box2X + 8, y + 28);

  if (order.notes) {
    const noteLines = doc.splitTextToSize(`Note: ${order.notes}`, boxWidth - 16);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text(noteLines[0] || "", box2X + 8, y + 66);
  }

  y += boxHeight + 14;

  // 3. Order Items Table
  // Column definitions: # (25), Code (50), Description (248), Qty (45), Rate (75), Subtotal (80) = 523pt
  const colX = {
    num: left + 14,
    code: left + 50,
    desc: left + 88,
    qty: left + 345,
    rate: left + 435,
    subtotal: right - 10,
  };

  // Table header background
  const tableHeaderHeight = 20;
  doc.setFillColor(158, 44, 24);
  doc.rect(left, y, contentWidth, tableHeaderHeight, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("#", colX.num, y + 13, { align: "center" });
  doc.text("Code", colX.code, y + 13, { align: "center" });
  doc.text("Product Description", colX.desc, y + 13);
  doc.text("Qty", colX.qty, y + 13, { align: "center" });
  doc.text("Rate (Rs.)", colX.rate, y + 13, { align: "right" });
  doc.text("Subtotal (Rs.)", colX.subtotal, y + 13, { align: "right" });

  y += tableHeaderHeight;

  const items = order.items || [];
  let totalQty = 0;
  const rowHeight = 18;

  items.forEach((item, idx) => {
    // Check if new page needed
    if (y + rowHeight > pageHeight - 140) {
      doc.addPage();
      y = 40;

      // Repeat table header on subsequent pages
      doc.setFillColor(158, 44, 24);
      doc.rect(left, y, contentWidth, tableHeaderHeight, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("#", colX.num, y + 13, { align: "center" });
      doc.text("Code", colX.code, y + 13, { align: "center" });
      doc.text("Product Description", colX.desc, y + 13);
      doc.text("Qty", colX.qty, y + 13, { align: "center" });
      doc.text("Rate (Rs.)", colX.rate, y + 13, { align: "right" });
      doc.text("Subtotal (Rs.)", colX.subtotal, y + 13, { align: "right" });
      y += tableHeaderHeight;
    }

    totalQty += item.quantity || 0;

    // Alternating row background
    if (idx % 2 === 1) {
      doc.setFillColor(252, 250, 247); // #FCFAF7
      doc.rect(left, y, contentWidth, rowHeight, "F");
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(left, y, contentWidth, rowHeight, "F");
    }

    // Row border bottom
    doc.setDrawColor(229, 213, 197);
    doc.setLineWidth(0.5);
    doc.line(left, y + rowHeight, right, y + rowHeight);

    // Row text
    doc.setTextColor(42, 22, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(String(idx + 1), colX.num, y + 12, { align: "center" });
    doc.text(String(item.product_code || "-"), colX.code, y + 12, { align: "center" });

    // Truncate long product names if needed
    const maxDescWidth = colX.qty - colX.desc - 10;
    const descLines = doc.splitTextToSize(item.product_name, maxDescWidth);
    doc.text(descLines[0] || item.product_name, colX.desc, y + 12);

    doc.setFont("helvetica", "bold");
    doc.text(String(item.quantity), colX.qty, y + 12, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.text(Number(item.unit_price).toFixed(2), colX.rate, y + 12, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text(Number(item.subtotal).toFixed(2), colX.subtotal, y + 12, { align: "right" });

    y += rowHeight;
  });

  y += 8;

  // 4. Totals and Summary Box
  if (y + 36 > pageHeight - 110) {
    doc.addPage();
    y = 40;
  }

  const summaryHeight = 28;
  doc.setFillColor(250, 246, 240); // #FAF6F0
  doc.setDrawColor(158, 44, 24);
  doc.setLineWidth(1);
  doc.roundedRect(left, y, contentWidth, summaryHeight, 3, 3, "FD");

  doc.setTextColor(42, 22, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Total Units Ordered:", left + 12, y + 18);

  doc.setFont("helvetica", "bold");
  doc.text(`${totalQty} units (${items.length} items)`, left + 105, y + 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Grand Total:", right - 145, y + 18);

  doc.setTextColor(158, 44, 24);
  doc.setFontSize(11);
  const totalStr = `Rs. ${Number(order.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  doc.text(totalStr, right - 12, y + 18, { align: "right" });

  y += summaryHeight + 14;

  // 5. Footer Information Box
  if (y + 80 > pageHeight - 30) {
    doc.addPage();
    y = 40;
  }

  const footerHeight = 82;
  doc.setFillColor(252, 250, 247);
  doc.setDrawColor(229, 213, 197);
  doc.setLineWidth(0.5);
  doc.roundedRect(left, y, contentWidth, footerHeight, 4, 4, "FD");

  let statusNote = "This order has been received and is pending confirmation by store admin.";
  if (statusStr === "CONFIRMED") {
    statusNote = "This order has been verified and CONFIRMED by Thaswika Crackers Admin. Packing and dispatch underway.";
  } else if (statusStr === "PACKED") {
    statusNote = "This order has been securely packed and prepared for delivery / dispatch.";
  } else if (statusStr === "COMPLETED") {
    statusNote = "This order has been successfully delivered and completed.";
  }

  doc.setTextColor(158, 44, 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Status Note: ", left + 8, y + 15);

  doc.setTextColor(42, 22, 13);
  doc.setFont("helvetica", "normal");
  const noteRender = doc.splitTextToSize(statusNote, contentWidth - 75);
  doc.text(noteRender[0] || statusNote, left + 65, y + 15);

  doc.setTextColor(90, 90, 90);
  doc.setFontSize(7.5);
  doc.text(
    "Payment Terms: Payment accepted via GPay / PhonePe / Cash on Delivery upon order verification call.",
    left + 8,
    y + 30
  );
  doc.text(
    "Safety Guidelines: Always ignite fireworks under adult supervision in open areas. Keep water and sand nearby.",
    left + 8,
    y + 44
  );

  doc.setDrawColor(229, 213, 197);
  doc.setLineWidth(0.5);
  doc.line(left + 8, y + 54, right - 8, y + 54);

  doc.setTextColor(158, 44, 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(
    "Thank you for shopping with Thaswika Crackers Sivakasi! Wishing you and your family a safe, sparkling Diwali!",
    pageWidth / 2,
    y + 69,
    { align: "center" }
  );

  // Deliver result to user
  const filename = `Order-${order.order_number}.pdf`;
  if (inline) {
    const blob = doc.output("blob");
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
  } else {
    doc.save(filename);
  }
}

/**
 * Opens a dedicated, beautifully formatted printable invoice in a popup window
 * and immediately triggers the browser's print dialog (allowing 1-click Print or Save to PDF).
 */
export function printOrderInvoice(order: OrderData): void {
  const statusStr = (order.status || "new").toUpperCase();
  const statusColor =
    statusStr === "CONFIRMED"
      ? "#15803d"
      : statusStr === "PACKED" || statusStr === "COMPLETED"
      ? "#0369a1"
      : "#9e2c18";

  const itemsHtml = (order.items || [])
    .map(
      (item, idx) => `
      <tr style="background:${idx % 2 === 1 ? "#faf6f0" : "#ffffff"};">
        <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #e5d5c5;font-size:11px;">${idx + 1}</td>
        <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #e5d5c5;font-size:11px;font-family:monospace;">${
          item.product_code || "-"
        }</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5d5c5;font-size:11px;font-weight:500;">${
          item.product_name
        }</td>
        <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #e5d5c5;font-size:11px;font-weight:bold;">${
          item.quantity
        }</td>
        <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5d5c5;font-size:11px;">${money(
          item.unit_price
        )}</td>
        <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5d5c5;font-size:11px;font-weight:bold;">${money(
          item.subtotal
        )}</td>
      </tr>
    `
    )
    .join("");

  const totalQty = (order.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice - Order #${order.order_number}</title>
  <style>
    @media print {
      body { margin: 0; padding: 12mm; }
      @page { size: A4; margin: 10mm; }
      .no-print { display: none !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #2a160d;
      margin: 0;
      padding: 24px;
      background: #fdfbf7;
    }
    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 32px;
      border: 1px solid #e5d5c5;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.06);
    }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .brand-title { color: #9e2c18; font-size: 22px; font-weight: 800; margin: 0; }
    .brand-sub { color: #b8471c; font-size: 11px; font-weight: 700; margin: 3px 0; }
    .brand-addr { color: #666; font-size: 10px; margin: 1px 0; }
    .invoice-title { font-size: 18px; font-weight: 800; color: #2a160d; margin: 0; text-align: right; }
    .invoice-meta { font-size: 11px; color: #555; text-align: right; margin: 2px 0; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-weight: bold; font-size: 10px; color: white; background: ${statusColor}; }
    .grid { display: flex; gap: 16px; margin: 16px 0; }
    .info-box { flex: 1; background: #faf6f0; border: 1px solid #e5d5c5; border-radius: 8px; padding: 12px; font-size: 11px; }
    .box-title { color: #9e2c18; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; }
    table.items { width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #e5d5c5; }
    table.items th { background: #9e2c18; color: white; font-size: 11px; padding: 8px; text-transform: uppercase; }
    .summary-box { background: #faf6f0; border: 2px solid #9e2c18; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin: 16px 0; }
    .footer-box { background: #fcfaf7; border: 1px solid #e5d5c5; border-radius: 8px; padding: 12px; font-size: 10px; color: #666; margin-top: 16px; }
    .actions { text-align: center; margin-bottom: 20px; }
    .btn { background: #9e2c18; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; }
    .btn:hover { background: #7a2213; }
  </style>
</head>
<body>
  <div class="actions no-print">
    <button class="btn" onclick="window.print()">🖨️ Print Invoice / Save as PDF</button>
  </div>

  <div class="invoice-card">
    <table class="header-table">
      <tr>
        <td style="vertical-align: top;">
          <h1 class="brand-title">🪔 THASWIKA CRACKERS</h1>
          <p class="brand-sub">Sivakasi Direct Fireworks · Wholesale & Retail</p>
          <p class="brand-addr">234A, Aandalpuram St, Chatrapatti Main Road, Sivakasi – 626 123</p>
          <p class="brand-addr">Phone / WhatsApp: +91 9943349987 · Email: sales@thaswika.store</p>
        </td>
        <td style="vertical-align: top; text-align: right;">
          <h2 class="invoice-title">ORDER INVOICE</h2>
          <p class="invoice-meta"><b>Order #:</b> ${order.order_number}</p>
          <p class="invoice-meta"><b>Date:</b> ${formatDate(order.created_at)}</p>
          <p class="invoice-meta"><b>Status:</b> <span class="badge">${statusStr}</span></p>
        </td>
      </tr>
    </table>

    <hr style="border:none;border-top:2px solid #9e2c18;margin:12px 0;">

    <div class="grid">
      <div class="info-box">
        <div class="box-title">👤 Customer Details</div>
        <div><b>Name:</b> ${order.customer_name || "N/A"}</div>
        <div><b>Account:</b> ${order.username ? `@${order.username}` : "Guest Customer"}</div>
        <div><b>Phone:</b> ${order.phone || "N/A"}</div>
        ${order.user_email ? `<div><b>Email:</b> ${order.user_email}</div>` : ""}
      </div>
      <div class="info-box">
        <div class="box-title">📍 Delivery Address & Notes</div>
        <div style="white-space: pre-wrap;"><b>Address:</b> ${order.address || "N/A"}</div>
        ${order.notes ? `<div style="margin-top:6px;font-style:italic;"><b>Note:</b> ${order.notes}</div>` : ""}
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th style="width:30px;">#</th>
          <th style="width:60px;">Code</th>
          <th style="text-align:left;">Product Description</th>
          <th style="width:50px;">Qty</th>
          <th style="width:90px;text-align:right;">Rate</th>
          <th style="width:90px;text-align:right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="summary-box">
      <div>
        <span style="font-size:12px;color:#555;">Total Ordered:</span>
        <strong style="font-size:13px;margin-left:6px;">${totalQty} units (${(order.items || []).length} items)</strong>
      </div>
      <div>
        <span style="font-size:13px;color:#555;">Grand Total:</span>
        <strong style="font-size:18px;color:#9e2c18;margin-left:8px;">${money(order.total)}</strong>
      </div>
    </div>

    <div class="footer-box">
      <p style="margin:0 0 4px 0;font-weight:bold;color:#9e2c18;">Status Note: ${
        statusStr === "CONFIRMED"
          ? "This order has been verified and confirmed by Thaswika Crackers admin."
          : "Order received and being processed."
      }</p>
      <p style="margin:2px 0;"><b>Payment:</b> GPay / PhonePe / Cash on Delivery accepted on verification call.</p>
      <p style="margin:2px 0;"><b>Safety Notice:</b> Always ignite fireworks under adult supervision in open areas.</p>
      <p style="margin:8px 0 0 0;text-align:center;font-weight:bold;color:#9e2c18;font-size:11px;">
        Thank you for shopping with Thaswika Crackers Sivakasi! Wishing you a sparkling Diwali! ✨
      </p>
    </div>
  </div>

  <script>
    // Automatically trigger print dialog when page loads
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    // If popup blocked, generate PDF download fallback
    generateClientOrderPdf(order, false);
  }
}
