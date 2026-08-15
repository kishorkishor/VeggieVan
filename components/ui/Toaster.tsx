"use client";
import { AnimatePresence, motion } from "framer-motion";
import { create } from "zustand";
import { CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";

type Toast = { id: string; message: string; kind?: "success" | "info" };
type ToastState = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
};

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = Math.random().toString(36).slice(2);
    set({ toasts: [...get().toasts, { id, ...t }] });
    setTimeout(() => get().dismiss(id), 2800);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));

export function toast(message: string, kind: Toast["kind"] = "success") {
  useToasts.getState().push({ message, kind });
}

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  useEffect(() => {}, []);
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-vv-ink px-4 py-2.5 text-sm text-white shadow-lift"
          >
            <CheckCircle2 className="h-4 w-4 text-vv-leaf" />
            <span>{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="ml-1 opacity-60 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
