"use client";
import { useMemo, useState, useEffect } from "react";
import catalog from "../lib/products.json";
import type { Product, CartLine } from "../lib/types";
import { getApiUrl, getApiErrorMessage } from "../lib/api";

const products = catalog as Product[];
const money = (n: number) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function Home() {
  // Authentication & session state
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [token, setToken] = useState<string>("");
  const [customerUser, setCustomerUser] = useState<string>("");

  // Login page states
  const [loginTab, setLoginTab] = useState<"customer_login" | "customer_register" | "admin_login">("customer_login");
  const [adminAuthType, setAdminAuthType] = useState<"api_key" | "credentials">("api_key");

  // Customer auth input states
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authEmail, setAuthEmail] = useState("");

  // Admin auth input states
  const [adminApiKey, setAdminApiKey] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Status & feedback
  const [authError, setAuthError] = useState("");
  const [authSuccessMsg, setAuthSuccessMsg] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Storefront & Cart states (viewable after login)
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check existing session on initial load
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem("kathiravan_token") || localStorage.getItem("sakthi_token") || "";
      const savedUser = localStorage.getItem("kathiravan_username") || localStorage.getItem("sakthi_username") || "";
      if (savedToken) {
        setToken(savedToken);
      }
      if (savedUser) {
        setCustomerUser(savedUser);
      }
    } catch {
      // Ignore localStorage access errors
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category)))];

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          (category === "All" || p.category === category) &&
          (p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.category.toLowerCase().includes(query.toLowerCase()) ||
            p.code.toLowerCase().includes(query.toLowerCase()))
      ),
    [category, query]
  );

  const lines = Object.values(cart);
  const total = lines.reduce((s, p) => s + p.price * p.quantity, 0);
  const count = lines.reduce((s, p) => s + p.quantity, 0);

  function add(p: Product) {
    const key = p.code + "-" + p.name;
    setCart((old) => ({
      ...old,
      [key]: { ...p, quantity: (old[key]?.quantity || 0) + 1 },
    }));
    setNotice(null);
  }

  function change(key: string, n: number) {
    setCart((old) => {
      const next = { ...old };
      if (n <= 0) delete next[key];
      else next[key] = { ...next[key], quantity: n };
      return next;
    });
  }

  // Customer Login Handler
  async function handleCustomerLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!authUsername.trim() || !authPassword) {
      setAuthError("Please enter both username and password.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccessMsg("");

    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authUsername.trim(),
          password: authPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Invalid username or password.");
      }

      // Save credentials in storage
      localStorage.setItem("kathiravan_token", data.token);
      localStorage.setItem("kathiravan_username", data.username);
      localStorage.setItem("sakthi_token", data.token);
      localStorage.setItem("sakthi_username", data.username);

      setToken(data.token);
      setCustomerUser(data.username);
      setAuthPassword("");
      setAuthError("");
    } catch (err) {
      setAuthError(getApiErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }

  // Customer Register Handler
  async function handleCustomerRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!authUsername.trim() || !authPassword) {
      setAuthError("Please fill in username and password.");
      return;
    }
    if (authUsername.trim().length < 3) {
      setAuthError("Username must be at least 3 characters.");
      return;
    }
    if (authPassword.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    setAuthSuccessMsg("");

    try {
      const apiUrl = getApiUrl();
      const payload: Record<string, string> = {
        username: authUsername.trim(),
        password: authPassword,
      };
      if (authEmail.trim()) {
        payload.email = authEmail.trim();
      }

      const res = await fetch(`${apiUrl}/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Registration failed.");
      }

      // Save credentials
      localStorage.setItem("kathiravan_token", data.token);
      localStorage.setItem("kathiravan_username", data.username);
      localStorage.setItem("sakthi_token", data.token);
      localStorage.setItem("sakthi_username", data.username);

      setToken(data.token);
      setCustomerUser(data.username);
      setAuthPassword("");
      setAuthError("");
    } catch (err) {
      setAuthError(getApiErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }

  // Admin Login Handler
  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccessMsg("");

    try {
      const apiUrl = getApiUrl();

      if (adminAuthType === "api_key") {
        const keyToVerify = adminApiKey.trim();
        if (!keyToVerify) {
          throw new Error("Please enter the Admin API Key.");
        }

        const res = await fetch(`${apiUrl}/auth/admin-verify/`, {
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
        setAuthSuccessMsg("Admin API key verified! Redirecting to Admin Dashboard...");
        setTimeout(() => {
          window.location.href = "/admin";
        }, 600);
      } else {
        // Django Staff Credentials
        if (!adminUsername.trim() || !adminPassword) {
          throw new Error("Please enter both staff username and password.");
        }

        const res = await fetch(`${apiUrl}/auth/login/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: adminUsername.trim(),
            password: adminPassword,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Invalid username or password.");
        }
        if (!data.is_staff) {
          throw new Error("This account is not designated as store staff/admin.");
        }

        localStorage.setItem("kathiravan_token", data.token);
        localStorage.setItem("kathiravan_username", data.username);
        localStorage.setItem("sakthi_token", data.token);
        localStorage.setItem("sakthi_username", data.username);

        setAuthSuccessMsg("Admin login successful! Redirecting to Admin Dashboard...");
        setTimeout(() => {
          window.location.href = "/admin";
        }, 600);
      }
    } catch (err) {
      setAuthError(getApiErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }

  // Logout Handler
  function handleLogout() {
    localStorage.removeItem("kathiravan_token");
    localStorage.removeItem("kathiravan_username");
    localStorage.removeItem("sakthi_token");
    localStorage.removeItem("sakthi_username");
    setToken("");
    setCustomerUser("");
    setCart({});
    setShowCart(false);
    setNotice(null);
    setAuthSuccessMsg("You have signed out successfully. Please log in to view products again.");
  }

  // Submit Order (Only accessible when logged in)
  async function submitOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lines.length) {
      setNotice({ type: "error", message: "Please add at least one product to your order." });
      return;
    }

    const currentToken = token || localStorage.getItem("kathiravan_token") || localStorage.getItem("sakthi_token");
    if (!currentToken) {
      setNotice({
        type: "error",
        message: "Your session has expired. Please log in again to confirm your order.",
      });
      setToken("");
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    const form = e.currentTarget;
    const fd = new FormData(form);

    const payload = {
      customer_name: String(fd.get("name") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      address: String(fd.get("address") || "").trim(),
      notes: String(fd.get("notes") || "").trim(),
      items: lines.map((p) => ({
        product_code: p.code,
        product_name: p.name,
        quantity: p.quantity,
        unit_price: p.price,
      })),
    };

    try {
      const apiUrl = getApiUrl();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Token ${currentToken}`,
      };

      const res = await fetch(`${apiUrl}/orders/`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let detail = "Order submission was rejected by the server.";
        try {
          const errorData = await res.json();
          if (typeof errorData.detail === "string") detail = errorData.detail;
          else if (errorData.items) detail = "Check the selected items and quantities.";
          else if (errorData.customer_name || errorData.phone || errorData.address)
            detail = "Please check your name, phone number, and address.";
        } catch { }
        throw new Error(`${detail} (HTTP ${res.status})`);
      }

      const data = await res.json();
      setNotice({
        type: "success",
        message: `🎉 Order #${data.order_number} confirmed! Total: ${money(
          data.total
        )}. Your order details have been saved to your customer profile. Store admin will review and verify your order.`,
      });
      setCart({});
      form.reset();
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // 1. Initial Loading Screen while checking existing session
  if (isCheckingAuth) {
    return (
      <main className="min-h-screen bg-[#fffaf2] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl shadow-inner animate-pulse">
            🪔
          </div>
          <h2 className="mt-4 text-xl font-black text-[#9e2c18] tracking-tight">Thaswika Crackers</h2>
          <p className="mt-1 text-xs font-semibold text-stone-500">Checking authentication...</p>
        </div>
      </main>
    );
  }

  // 2. UNLOGGED VIEW: Show Festive Login & Register Page with Admin Login
  if (!token) {
    return (
      <main className="min-h-screen bg-[#fffaf2] flex flex-col justify-between">
        {/* Top Sivakasi Notice */}
        <div className="bg-[#2a160d] text-[#ffe7b0] text-center text-xs sm:text-sm px-4 py-2 font-medium">
          ✨ THASWIKA CRACKERS · Sivakasi Direct Wholesale & Retail · Best Diwali Prices 2026
        </div>

        {/* Minimal Header */}
        <header className="border-b border-orange-100 bg-[#fffaf2]/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <a href="/" className="text-xl sm:text-2xl font-black tracking-tight text-[#9e2c18] flex items-center gap-2">
              <span>🪔</span>
              <span>
                Thaswika <span className="text-[#2a160d]">Crackers</span>
              </span>
            </a>
            <div className="flex items-center gap-2">
              <a
                href="tel:9943349987"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white px-3.5 py-1.5 text-xs font-bold text-stone-700 hover:border-[#a52b18]"
              >
                📞 Direct Support: 9943349987
              </a>
              <button
                onClick={() => {
                  setLoginTab("admin_login");
                  setAuthError("");
                  setAuthSuccessMsg("");
                }}
                className="rounded-full border border-[#9e2c18]/20 bg-orange-50 px-3.5 py-1.5 text-xs font-black text-[#9e2c18] hover:bg-orange-100 transition"
              >
                🛡️ Admin Login
              </button>
            </div>
          </div>
        </header>

        {/* Hero & Login Section */}
        <section className="relative flex-1 py-8 sm:py-12 px-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            {/* Headline Banner */}
            <div className="text-center mb-8">
              <p className="inline-block rounded-full border border-amber-300 bg-amber-50 px-4 py-1 text-xs font-black uppercase tracking-wider text-[#9e2c18]">
                🪔 Sivakasi Direct Wholesale & Retail Portal
              </p>
              <h1 className="mt-3 text-3xl sm:text-5xl font-black text-stone-900 tracking-tight">
                Welcome to <span className="text-[#a52b18]">Thaswika Crackers</span>
              </h1>
              <p className="mt-2 text-sm sm:text-base text-stone-600 max-w-xl mx-auto">
                Please log in or create an account to view our authentic Sivakasi fireworks catalogue, wholesale prices, and place your Diwali orders.
              </p>
            </div>

            {/* Auth Card Container */}
            <div className="mx-auto max-w-md rounded-3xl border border-orange-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-amber-900/5">
              {/* Tab Switcher */}
              <div className="flex rounded-2xl bg-orange-50 p-1 border border-orange-200">
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab("customer_login");
                    setAuthError("");
                    setAuthSuccessMsg("");
                  }}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    loginTab === "customer_login"
                      ? "bg-[#a52b18] text-white shadow-sm"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  <span>👤</span>
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab("customer_register");
                    setAuthError("");
                    setAuthSuccessMsg("");
                  }}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    loginTab === "customer_register"
                      ? "bg-[#a52b18] text-white shadow-sm"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  <span>✨</span>
                  <span>Register</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab("admin_login");
                    setAuthError("");
                    setAuthSuccessMsg("");
                  }}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    loginTab === "admin_login"
                      ? "bg-[#2a160d] text-amber-300 shadow-sm"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  <span>🛡️</span>
                  <span>Admin</span>
                </button>
              </div>

              {/* Status & Feedback Notices */}
              {authSuccessMsg && (
                <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
                  <span>✅</span>
                  <span>{authSuccessMsg}</span>
                </div>
              )}
              {authError && (
                <div className="mt-4 rounded-2xl bg-red-50 border border-red-200 p-3 text-xs font-bold text-red-800 flex items-start gap-2">
                  <span>⚠️</span>
                  <span>{authError}</span>
                </div>
              )}

              {/* 2.A Customer Sign In Form */}
              {loginTab === "customer_login" && (
                <form onSubmit={handleCustomerLogin} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Username
                    </label>
                    <input
                      required
                      type="text"
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      placeholder="Enter your username"
                      className="w-full rounded-2xl border border-orange-200 bg-white p-3 text-sm text-stone-900 outline-none focus:border-[#a52b18] focus:ring-2 focus:ring-orange-200 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Password
                    </label>
                    <input
                      required
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full rounded-2xl border border-orange-200 bg-white p-3 text-sm text-stone-900 outline-none focus:border-[#a52b18] focus:ring-2 focus:ring-orange-200 shadow-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full rounded-2xl bg-[#a52b18] py-3.5 text-sm font-black text-white shadow-md hover:bg-[#8e2414] transition disabled:opacity-50"
                  >
                    {authLoading ? "Signing in..." : "Sign In & View Products →"}
                  </button>

                  <div className="pt-2 flex flex-col gap-2 text-center text-xs">
                    <p className="text-stone-600">
                      New to Thaswika Crackers?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setLoginTab("customer_register");
                          setAuthError("");
                          setAuthSuccessMsg("");
                        }}
                        className="font-bold text-[#a52b18] hover:underline"
                      >
                        Create an account
                      </button>
                    </p>
                    <p className="text-stone-500">
                      Store manager?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setLoginTab("admin_login");
                          setAuthError("");
                          setAuthSuccessMsg("");
                        }}
                        className="font-bold text-[#2a160d] hover:underline"
                      >
                        Sign in as Admin
                      </button>
                    </p>
                  </div>
                </form>
              )}

              {/* 2.B Customer Registration Form */}
              {loginTab === "customer_register" && (
                <form onSubmit={handleCustomerRegister} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Choose Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      placeholder="e.g. mathan_kumar"
                      className="w-full rounded-2xl border border-orange-200 bg-white p-3 text-sm text-stone-900 outline-none focus:border-[#a52b18] focus:ring-2 focus:ring-orange-200 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Email Address <span className="text-stone-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full rounded-2xl border border-orange-200 bg-white p-3 text-sm text-stone-900 outline-none focus:border-[#a52b18] focus:ring-2 focus:ring-orange-200 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Password <span className="text-stone-400 font-normal">(min 8 characters) *</span>
                    </label>
                    <input
                      required
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full rounded-2xl border border-orange-200 bg-white p-3 text-sm text-stone-900 outline-none focus:border-[#a52b18] focus:ring-2 focus:ring-orange-200 shadow-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full rounded-2xl bg-[#a52b18] py-3.5 text-sm font-black text-white shadow-md hover:bg-[#8e2414] transition disabled:opacity-50"
                  >
                    {authLoading ? "Creating Account..." : "Create Account & Unlock Store →"}
                  </button>

                  <div className="pt-2 text-center text-xs text-stone-600">
                    Already registered?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setLoginTab("customer_login");
                        setAuthError("");
                        setAuthSuccessMsg("");
                      }}
                      className="font-bold text-[#a52b18] hover:underline"
                    >
                      Sign In here
                    </button>
                  </div>
                </form>
              )}

              {/* 2.C Store Admin Login Tab */}
              {loginTab === "admin_login" && (
                <div className="mt-5">
                  <div className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950 font-medium">
                    🛡️ <b>Store Admin Portal</b>: Access live customer orders, update order status (Confirmed / Packed / Completed), and download Excel/PDF reports.
                  </div>

                  {/* Admin Auth Toggle: API Key vs Django Staff */}
                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminAuthType("api_key");
                        setAuthError("");
                      }}
                      className={`flex-1 rounded-xl py-2 text-xs font-bold border transition ${
                        adminAuthType === "api_key"
                          ? "border-[#2a160d] bg-[#2a160d] text-white shadow-sm"
                          : "border-orange-200 bg-white text-stone-700 hover:bg-orange-50"
                      }`}
                    >
                      🔑 Admin API Key
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminAuthType("credentials");
                        setAuthError("");
                      }}
                      className={`flex-1 rounded-xl py-2 text-xs font-bold border transition ${
                        adminAuthType === "credentials"
                          ? "border-[#2a160d] bg-[#2a160d] text-white shadow-sm"
                          : "border-orange-200 bg-white text-stone-700 hover:bg-orange-50"
                      }`}
                    >
                      👤 Staff Account
                    </button>
                  </div>

                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    {adminAuthType === "api_key" ? (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                          Admin API Key
                        </label>
                        <input
                          required
                          type="password"
                          value={adminApiKey}
                          onChange={(e) => setAdminApiKey(e.target.value)}
                          placeholder="Enter your store Admin API Key"
                          className="w-full rounded-2xl border border-orange-200 bg-white p-3 text-sm text-stone-900 outline-none focus:border-[#a52b18] focus:ring-2 focus:ring-orange-200 shadow-sm"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                            Staff Username
                          </label>
                          <input
                            required
                            type="text"
                            value={adminUsername}
                            onChange={(e) => setAdminUsername(e.target.value)}
                            placeholder="Django staff username"
                            className="w-full rounded-2xl border border-orange-200 bg-white p-3 text-sm text-stone-900 outline-none focus:border-[#a52b18] focus:ring-2 focus:ring-orange-200 shadow-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                            Staff Password
                          </label>
                          <input
                            required
                            type="password"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            placeholder="Staff password"
                            className="w-full rounded-2xl border border-orange-200 bg-white p-3 text-sm text-stone-900 outline-none focus:border-[#a52b18] focus:ring-2 focus:ring-orange-200 shadow-sm"
                          />
                        </div>
                      </>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full rounded-2xl bg-[#2a160d] py-3.5 text-sm font-black text-amber-300 shadow-md hover:bg-[#3d2013] transition disabled:opacity-50"
                    >
                      {authLoading ? "Verifying Admin Access..." : "Verify & Open Admin Portal →"}
                    </button>
                  </form>

                  <div className="mt-4 pt-3 border-t border-orange-100 flex flex-col gap-2 text-center text-xs">
                    <a
                      href="/admin"
                      className="font-bold text-[#a52b18] hover:underline"
                    >
                      Or open dedicated Admin Dashboard directly →
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginTab("customer_login");
                        setAuthError("");
                        setAuthSuccessMsg("");
                      }}
                      className="font-bold text-stone-600 hover:text-stone-900"
                    >
                      ← Back to Customer Login
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sivakasi Trust Highlights */}
            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
                <span className="text-2xl">🎆</span>
                <p className="mt-1 text-xs font-black text-stone-900">100+ Crackers</p>
                <p className="text-[11px] text-stone-500">Sparklers, Bombs, Shots & Boxes</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
                <span className="text-2xl">🏭</span>
                <p className="mt-1 text-xs font-black text-stone-900">Sivakasi Direct</p>
                <p className="text-[11px] text-stone-500">Authentic Factory Pricing</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
                <span className="text-2xl">📋</span>
                <p className="mt-1 text-xs font-black text-stone-900">Track Orders</p>
                <p className="text-[11px] text-stone-500">Live Status & PDF Invoices</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
                <span className="text-2xl">📞</span>
                <p className="mt-1 text-xs font-black text-stone-900">Direct Support</p>
                <p className="text-[11px] text-stone-500">WhatsApp / Call 9943349987</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-orange-100 bg-white px-4 py-8 text-center text-sm text-stone-600">
          <b className="text-[#9e2c18] text-base">Thaswika Crackers</b>
          <p className="mt-1">234A, Aandalpuram St, Chatrapatti Main Road, Sivakasi – 626 123</p>
          <p className="font-semibold text-stone-800 mt-0.5">
            Direct Orders / GPay / WhatsApp: <a href="tel:9943349987" className="text-[#9e2c18] hover:underline">9943349987</a>
          </p>
          <div className="mt-4 flex justify-center gap-4 text-xs font-bold">
            <button
              onClick={() => {
                setLoginTab("admin_login");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="text-[#9e2c18] hover:underline"
            >
              Store Admin Login →
            </button>
          </div>
        </footer>
      </main>
    );
  }

  // 3. LOGGED-IN VIEW: Full Product Catalogue, Add to Cart, and Order Placement
  return (
    <main className="min-h-screen bg-[#fffaf2]">
      {/* Sivakasi Notice Strip */}
      <div className="bg-[#2a160d] text-[#ffe7b0] text-center text-xs sm:text-sm px-4 py-2 font-medium">
        ✨ THASWIKA CRACKERS · Sivakasi Direct Wholesale & Retail · Best Diwali Prices 2026
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-orange-100 bg-[#fffaf2]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5">
          <a href="#" className="text-xl sm:text-2xl font-black tracking-tight text-[#9e2c18] flex items-center gap-2">
            <span>🪔</span>
            <span>
              Thaswika <span className="text-[#2a160d]">Crackers</span>
            </span>
          </a>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Account Profile Link */}
            <a
              href="/account"
              className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white px-3 sm:px-3.5 py-2 text-xs font-bold text-stone-700 hover:border-[#a52b18] shadow-sm"
              title="View my orders & account profile"
            >
              <span>👤</span>
              <span className="hidden sm:inline">Hi, {customerUser}</span>
              <span className="sm:hidden">{customerUser}</span>
            </a>

            {/* My Orders Button */}
            <a
              href="/account"
              className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3.5 py-2 text-xs font-bold text-[#9e2c18] hover:bg-orange-100"
            >
              📋 My Orders
            </a>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition"
              title="Sign out of your account"
            >
              <span>🚪</span>
              <span className="hidden sm:inline">Logout</span>
            </button>

            {/* Admin Portal Shortcut */}
            <a
              href="/admin"
              className="hidden lg:inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
            >
              🛡️ Admin
            </a>

            {/* Cart Button */}
            <button
              onClick={() => setShowCart(!showCart)}
              className="relative rounded-full bg-[#a52b18] px-4 py-2 text-sm font-black text-white shadow-md hover:bg-[#8e2414] transition flex items-center gap-2"
            >
              <span>🛒 Cart</span>
              <span className="rounded-full bg-white text-[#a52b18] px-2 py-0.5 text-xs font-black">
                {count}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section for Logged-In User */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#3b160e] via-[#7d2114] to-[#b8471c] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:py-16 md:grid-cols-[1.3fr_.7fr] md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="rounded-full border border-amber-200/40 bg-white/10 px-3.5 py-1 text-xs font-extrabold uppercase tracking-[.2em] text-amber-200">
                Festival of Lights 2026
              </span>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-xs font-black text-emerald-300">
                ✓ Logged in as @{customerUser}
              </span>
            </div>
            <h1 className="max-w-2xl text-3xl font-black leading-tight sm:text-5xl">
              Celebrate this Diwali with <span className="text-amber-300">authentic Sivakasi fireworks.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-orange-100 sm:text-base">
              Welcome back, <b>{customerUser}</b>! Choose your favourite sparklers, ground chakkars, flower pots, and gift boxes. Your orders will be saved directly in your profile.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="#catalog"
                className="inline-flex rounded-full bg-amber-300 px-6 py-3 text-sm font-black text-[#35170d] shadow-lg hover:bg-amber-200 transition"
              >
                Browse Catalogue ({products.length} Products) ↓
              </a>
              <a
                href="/account"
                className="inline-flex rounded-full border border-white/30 bg-white/10 px-5 py-3 text-xs font-bold text-white hover:bg-white/20 transition"
              >
                View My Orders →
              </a>
              <button
                onClick={() => setShowCart(true)}
                className="inline-flex rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-xs font-bold text-amber-200 hover:bg-amber-300/20 transition"
              >
                🛒 Open Cart ({count} items)
              </button>
            </div>
          </div>
          <div className="hidden md:flex justify-center">
            <div className="flex h-56 w-56 items-center justify-center rounded-full border border-amber-200/30 bg-amber-100/10 text-7xl shadow-2xl shadow-black/20 animate-pulse">
              🪔✨
            </div>
          </div>
        </div>
      </section>

      {/* Catalogue */}
      <section id="catalog" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#b8471c]">Direct Wholesale Catalogue</p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-black text-stone-900">Find Your Diwali Favourites</h2>
            <p className="mt-1 text-sm text-stone-600">
              Showing {filtered.length} of {products.length} products · Prices in Indian Rupees (₹)
            </p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search crackers, sparklers, gift boxes..."
            className="w-full sm:w-80 rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#a52b18] focus:ring-2 focus:ring-orange-200 shadow-sm"
          />
        </div>

        {/* Categories Carousel */}
        <div className="mb-7 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
                category === c
                  ? "bg-[#a52b18] text-white shadow-sm"
                  : "border border-orange-200 bg-white text-stone-700 hover:border-orange-400"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
          {filtered.map((p) => {
            const key = p.code + "-" + p.name;
            const itemInCart = cart[key];
            return (
              <article
                key={key}
                className="flex flex-col rounded-3xl border border-orange-100 bg-white p-3.5 shadow-sm transition hover:-translate-y-1 hover:shadow-md sm:p-5"
              >
                <div className="flex h-24 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 text-4xl">
                  🎆
                </div>
                <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-[#b8471c]">
                  {p.category}
                </p>
                <h3 className="mt-1 min-h-[2.5rem] text-sm font-extrabold leading-snug text-stone-900 sm:text-base">
                  {p.name}
                </h3>
                <p className="mt-1 text-xs text-stone-500 font-medium">
                  Code: <span className="font-mono text-stone-700 font-bold">{p.code}</span> · {p.unit}
                </p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                  <span className="text-lg font-black text-[#8f2615]">{money(p.price)}</span>
                  <button
                    onClick={() => add(p)}
                    className="rounded-full bg-[#2a160d] px-3.5 py-1.5 text-xs font-black text-white hover:bg-[#a52b18] transition"
                  >
                    + Add
                  </button>
                </div>
                {itemInCart && (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-orange-50 p-1.5 border border-orange-100">
                    <button
                      aria-label="Decrease quantity"
                      onClick={() => change(key, itemInCart.quantity - 1)}
                      className="h-7 w-7 rounded-lg bg-white font-black text-stone-800 shadow-sm hover:bg-orange-100"
                    >
                      −
                    </button>
                    <span className="text-xs font-black text-[#a52b18]">Qty: {itemInCart.quantity}</span>
                    <button
                      aria-label="Increase quantity"
                      onClick={() => change(key, itemInCart.quantity + 1)}
                      className="h-7 w-7 rounded-lg bg-white font-black text-stone-800 shadow-sm hover:bg-orange-100"
                    >
                      +
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center text-stone-500">
            <p className="text-4xl">🔍</p>
            <p className="mt-2 font-bold text-stone-700">No products found matching &ldquo;{query}&rdquo;</p>
            <button
              onClick={() => {
                setQuery("");
                setCategory("All");
              }}
              className="mt-3 text-xs font-bold text-[#a52b18] underline"
            >
              Reset filters
            </button>
          </div>
        )}
      </section>

      {/* Cart & Order Drawer */}
      {showCart && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCart(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full max-w-lg overflow-y-auto bg-[#fffaf2] p-5 shadow-2xl sm:p-7 flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-orange-200/60 pb-3">
              <h2 className="text-2xl font-black text-stone-900 flex items-center gap-2">
                <span>🛒</span> Your Diwali Cart ({count})
              </h2>
              <button
                onClick={() => setShowCart(false)}
                className="h-8 w-8 rounded-full bg-orange-100 font-bold text-stone-700 hover:bg-orange-200 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="my-auto py-12 text-center text-stone-500">
                <p className="text-4xl">🎆</p>
                <p className="mt-2 font-bold text-stone-700">Your cart is currently empty.</p>
                <p className="text-xs text-stone-500 mt-1">Browse our Sivakasi catalogue to add crackers!</p>
              </div>
            ) : (
              <>
                <div className="mt-4 space-y-2.5 overflow-y-auto max-h-60 sm:max-h-72 pr-1">
                  {lines.map((p) => {
                    const lineKey = p.code + "-" + p.name;
                    return (
                      <div
                        key={lineKey}
                        className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-white p-3 shadow-sm"
                      >
                        <div className="flex-1">
                          <p className="font-extrabold text-sm text-stone-900 leading-tight">{p.name}</p>
                          <p className="text-xs text-stone-500">
                            {money(p.price)} × {p.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => change(lineKey, p.quantity - 1)}
                            className="h-7 w-7 rounded-lg bg-orange-100 font-bold text-stone-800"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-xs font-black">{p.quantity}</span>
                          <button
                            onClick={() => change(lineKey, p.quantity + 1)}
                            className="h-7 w-7 rounded-lg bg-orange-100 font-bold text-stone-800"
                          >
                            +
                          </button>
                        </div>
                        <b className="text-sm font-black text-[#a52b18]">{money(p.price * p.quantity)}</b>
                      </div>
                    );
                  })}
                </div>

                {/* Grand Total */}
                <div className="mt-4 flex justify-between border-t border-orange-200 pt-3 text-xl font-black text-stone-900">
                  <span>Grand Total</span>
                  <span className="text-[#a52b18]">{money(total)}</span>
                </div>

                {/* Logged In Order Checkout Form */}
                <form onSubmit={submitOrder} className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-orange-100/70 p-3 border border-orange-200">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">👤</span>
                      <div>
                        <p className="text-xs font-black text-stone-900">
                          Ordering as <span className="text-[#a52b18]">@{customerUser}</span>
                        </p>
                        <p className="text-[10px] text-stone-600 font-semibold">Orders will be saved to your profile</p>
                      </div>
                    </div>
                    <a
                      href="/account"
                      className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-[#a52b18] border border-orange-200 hover:bg-orange-50"
                    >
                      My Orders →
                    </a>
                  </div>

                  <h3 className="text-xs font-black uppercase tracking-wider text-[#b8471c] pt-1">
                    Delivery & Contact Details
                  </h3>

                  <input
                    required
                    name="name"
                    placeholder="Full Name *"
                    className="w-full rounded-xl border border-orange-200 bg-white p-3 text-sm text-stone-900 outline-none focus:border-[#a52b18]"
                  />
                  <input
                    required
                    name="phone"
                    type="tel"
                    pattern="[0-9+() -]{7,18}"
                    placeholder="Mobile Number (e.g. 9876543210) *"
                    className="w-full rounded-xl border border-orange-200 bg-white p-3 text-sm text-stone-900 outline-none focus:border-[#a52b18]"
                  />
                  <textarea
                    required
                    name="address"
                    placeholder="Delivery Address / City / Pincode *"
                    rows={2}
                    className="w-full rounded-xl border border-orange-200 bg-white p-3 text-sm text-stone-900 outline-none focus:border-[#a52b18]"
                  />
                  <textarea
                    name="notes"
                    placeholder="Special requests or packing notes (optional)"
                    rows={1}
                    className="w-full rounded-xl border border-orange-200 bg-white p-3 text-sm text-stone-900 outline-none focus:border-[#a52b18]"
                  />

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-2xl bg-[#a52b18] p-4 text-base font-black text-white shadow-lg hover:bg-[#8e2414] transition disabled:opacity-50"
                  >
                    {isSubmitting ? "Placing Order..." : `Confirm Order · ${money(total)}`}
                  </button>

                  <p className="text-[11px] leading-4 text-stone-500 text-center">
                    Payment is handled upon confirmation via GPay / Cash on Delivery. Orders are verified by phone.
                  </p>
                </form>
              </>
            )}

            {notice && (
              <div
                className={`mt-4 rounded-2xl p-4 text-xs font-semibold ${
                  notice.type === "success"
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                    : "bg-red-50 border border-red-200 text-red-900"
                }`}
              >
                <div>
                  {notice.type === "success" ? "🎉 " : "⚠️ "}
                  {notice.message}
                </div>
                {notice.type === "success" && (
                  <div className="mt-3">
                    <a
                      href="/account"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-800 transition"
                    >
                      👤 View Order & Status in Your Profile →
                    </a>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Storefront Footer */}
      <footer className="border-t border-orange-100 bg-white px-4 py-8 text-center text-sm text-stone-600">
        <b className="text-[#9e2c18] text-base">Thaswika Crackers</b>
        <p className="mt-1">234A, Aandalpuram St, Chatrapatti Main Road, Sivakasi – 626 123</p>
        <p className="font-semibold text-stone-800 mt-0.5">
          Direct Orders / GPay / WhatsApp: <a href="tel:9943349987" className="text-[#9e2c18] hover:underline">9943349987</a>
        </p>
        <p className="mt-3 text-xs text-stone-400 max-w-xl mx-auto">
          Please follow fireworks safety guidelines. Keep water handy and light crackers in open spaces under adult supervision.
        </p>
        <div className="mt-4 flex justify-center gap-4 text-xs font-bold">
          <a className="text-[#9e2c18] hover:underline" href="/account">
            Customer Account / Orders →
          </a>
          <span className="text-stone-300">|</span>
          <a className="text-[#9e2c18] hover:underline" href="/admin">
            Admin Portal →
          </a>
          <span className="text-stone-300">|</span>
          <button onClick={handleLogout} className="text-red-700 hover:underline">
            Logout
          </button>
        </div>
      </footer>
    </main>
  );
}
