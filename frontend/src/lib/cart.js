import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const EVT = "sz-cart";
export const MAX_CART_ITEMS = 20;
const key = (uid) => `sz_cart_${uid || "anon"}`;
const read = (uid) => { try { return JSON.parse(localStorage.getItem(key(uid))) || null; } catch { return null; } };

// Per-user, per-browser cart limited to one shop (matches one order request).
export function useCart() {
  const { user } = useAuth();
  const uid = user?.id;
  const [cart, setCart] = useState(() => read(uid));

  useEffect(() => {
    const h = () => setCart(read(uid));
    h();
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(EVT, h); window.removeEventListener("storage", h); };
  }, [uid]);

  const save = useCallback((c) => {
    if (c?.items?.length) localStorage.setItem(key(uid), JSON.stringify(c));
    else localStorage.removeItem(key(uid));
    window.dispatchEvent(new Event(EVT));
  }, [uid]);

  const add = (p, merchantName, qty) => {
    const base = cart && cart.merchant_id === p.merchant_id ? cart : { merchant_id: p.merchant_id, merchant_name: merchantName, items: [] };
    const exists = base.items.find((i) => i.product_id === p.id);
    if (!exists && base.items.length >= MAX_CART_ITEMS) return false;
    const items = exists
      ? base.items.map((i) => (i.product_id === p.id ? { ...i, qty: Math.min(99, i.qty + qty) } : i))
      : [...base.items, { product_id: p.id, name: p.name, price: p.price, image_url: p.image_url, qty }];
    save({ ...base, items });
    return true;
  };
  const setQty = (pid, qty) => save({ ...cart, items: qty <= 0 ? cart.items.filter((i) => i.product_id !== pid) : cart.items.map((i) => (i.product_id === pid ? { ...i, qty: Math.min(99, qty) } : i)) });
  const clear = () => save(null);
  const count = cart?.items.reduce((s, i) => s + i.qty, 0) || 0;
  const total = cart?.items.reduce((s, i) => s + i.qty * i.price, 0) || 0;

  return { cart, add, setQty, clear, count, total };
}
