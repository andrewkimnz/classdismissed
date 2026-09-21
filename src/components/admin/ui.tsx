"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { X } from "lucide-react";
import type { ActionResult } from "@/lib/actions";
import { btnClass } from "@/components/ui/kit";
import { cn } from "@/lib/cn";

// ── toasts + the action hook ────────────────────────────────────────────────
interface Toast { id: number; ok: boolean; text: string }
const ToastCtx = createContext<(ok: boolean, text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((ok: boolean, text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, ok, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ok ? 3500 : 7000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex flex-col items-center gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))]">
        {toasts.map((t) => (
          <div key={t.id} role={t.ok ? "status" : "alert"} className={cn("anim-pop pointer-events-auto w-full max-w-md rounded-2xl border-2 border-ink px-4 py-3 text-[15px] font-bold shadow-[0_4px_0_var(--ink)]", t.ok ? "bg-mint" : "bg-[#ffd9d5]")}>
            {t.ok ? "✓ " : "⚠️ "}{t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Run a server action with a spinner state and a toast for the outcome. */
export function useAct() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const act = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts?: { onOk?: (r: Extract<ActionResult<T>, { ok: true }>) => void; silent?: boolean }) => {
      start(async () => {
        try {
          const r = await fn();
          if (r.ok) {
            if (!opts?.silent) toast(true, r.message ?? "Saved.");
            opts?.onOk?.(r);
          } else toast(false, r.error);
        } catch {
          toast(false, "Couldn't reach the server. Check your connection. Nothing was changed.");
        }
      });
    },
    [toast],
  );
  return { pending, act };
}

// ── modal / bottom sheet ────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-xl rounded-t-3xl border-2 border-ink bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/50 sm:m-auto sm:rounded-3xl"
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between border-b-2 border-dashed border-line px-5 py-3">
            <h2 className="display text-2xl">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="rounded-full border-2 border-ink p-1.5"><X size={18} /></button>
          </div>
          <div className="overflow-y-auto p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

// ── small controls ──────────────────────────────────────────────────────────
type Variant = Parameters<typeof btnClass>[0];

/** Two taps: first arms it ("Tap again to confirm"), second does it. Disarms itself. */
export function ConfirmButton({
  children, confirmLabel = "Tap again to confirm", onConfirm, variant = "danger", size = "md", disabled, className,
}: { children: ReactNode; confirmLabel?: string; onConfirm: () => void; variant?: Variant; size?: "sm" | "md" | "lg"; disabled?: boolean; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button" disabled={disabled}
      className={btnClass(armed ? "danger" : variant, size, cn(armed && "animate-pulse", className))}
      onClick={() => {
        if (armed) { setArmed(false); onConfirm(); } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn("relative h-8 w-14 shrink-0 rounded-full border-2 border-ink transition-colors disabled:opacity-50", checked ? "bg-mint" : "bg-paper-2")}
    >
      <span className={cn("absolute top-0.5 h-6 w-6 rounded-full border-2 border-ink bg-white transition-all", checked ? "left-[26px]" : "left-0.5")} />
    </button>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, disabled,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; disabled?: boolean }) {
  return (
    <div role="radiogroup" className="inline-flex overflow-hidden rounded-xl border-2 border-ink">
      {options.map((o) => (
        <button
          key={o.value} type="button" role="radio" aria-checked={value === o.value} disabled={disabled} onClick={() => onChange(o.value)}
          className={cn("min-h-[40px] border-r-2 border-ink px-3 text-sm font-extrabold last:border-r-0", value === o.value ? "bg-ink text-white" : "bg-white")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label mb-1 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

export function PageHeader({ title, hint, actions }: { title: string; hint?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="display text-[34px] leading-none md:text-4xl">{title}</h1>
        {hint && <p className="hand text-xl leading-tight text-sakura-deep">{hint}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className, right }: { title?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={cn("card-soft border-2 bg-white p-4", className)}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="display text-xl">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
