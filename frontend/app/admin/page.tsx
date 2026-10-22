"use client";
import { useEffect, useState, useMemo } from "react";
import { getApiUrl, getApiErrorMessage } from "../../lib/api";
import { generateClientOrderPdf, printOrderInvoice } from "../../lib/orderPdf";

const API = getApiUrl();

type OrderItem = {
  product_name: string;
  product_code?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type Order = {
  id: number;
  order_number: string;
  customer_name: string;
  phone: string;
  address: string;
  notes: string;
  total: number;
  status: string;
  created_at: string;
  items: OrderItem[];
  username?: string;
  user_email?: string;
};

const money = (n: number) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  // Verified authentication credentials:
  const [adminKey, setAdminKey] = useState("");
  const [token, setToken] = useState("");
  const [verifiedUsername, setVerifiedUsername] = useState("");

  // Input states for login forms:
  const [inputKey, setInputKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authMethod, setAuthMethod] = useState<"api_key" | "credentials">("api_key");

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Only consider authenticated when a verified key or token is set
  const isAuthenticated = Boolean(adminKey || token);

  // Load verified credentials from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem("kathiravan_admin_key") || localStorage.getItem("sakthi_admin_key") || "";
    const savedToken = localStorage.getItem("kathiravan_token") || localStorage.getItem("sakthi_token") || "";
    const savedUser = localStorage.getItem("kathiravan_username") || localStorage.getItem("sakthi_username") || "";

    if (savedKey) {
      setAdminKey(savedKey);
      setInputKey(savedKey);
      setAuthMethod("api_key");
    } else if (savedToken) {
      setToken(savedToken);
      setVerifiedUsername(savedUser);
      setUsername(savedUser);
      setAuthMethod("credentials");
    }
  }, []);

  // Helper to build headers with either verified Admin Key or Token
  function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (adminKey) {
      headers["X-Admin-Key"] = adminKey;
    } else if (token) {
      headers["Authorization"] = `Token ${token}`;
    }
    return headers;
  }

  // Load orders when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadOrders();
    }
  }, [adminKey, token]);

  // Sign in with Admin API Key
  async function loginWithApiKey(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const keyToVerify = inputKey.trim();
    if (!keyToVerify) {
      setError("Please enter the Admin API Key.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch(`${API}/auth/admin-verify/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: keyToVerify }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Invalid Admin API Key.");
      }

      localStorage.setItem("kathiravan_admin_key", keyToVerify);
      localStorage.setItem("sakthi_admin_key", keyToVerify);
      setAdminKey(keyToVerify);
      setSuccessMsg("Admin API Key verified successfully!");
    } catch (err) {
      setError(getApiErrorMessage(err, API));
    } finally {
      setLoading(false);
    }
  }

  // Sign in with Django Staff Username & Password
  async function loginWithCredentials(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch(`${API}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Invalid username or password.");
      }
      if (!data.is_staff) {
        throw new Error("This user is not marked as Django staff/admin.");
      }

      localStorage.setItem("kathiravan_token", data.token);
      localStorage.setItem("kathiravan_username", data.username);
      localStorage.setItem("sakthi_token", data.token);
      localStorage.setItem("sakthi_username", data.username);
      setToken(data.token);
      setVerifiedUsername(data.username);
      setPassword("");
      setSuccessMsg("Logged in successfully as " + data.username);
    } catch (err) {
      setError(getApiErrorMessage(err, API));
    } finally {
      setLoading(false);
    }
  }

  // Load orders
  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/admin/orders/`, {
        headers: getAuthHeaders(),
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error("Admin session expired or access was denied.");
      }
      if (!res.ok) {
        throw new Error(`Failed to load orders (HTTP ${res.status}).`);
      }
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      setError(getApiErrorMessage(err, API));
    } finally {
      setLoading(false);
    }
  }

  // Update order status (e.g. Confirmed, Packed, etc.)
  async function updateStatus(id: number, newStatus: string) {
    try {
      const res = await fetch(`${API}/admin/orders/${id}/`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        throw new Error(`Could not update order status (HTTP ${res.status}).`);
      }
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: updated.status } : o)));
      setSuccessMsg(`Order #${updated.order_number} status updated to "${updated.status.toUpperCase()}"!`);
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed.");
    }
  }

  // Delete an order
  async function deleteOrder(order: Order) {
    if (!window.confirm(`Delete order ${order.order_number}? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`${API}/admin/orders/${order.id}/`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Failed to delete order (HTTP ${res.status}).`);
      }
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      setSuccessMsg(`Order #${order.order_number} deleted successfully.`);
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  // Download Excel (.xlsx) with ALL orders
  async function downloadExcel() {
    setExportingExcel(true);
    setError("");
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API}/admin/orders/export-excel/`, { headers });
      if (!res.ok) {
        throw new Error(`Excel export failed (HTTP ${res.status}).`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `thaswika-crackers-all-orders-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSuccessMsg("Master Excel workbook (.xlsx) with all orders downloaded successfully!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Excel export failed.");
    } finally {
      setExportingExcel(false);
    }
  }

  // Download PDF for individual order of one user
  async function downloadOrderPdf(order: Order, inline = false) {
    setDownloadingPdfId(order.id);
    setError("");

    // If inline/print preview is requested, trigger dedicated invoice print window immediately
    if (inline) {
      try {
        printOrderInvoice(order);
      } catch (err) {
        console.warn("Print preview popup failed, generating PDF file...", err);
        generateClientOrderPdf(order, false);
      } finally {
        setDownloadingPdfId(null);
      }
      return;
    }

    try {
      const headers = getAuthHeaders();
      const orderIdOrNum = order.id || order.order_number;
      const endpoint = `${API}/admin/orders/${orderIdOrNum}/pdf/`;
      const res = await fetch(endpoint, { headers });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Order-${order.order_number}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setSuccessMsg(`Order #${order.order_number} PDF downloaded successfully!`);
        setTimeout(() => setSuccessMsg(""), 3500);
        return;
      }

      // If backend returns 404 (e.g. backend redeploying or route unavailable) or any error:
      console.warn(`Backend PDF returned HTTP ${res.status}. Falling back to instant client-side PDF invoice generation.`);
      generateClientOrderPdf(order, false);
      setSuccessMsg(`Order #${order.order_number} PDF invoice generated and downloaded!`);
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      console.warn("Backend PDF fetch error, generating PDF client-side:", err);
      try {
        generateClientOrderPdf(order, false);
        setSuccessMsg(`Order #${order.order_number} PDF invoice generated and downloaded!`);
        setTimeout(() => setSuccessMsg(""), 3500);
      } catch (clientErr) {
        setError(clientErr instanceof Error ? clientErr.message : "PDF generation failed.");
      }
    } finally {
      setDownloadingPdfId(null);
    }
  }

  // Export CSV download fallback
  function downloadCsv() {
    const csvRows = [
      ["Order #", "Date", "Customer Username", "Customer Name", "Phone", "Address", "Notes", "Total Items Qty", "Products", "Total (Rs)", "Status"],
      ...orders.map((o) => [
        o.order_number,
        o.created_at,
        o.username || "Guest",
        o.customer_name,
        o.phone,
        o.address,
        o.notes || "",
        o.items.reduce((s, i) => s + i.quantity, 0),
        o.items.map((i) => `${i.product_name} x ${i.quantity}`).join("; "),
        o.total,
        o.status,
      ]),
    ];

    const csvContent = csvRows
      .map((row) => row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\r\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `thaswika-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Sign out cleanly
  function logout() {
    localStorage.removeItem("kathiravan_admin_key");
    localStorage.removeItem("kathiravan_token");
    localStorage.removeItem("kathiravan_username");
    localStorage.removeItem("sakthi_admin_key");
    localStorage.removeItem("sakthi_token");
    localStorage.removeItem("sakthi_username");
    setAdminKey("");
    setInputKey("");
    setToken("");
    setVerifiedUsername("");
    setUsername("");
    setPassword("");
    setOrders([]);
    setError("");
    setSuccessMsg("");
  }

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesStatus = statusFilter === "all" || o.status.toLowerCase() === statusFilter.toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        (o.username && o.username.toLowerCase().includes(q)) ||
        o.phone.toLowerCase().includes(q) ||
        o.address.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, searchQuery]);

  // Statistics
  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + Number(o.total || 0), 0), [orders]);
  const newOrdersCount = useMemo(() => orders.filter((o) => o.status === "new").length, [orders]);
  const confirmedCount = useMemo(() => orders.filter((o) => o.status === "confirmed").length, [orders]);

  // LOGIN SCREEN (renders when not authenticated)
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#fffaf2] p-4 sm:p-8 flex items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-orange-100 bg-white p-7 shadow-xl shadow-amber-900/5">
          <div className="flex items-center justify-between">
            <a href="/" className="text-sm font-bold text-[#a52b18] hover:underline flex items-center gap-1">
              ← Back to Storefront
            </a>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-[#a52b18]">
              Admin Portal
            </span>
          </div>

          <h1 className="mt-6 text-3xl font-black text-stone-900">Thaswika Admin</h1>
          <p className="mt-1 text-sm text-stone-600">
            Authenticate to review customer orders, confirm orders, export Excel, and generate PDF invoices.
          </p>

          {/* Tab Switcher */}
          <div className="mt-6 flex rounded-xl bg-orange-50 p-1 border border-orange-100">
            <button
              type="button"
              onClick={() => {
                setAuthMethod("api_key");
                setError("");
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-extrabold transition ${
                authMethod === "api_key"
                  ? "bg-white text-[#a52b18] shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              🔑 Admin API Key
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod("credentials");
                setError("");
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-extrabold transition ${
                authMethod === "credentials"
                  ? "bg-white text-[#a52b18] shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              👤 Staff Username
            </button>
          </div>

          {/* Form */}
          {authMethod === "api_key" ? (
            <form onSubmit={loginWithApiKey} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Admin API Key
                </label>
                <input
                  type="password"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="Enter your Admin API Key"
                  className="w-full rounded-xl border border-orange-200 bg-white p-3.5 text-stone-900 outline-none focus:border-[#a52b18] focus:ring-2 focus:ring-orange-200 text-sm font-mono"
                  autoFocus
                />
                <p className="mt-1.5 text-xs text-stone-500">
                  Enter your store&apos;s secure Admin API Key to access the dashboard.
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#a52b18] p-3.5 text-sm font-black text-white shadow-md hover:bg-[#8e2414] transition disabled:opacity-50"
              >
                {loading ? "Verifying key..." : "Sign in with API Key →"}
              </button>
            </form>
          ) : (
            <form onSubmit={loginWithCredentials} className="mt-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Staff Username
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Admin username"
                  className="w-full rounded-xl border border-orange-200 bg-white p-3.5 text-stone-900 outline-none focus:border-[#a52b18] focus:ring-2 focus:ring-orange-200 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Staff password"
                  className="w-full rounded-xl border border-orange-200 bg-white p-3.5 text-stone-900 outline-none focus:border-[#a52b18] focus:ring-2 focus:ring-orange-200 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#a52b18] p-3.5 text-sm font-black text-white shadow-md hover:bg-[#8e2414] transition disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign in with Username →"}
              </button>
            </form>
          )}

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs font-medium text-red-800">
              ⚠️ {error}
            </div>
          )}

          <div className="mt-6 border-t border-orange-100 pt-4 text-center">
            <p className="text-xs text-stone-500">
              Thaswika Crackers Sivakasi · Secured Django REST API
            </p>
          </div>
        </div>
      </main>
    );
  }

  // AUTHENTICATED DASHBOARD
  return (
    <main className="min-h-screen bg-[#fffaf2] p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-orange-200/60 pb-4">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="inline-flex items-center gap-1 text-sm font-bold text-[#a52b18] hover:underline"
            >
              ← Storefront
            </a>
            <span className="text-stone-300">|</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
              ● Connected: {adminKey ? "API Key Mode" : `Staff (${verifiedUsername})`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={loadOrders}
              disabled={loading}
              className="rounded-xl border border-orange-200 bg-white px-3.5 py-2 text-xs font-bold text-stone-700 hover:bg-orange-50 disabled:opacity-50 shadow-sm"
            >
              🔄 {loading ? "Refreshing..." : "Refresh"}
            </button>

            {/* DOWNLOAD EXCEL WITH ALL ORDERS */}
            <button
              onClick={downloadExcel}
              disabled={exportingExcel || !orders.length}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-800 disabled:opacity-40 flex items-center gap-1.5 transition"
              title="Download Microsoft Excel spreadsheet (.xlsx) containing all orders"
            >
              <span>📊</span>
              <span>{exportingExcel ? "Generating Excel..." : `Download Excel (.xlsx)`}</span>
            </button>

            {/* CSV Export Option */}
            <button
              onClick={downloadCsv}
              disabled={!orders.length}
              className="rounded-xl bg-[#2a160d] px-3.5 py-2 text-xs font-extrabold text-[#ffe7b0] shadow-sm hover:bg-[#3d2013] disabled:opacity-40"
            >
              📥 CSV ({orders.length})
            </button>

            <button
              onClick={logout}
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Dashboard Title & Stats */}
        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-[.25em] text-[#b8471c]">Store Management</p>
          <h1 className="mt-1 text-3xl font-black text-stone-900">Diwali Order Management</h1>
        </div>

        {/* Stats Row */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Total Orders</p>
            <p className="mt-1 text-2xl font-black text-stone-900">{orders.length}</p>
          </div>
          <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">New / Pending</p>
            <p className="mt-1 text-2xl font-black text-amber-600">{newOrdersCount}</p>
          </div>
          <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Confirmed Orders</p>
            <p className="mt-1 text-2xl font-black text-emerald-700">{confirmedCount}</p>
          </div>
          <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Total Sales Value</p>
            <p className="mt-1 text-2xl font-black text-[#a52b18]">{money(totalRevenue)}</p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mt-5 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm font-medium text-red-800">
            ⚠️ {error}
          </div>
        )}
        {successMsg && (
          <div className="mt-5 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-medium text-emerald-800">
            ✓ {successMsg}
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {["all", "new", "confirmed", "packed", "completed", "cancelled"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-4 py-1.5 text-xs font-extrabold capitalize transition ${
                  statusFilter === s
                    ? "bg-[#a52b18] text-white shadow-sm"
                    : "border border-orange-200 bg-white text-stone-700 hover:border-orange-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders, username, phone, customer..."
            className="w-full sm:w-80 rounded-xl border border-orange-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#a52b18]"
          />
        </div>

        {/* Orders List */}
        <div className="mt-6 grid gap-4">
          {filteredOrders.map((o) => {
            const isConfirmed = o.status.toLowerCase() === "confirmed";
            return (
              <article
                key={o.id}
                className="rounded-3xl border border-orange-100 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition"
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="rounded-lg bg-orange-100 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-[#a52b18]">
                        {o.order_number}
                      </span>
                      {o.username && (
                        <span className="rounded-lg bg-amber-100/70 border border-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
                          👤 @{o.username}
                        </span>
                      )}
                      <span className="text-xs text-stone-500">
                        {new Date(o.created_at).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <h2 className="mt-2 text-xl font-black text-stone-900">{o.customer_name}</h2>
                    <p className="mt-1 text-sm font-bold text-stone-700 flex items-center gap-2">
                      📞 <a href={`tel:${o.phone}`} className="hover:underline">{o.phone}</a>
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600 bg-[#fffaf5] p-3 rounded-xl border border-orange-100/60">
                      📍 {o.address}
                    </p>
                    {o.notes && (
                      <p className="mt-2 text-xs italic text-stone-500">
                        📝 Customer note: {o.notes}
                      </p>
                    )}
                  </div>

                  <div className="sm:text-right shrink-0 flex flex-col sm:items-end">
                    <p className="text-3xl font-black text-[#a52b18]">{money(o.total)}</p>

                    {/* CONFIRM ORDER ONE-CLICK BUTTON & STATUS SELECTOR */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {!isConfirmed && o.status !== "completed" && (
                        <button
                          onClick={() => updateStatus(o.id, "confirmed")}
                          className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-700 shadow-sm transition flex items-center gap-1"
                        >
                          <span>✅</span>
                          <span>Confirm Order</span>
                        </button>
                      )}

                      {isConfirmed && (
                        <span className="rounded-xl bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <span>✅</span>
                          <span>Confirmed</span>
                        </span>
                      )}

                      <select
                        value={o.status}
                        onChange={(e) => updateStatus(o.id, e.target.value)}
                        className="rounded-xl border border-orange-200 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-800 shadow-sm outline-none focus:border-[#a52b18]"
                      >
                        <option value="new">🆕 New</option>
                        <option value="confirmed">✅ Confirmed</option>
                        <option value="packed">📦 Packed</option>
                        <option value="completed">🎉 Completed</option>
                        <option value="cancelled">❌ Cancelled</option>
                      </select>
                    </div>

                    {/* PDF FORMAT OF EACH USER'S ORDER */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => downloadOrderPdf(o, false)}
                        disabled={downloadingPdfId === o.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50/50 px-3 py-1.5 text-xs font-bold text-[#a52b18] hover:bg-orange-100 transition shadow-sm disabled:opacity-50"
                        title="Download printable PDF order invoice"
                      >
                        <span>📄</span>
                        <span>{downloadingPdfId === o.id ? "Generating PDF..." : "Order PDF"}</span>
                      </button>

                      <button
                        onClick={() => downloadOrderPdf(o, true)}
                        className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-50 transition shadow-sm"
                        title="View / Print PDF in new tab"
                      >
                        <span>🖨️</span>
                        <span>Print</span>
                      </button>

                      <button
                        onClick={() => deleteOrder(o)}
                        className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline ml-1"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="mt-5 border-t border-orange-100 pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                    Order Items ({o.items?.length || 0}) · Total Units: {o.items?.reduce((s, i) => s + i.quantity, 0)}
                  </p>
                  <div className="divide-y divide-orange-50 bg-[#fffdfa] rounded-xl border border-orange-100 p-2 sm:p-3">
                    {o.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 text-sm">
                        <span className="font-medium text-stone-800">
                          {item.product_name}{" "}
                          {item.product_code && (
                            <span className="text-xs font-mono text-stone-400">[{item.product_code}]</span>
                          )}{" "}
                          <span className="font-bold text-[#b8471c]">× {item.quantity}</span>
                        </span>
                        <span className="font-bold text-stone-900">{money(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}

          {!loading && filteredOrders.length === 0 && (
            <div className="rounded-3xl border border-dashed border-orange-200 bg-white p-12 text-center text-stone-500">
              <p className="text-3xl">🪔</p>
              <p className="mt-2 text-base font-bold text-stone-700">No orders found.</p>
              <p className="text-xs text-stone-500 mt-1">
                {orders.length === 0
                  ? "Orders placed by customers on your website will appear here in real time."
                  : "No orders match the current filter or search criteria."}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
