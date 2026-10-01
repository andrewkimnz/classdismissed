"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { purchaseKoinItem, updateKoinProductPrice } from "@/actions/koins";
import { ConfirmButton, Panel, useAct } from "@/components/admin/ui";
import { StudentPicker, type PickerStudent } from "@/components/admin/student-picker";
import { Chip } from "@/components/ui/kit";
import { cn } from "@/lib/cn";

interface StoreStudent extends PickerStudent {
  balance: number;
}

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

export function StoreDesk({ products, students, phase }: { products: Product[]; students: StoreStudent[]; phase: string }) {
  const { act, pending } = useAct();
  const [who, setWho] = useState<StoreStudent | null>(null);
  const open = phase === "after_school";

  return (
    <div className="space-y-5">
      {!open && (
        <p className="rounded-xl border-2 border-dashed border-pen bg-pen/10 px-3 py-2 text-sm font-bold text-pen">
          🔒 The storefront only runs during Phase 2 (After School). Purchases are blocked until then.
        </p>
      )}

      <Panel title={`Products (${products.length})`} right={<span className="text-xs font-bold text-ink-soft">tap ✎ to change a price</span>}>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </ul>
      </Panel>

      <Panel title="Make a purchase">
        {!who ? (
          <StudentPicker students={students} onPick={(s) => setWho(s as StoreStudent)} />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border-2 border-ink bg-paper p-2.5">
              <div>
                <div className="display text-xl leading-tight">{who.name}</div>
                <div className="text-sm font-bold text-ink-soft">{who.balance} Kaco Koins</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setWho(null)}>Change</button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {products.map((p) => {
                const reason = p.stock === 0 ? "sold out" : who.balance < p.price ? "not enough Koins" : null;
                const disabled = pending || !open || reason !== null;
                return (
                  <ConfirmButton
                    key={p.id}
                    variant="plain"
                    size="lg"
                    className={cn("!h-auto flex-col !items-start gap-0 border-2 p-3 text-left", disabled ? "border-line opacity-50" : "border-ink")}
                    disabled={disabled}
                    confirmLabel={`Confirm: ${p.name} for ${who.name}`}
                    onConfirm={() => act(() => purchaseKoinItem({ studentId: who.id, productId: p.id }), { onOk: () => setWho(null) })}
                  >
                    <span className="font-extrabold">{p.name}</span>
                    <span className="text-xs font-bold text-ink-soft">{p.price} Koins{reason ? ` · ${reason}` : ""}</span>
                  </ConfirmButton>
                );
              })}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const { act, pending } = useAct();
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(String(product.price));

  const save = () => {
    const next = Number(price);
    if (!Number.isInteger(next) || next < 1) return;
    if (next === product.price) {
      setEditing(false);
      return;
    }
    act(() => updateKoinProductPrice({ id: product.id, price: next }), { onOk: () => setEditing(false) });
  };

  return (
    <li className={cn("rounded-2xl border-2 p-3", product.stock === 0 ? "border-line bg-paper-2 opacity-60" : "border-ink bg-white")}>
      <div className="font-extrabold leading-tight">{product.name}</div>
      {editing ? (
        <div className="mt-1 flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={999}
            autoFocus
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") { setPrice(String(product.price)); setEditing(false); }
            }}
            className="w-16 rounded-lg border-2 border-ink px-1.5 py-0.5 text-sm font-bold tabular"
          />
          <button className="btn btn-ghost btn-sm !p-1" disabled={pending} onClick={save} aria-label="Save price">
            <Check size={16} />
          </button>
          <button
            className="btn btn-ghost btn-sm !p-1"
            disabled={pending}
            onClick={() => { setPrice(String(product.price)); setEditing(false); }}
            aria-label="Cancel"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          className="mt-0.5 flex items-center gap-1 text-sm font-bold text-ink-soft"
          onClick={() => { setPrice(String(product.price)); setEditing(true); }}
        >
          {product.price} Koins
          <Pencil size={12} />
        </button>
      )}
      {product.stock === 0 ? <Chip tone="bad" className="mt-1.5">Sold out</Chip> : <div className="mt-1.5 text-xs font-bold text-ink-soft">{product.stock} left</div>}
    </li>
  );
}
