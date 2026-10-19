"use client";
import { useMemo, useState, useEffect } from "react";
import catalog from "../lib/products.json";
import type { Product, CartLine } from "../lib/types";
import { getApiUrl, getApiErrorMessage } from "../lib/api";

const products = catalog as Product[];
const money = (n: number) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerUser, setCustomerUser] = useState<string>("");

  useEffect(() => {
    const user = localStorage.getItem("kathiravan_username") || localStorage.getItem("sakthi_username") || "";
    if (user) {
      setCustomerUser(user);
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

  async function submitOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lines.length) {
      setNotice({ type: "error", message: "Please add at least one product to your order." });
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
      const token = localStorage.getItem("kathiravan_token") || localStorage.getItem("sakthi_token");

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Token ${token}`;
      }

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
        message: `Order #${data.order_number} confirmed! Total: ${money(data.total)}. We will contact you at ${payload.phone} shortly.`,
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

  return (
    <main className="min-h-screen bg-[#fffaf2]">
      {/* Sivakasi Notice Strip */}
      <div className="bg-[#2a160d] text-[#ffe7b0] text-center text-xs sm:text-sm px-4 py-2 font-medium">
        ✨ KATHIRAVAN CRACKERS · Sivakasi Direct Wholesale & Retail · Best Diwali Prices 2026
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

          <div className="flex items-center gap-3">
            {customerUser ? (
              <a
                href="/account"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white px-3.5 py-2 text-xs font-bold text-stone-700 hover:border-[#a52b18]"
              >
                👤 Hi, {customerUser}
              </a>
            ) : (
              <a
                href="/account"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white px-3.5 py-2 text-xs font-bold text-stone-700 hover:border-[#a52b18]"
              >
                👤 Sign In
              </a>
            )}

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

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#3b160e] via-[#7d2114] to-[#b8471c] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:py-20 md:grid-cols-[1.3fr_.7fr] md:items-center">
          <div>
            <p className="mb-3 inline-block rounded-full border border-amber-200/40 bg-white/10 px-3.5 py-1 text-xs font-extrabold uppercase tracking-[.2em] text-amber-200">
              Celebrate the Festival of Lights
            </p>
            <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-6xl">
              Make this Diwali <span className="text-amber-300">sparkling & bright.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-orange-100 sm:text-lg">
              Authentic Sivakasi fireworks directly from Thaswika Crackers. Choose your favourite sparklers, bombs, and gift boxes.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <a
                href="#catalog"
                className="inline-flex rounded-full bg-amber-300 px-7 py-3.5 text-sm font-black text-[#35170d] shadow-lg hover:bg-amber-200 transition"
              >
                Explore Catalogue ({products.length}) ↓
              </a>
              <a
                href="/admin"
                className="inline-flex rounded-full border border-white/30 bg-white/10 px-5 py-3 text-xs font-bold text-white hover:bg-white/20 transition"
              >
                Admin Login →
              </a>
            </div>
          </div>
          <div className="hidden md:flex justify-center">
            <div className="flex h-64 w-64 items-center justify-center rounded-full border border-amber-200/30 bg-amber-100/10 text-8xl shadow-2xl shadow-black/20 animate-pulse">
              🪔✨
            </div>
          </div>
        </div>
      </section>

      {/* Catalogue */}
      <section id="catalog" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#b8471c]">Direct Catalogue</p>
            <h2 className="mt-1 text-3xl font-black text-stone-900">Find Your Diwali Favourites</h2>
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
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${category === c
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

      {/* Cart Drawer */}
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
                <p className="text-xs text-stone-500 mt-1">Browse the catalogue to add crackers!</p>
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

                <div className="mt-4 flex justify-between border-t border-orange-200 pt-3 text-xl font-black text-stone-900">
                  <span>Grand Total</span>
                  <span className="text-[#a52b18]">{money(total)}</span>
                </div>

                {/* Checkout Form */}
                <form onSubmit={submitOrder} className="mt-4 space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#b8471c]">
                    Customer & Delivery Details
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
                className={`mt-4 rounded-2xl p-4 text-xs font-semibold ${notice.type === "success"
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                    : "bg-red-50 border border-red-200 text-red-900"
                  }`}
              >
                {notice.type === "success" ? "🎉 " : "⚠️ "}
                {notice.message}
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Footer */}
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
        </div>
      </footer>
    </main>
  );
}
