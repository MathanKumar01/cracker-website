"use client";
import { useState, useEffect } from "react";
import { getApiUrl, getApiErrorMessage } from "../../lib/api";

const API = getApiUrl();

type OrderItem = {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type Order = {
  id: number;
  order_number: string;
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
          <div className="flex items-center justify-between border-b border-orange-200/60 pb-4">
            <a href="/" className="text-sm font-bold text-[#a52b18] hover:underline">
              ← Back to Storefront
            </a>
            <button
              onClick={handleLogout}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
            >
              Sign out
            </button>
          </div>

          <div className="mt-6 rounded-3xl border border-orange-100 bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#b8471c]">Customer Account</p>
                <h1 className="mt-1 text-3xl font-black text-stone-900">Welcome, {loggedInUser}!</h1>
                <p className="mt-1 text-sm text-stone-600">
                  Track your previous Diwali orders and view status updates here.
                </p>
              </div>
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-2xl bg-[#a52b18] px-5 py-3 text-sm font-black text-white hover:bg-[#8e2414]"
              >
                🛒 Shop Diwali Catalogue
              </a>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-black text-stone-900">Your Diwali Orders</h2>
            {ordersLoading ? (
              <p className="mt-4 text-sm text-stone-500">Loading your orders...</p>
            ) : myOrders.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-orange-200 bg-white p-8 text-center text-stone-500">
                <p className="text-3xl">🎆</p>
                <p className="mt-2 font-bold text-stone-700">No orders placed yet under this account.</p>
                <p className="mt-1 text-xs text-stone-500">
                  Head over to the storefront, add crackers to your cart, and place your order!
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {myOrders.map((o) => (
                  <div key={o.id} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-black uppercase text-[#a52b18]">
                          {o.order_number}
                        </span>
                        <span className="ml-3 text-xs text-stone-500">
                          {new Date(o.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-stone-600 capitalize">
                          Status: <b className="text-stone-900">{o.status}</b>
                        </span>
                        <span className="text-lg font-black text-[#a52b18]">{money(o.total)}</span>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-orange-50 pt-3">
                      <div className="text-xs text-stone-600 space-y-1">
                        {o.items.map((i, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>
                              {i.product_name} × {i.quantity}
                            </span>
                            <span className="font-semibold">{money(i.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
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
            ? "Create an account to track your orders and checkout faster."
            : "Sign in to view your order history and details."}
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
            {loading ? "Processing..." : isRegister ? "Create Account →" : "Sign In →"}
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

        <div className="mt-6 border-t border-orange-100 pt-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Store Owner / Staff?</p>
          <a
            href="/admin"
            className="mt-2 block rounded-xl border border-[#a52b18] px-4 py-2.5 text-center text-xs font-bold text-[#a52b18] hover:bg-orange-50"
          >
            Go to Admin Dashboard →
          </a>
        </div>
      </div>
    </main>
  );
}
