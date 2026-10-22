"use client";
import { useState, useEffect } from "react";
import { getApiUrl, getApiErrorMessage } from "../../lib/api";
import { generateClientOrderPdf } from "../../lib/orderPdf";

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
  notes?: string;
  total: number;
  status: string;
  created_at: string;
  items: OrderItem[];
};

const money = (n: number) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function Account() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Authenticated state
  const [loggedInUser, setLoggedInUser] = useState("");
  const [token, setToken] = useState("");
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState<number | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("kathiravan_token") || localStorage.getItem("sakthi_token") || "";
    const savedUser = localStorage.getItem("kathiravan_username") || localStorage.getItem("sakthi_username") || "";
    if (savedToken) {
      setToken(savedToken);
      setLoggedInUser(savedUser);
      loadMyOrders(savedToken);
    }
  }, []);

  async function loadMyOrders(authToken: string) {
    setOrdersLoading(true);
    try {
      const res = await fetch(`${API}/orders/my-orders/`, {
        headers: {
          Authorization: `Token ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setMyOrders(data);
      }
    } catch {
      // Ignored
    } finally {
      setOrdersLoading(false);
    }
  }

  async function downloadInvoicePdf(order: Order) {
    if (!token) return;
    setDownloadingPdfId(order.id);
    try {
      const orderIdOrNum = order.id || order.order_number;
      const res = await fetch(`${API}/orders/${orderIdOrNum}/pdf/`, {
        headers: {
          Authorization: `Token ${token}`,
        },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Order-${order.order_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }
      // If backend returns 404 or fails, fall back to instant client-side generation
      console.warn(`Backend PDF returned HTTP ${res.status}. Falling back to client-side PDF generation.`);
      generateClientOrderPdf(order, false);
    } catch (err) {
      console.warn("Backend PDF fetch error, generating client-side:", err);
      try {
        generateClientOrderPdf(order, false);
      } catch (clientErr) {
        alert(clientErr instanceof Error ? clientErr.message : "PDF download failed.");
      }
    } finally {
      setDownloadingPdfId(null);
    }
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const endpoint = isRegister ? "/auth/register/" : "/auth/login/";
      const payload: Record<string, string> = { username: username.trim(), password };
      if (isRegister && email.trim()) {
        payload.email = email.trim();
      }

      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed.");
      }

      localStorage.setItem("kathiravan_token", data.token);
      localStorage.setItem("kathiravan_username", data.username);
      localStorage.setItem("sakthi_token", data.token);
      localStorage.setItem("sakthi_username", data.username);
      setToken(data.token);
      setLoggedInUser(data.username);
      setPassword("");
      loadMyOrders(data.token);
    } catch (err) {
      setError(getApiErrorMessage(err, API));
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("kathiravan_token");
    localStorage.removeItem("kathiravan_username");
    localStorage.removeItem("sakthi_token");
    localStorage.removeItem("sakthi_username");
    setToken("");
    setLoggedInUser("");
    setMyOrders([]);
  }

  // LOGGED IN DASHBOARD
  if (token) {
    return (
      <main className="min-h-screen bg-[#fffaf2] p-4 sm:p-8">
        <div className="mx-auto max-w-4xl">
          {/* Header navigation */}
          <div className="flex items-center justify-between border-b border-orange-200/60 pb-4">
            <a href="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#a52b18] hover:underline">
              ← Back to Storefront
            </a>
            <div className="flex items-center gap-3">
              <button
                onClick={() => loadMyOrders(token)}
                disabled={ordersLoading}
                className="rounded-xl border border-orange-200 bg-white px-3.5 py-1.5 text-xs font-bold text-stone-700 hover:bg-orange-50 disabled:opacity-50"
              >
                🔄 {ordersLoading ? "Refreshing..." : "Refresh Status"}
              </button>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
              >
                Sign out
              </button>
            </div>
          </div>

          {/* Account Profile Card */}
          <div className="mt-6 rounded-3xl border border-orange-100 bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#b8471c]">Customer Profile</p>
                <h1 className="mt-1 text-3xl font-black text-stone-900">Welcome, {loggedInUser}!</h1>
                <p className="mt-1 text-sm text-stone-600">
                  Track your ordered products, view live admin confirmation status, and download PDF invoices.
                </p>
              </div>
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-2xl bg-[#a52b18] px-5 py-3 text-sm font-black text-white hover:bg-[#8e2414] shadow-md transition"
              >
                🛒 Shop Diwali Crackers
              </a>
            </div>
          </div>

          {/* Orders Section */}
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-stone-900">Your Diwali Orders</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  All orders placed with your account are saved here with live status updates.
                </p>
              </div>
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-[#a52b18]">
                {myOrders.length} {myOrders.length === 1 ? "Order" : "Orders"}
              </span>
            </div>

            {ordersLoading && myOrders.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-orange-100 bg-white p-12 text-center text-stone-500">
                <p className="animate-spin text-3xl">✨</p>
                <p className="mt-3 text-sm font-bold text-stone-700">Loading your orders...</p>
              </div>
            ) : myOrders.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-orange-200 bg-white p-10 text-center text-stone-500">
                <p className="text-4xl">🎆</p>
                <p className="mt-3 text-base font-bold text-stone-800">No orders placed yet under this account.</p>
                <p className="mt-1 text-xs text-stone-500 max-w-md mx-auto">
                  Browse our Sivakasi catalogue, add your favourite fireworks to your cart, and place an order!
                </p>
                <a
                  href="/#catalog"
                  className="mt-5 inline-block rounded-full bg-[#a52b18] px-6 py-2.5 text-xs font-black text-white shadow-md hover:bg-[#8e2414]"
                >
                  Browse Catalogue →
                </a>
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                {myOrders.map((o) => {
                  const isConfirmed = o.status.toLowerCase() === "confirmed";
                  const isPacked = o.status.toLowerCase() === "packed";
                  const isCompleted = o.status.toLowerCase() === "completed";
                  const isCancelled = o.status.toLowerCase() === "cancelled";
                  const isNew = o.status.toLowerCase() === "new";

                  return (
                    <article
                      key={o.id}
                      className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm hover:shadow-md transition"
                    >
                      {/* Top Bar: Order number & Date & Amount */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-orange-50 pb-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-xl bg-orange-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-[#a52b18]">
                            {o.order_number}
                          </span>
                          <span className="text-xs text-stone-500">
                            Placed on{" "}
                            {new Date(o.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-black text-[#a52b18]">{money(o.total)}</span>
                          <button
                            onClick={() => downloadInvoicePdf(o)}
                            disabled={downloadingPdfId === o.id}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50/60 px-3 py-1.5 text-xs font-extrabold text-[#a52b18] hover:bg-orange-100 disabled:opacity-50 transition"
                          >
                            <span>📄</span>
                            <span>{downloadingPdfId === o.id ? "Downloading..." : "PDF Invoice"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Admin Confirmation Banner */}
                      {isConfirmed && (
                        <div className="mt-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-4 text-white shadow-md">
                          <div className="flex items-center gap-2 font-black text-sm sm:text-base">
                            <span className="text-lg">🎉</span>
                            <span>ORDER CONFIRMED BY ADMIN!</span>
                          </div>
                          <p className="mt-1 text-xs text-emerald-50 leading-relaxed font-medium">
                            Thaswika Crackers admin has verified and confirmed your order. Your crackers are now being packed for dispatch!
                          </p>
                        </div>
                      )}

                      {isPacked && (
                        <div className="mt-4 rounded-2xl bg-sky-600 p-4 text-white shadow-md">
                          <div className="flex items-center gap-2 font-black text-sm">
                            <span className="text-lg">📦</span>
                            <span>ORDER PACKED & READY</span>
                          </div>
                          <p className="mt-1 text-xs text-sky-100 leading-relaxed">
                            Your Diwali cracker box has been packed securely and is prepared for delivery.
                          </p>
                        </div>
                      )}

                      {isCompleted && (
                        <div className="mt-4 rounded-2xl bg-emerald-800 p-4 text-white shadow-md">
                          <div className="flex items-center gap-2 font-black text-sm">
                            <span className="text-lg">✨</span>
                            <span>ORDER COMPLETED & DELIVERED</span>
                          </div>
                          <p className="mt-1 text-xs text-emerald-100 leading-relaxed">
                            This order has been completed. Happy & safe Diwali from Thaswika Crackers!
                          </p>
                        </div>
                      )}

                      {isNew && (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-stone-800">
                          <div className="flex items-center gap-2 font-black text-xs text-amber-900">
                            <span>⏳</span>
                            <span>Awaiting Admin Confirmation</span>
                          </div>
                          <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                            We have received your order! Admin will review your cracker selection and confirm the order shortly.
                          </p>
                        </div>
                      )}

                      {isCancelled && (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-stone-800">
                          <div className="flex items-center gap-2 font-black text-xs text-red-900">
                            <span>❌</span>
                            <span>Order Cancelled</span>
                          </div>
                        </div>
                      )}

                      {/* Visual Status Progress Tracker */}
                      {!isCancelled && (
                        <div className="mt-4 grid grid-cols-4 gap-1.5 text-center text-[11px] font-bold">
                          <div className="rounded-xl bg-emerald-100 p-2 text-emerald-900">
                            <span>✓</span> Placed
                          </div>
                          <div
                            className={`rounded-xl p-2 transition ${
                              isConfirmed || isPacked || isCompleted
                                ? "bg-emerald-600 text-white font-black shadow-sm"
                                : "bg-stone-100 text-stone-400"
                            }`}
                          >
                            {isConfirmed || isPacked || isCompleted ? "✓ " : ""}Confirmed
                          </div>
                          <div
                            className={`rounded-xl p-2 transition ${
                              isPacked || isCompleted
                                ? "bg-emerald-600 text-white font-black shadow-sm"
                                : "bg-stone-100 text-stone-400"
                            }`}
                          >
                            {isPacked || isCompleted ? "✓ " : ""}Packed
                          </div>
                          <div
                            className={`rounded-xl p-2 transition ${
                              isCompleted
                                ? "bg-emerald-600 text-white font-black shadow-sm"
                                : "bg-stone-100 text-stone-400"
                            }`}
                          >
                            {isCompleted ? "✓ " : ""}Completed
                          </div>
                        </div>
                      )}

                      {/* Customer & Delivery Information */}
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#fffaf5] p-3.5 rounded-2xl border border-orange-100/60">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Recipient</p>
                          <p className="font-extrabold text-stone-800 mt-0.5">{o.customer_name}</p>
                          <p className="text-stone-600 font-semibold mt-0.5">📞 {o.phone}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Delivery Address</p>
                          <p className="font-medium text-stone-700 mt-0.5 whitespace-pre-wrap">{o.address}</p>
                          {o.notes && (
                            <p className="text-stone-500 italic mt-1">Note: {o.notes}</p>
                          )}
                        </div>
                      </div>

                      {/* Ordered Products Itemized Breakdown */}
                      <div className="mt-4 border-t border-orange-100 pt-3">
                        <p className="text-xs font-black uppercase tracking-wider text-[#b8471c] mb-2.5">
                          Ordered Items ({o.items?.length || 0})
                        </p>
                        <div className="space-y-1.5">
                          {o.items?.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between rounded-xl bg-stone-50/70 px-3 py-2 text-xs"
                            >
                              <div>
                                <span className="font-bold text-stone-900">{item.product_name}</span>
                                {item.product_code && (
                                  <span className="ml-2 font-mono text-[10px] text-stone-500">
                                    [#{item.product_code}]
                                  </span>
                                )}
                                <span className="text-stone-500 ml-2 font-medium">
                                  ({money(item.unit_price)} × {item.quantity})
                                </span>
                              </div>
                              <span className="font-black text-[#a52b18]">{money(item.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // SIGN IN / REGISTER FORM
  return (
    <main className="min-h-screen bg-[#fffaf2] p-4 sm:p-8 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-orange-100 bg-white p-7 shadow-xl shadow-amber-900/5">
        <a href="/" className="text-sm font-bold text-[#a52b18] hover:underline flex items-center gap-1">
          ← Back to Storefront
        </a>

        <h1 className="mt-6 text-3xl font-black text-stone-900">
          {isRegister ? "Create Customer Account" : "Customer Sign In"}
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {isRegister
            ? "Create an account to order crackers, save your order details, and track admin confirmation."
            : "Sign in to place orders and view your Diwali order history and status."}
        </p>

        <form onSubmit={submitAuth} className="mt-6 space-y-3">
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Username
            </label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              className="w-full rounded-xl border border-orange-200 bg-white p-3.5 text-stone-900 outline-none focus:border-[#a52b18] text-sm"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-orange-200 bg-white p-3.5 text-stone-900 outline-none focus:border-[#a52b18] text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
              Password (8+ characters)
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border border-orange-200 bg-white p-3.5 text-stone-900 outline-none focus:border-[#a52b18] text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 rounded-xl bg-[#a52b18] p-3.5 text-sm font-black text-white shadow-md hover:bg-[#8e2414] transition disabled:opacity-50"
          >
            {loading ? "Processing..." : isRegister ? "Create Account & Sign In →" : "Sign In →"}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-800">
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={() => {
            setIsRegister(!isRegister);
            setError("");
          }}
          className="mt-5 w-full text-center text-xs font-bold text-[#a52b18] hover:underline"
        >
          {isRegister ? "Already have an account? Sign in here" : "Don't have an account? Create one"}
        </button>

        <div className="mt-4 text-center">
          <a href="/admin" className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full hover:bg-amber-100 transition inline-flex items-center gap-1">
            🛡️ Store Admin Login →
          </a>
        </div>

        <div className="mt-6 border-t border-orange-100 pt-5 text-center">
          <p className="text-xs text-stone-500">
            Thaswika Crackers Sivakasi · Direct Diwali Fireworks
          </p>
        </div>
      </div>
    </main>
  );
}
