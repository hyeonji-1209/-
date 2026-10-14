"use client";

import { useCallback, useRef, useState } from "react";

interface ToastState {
  text: string;
  action?: { label: string; run: () => void };
  key: number;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((text: string, action?: ToastState["action"]) => {
    clearTimeout(timer.current);
    setToast({ text, action, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), action ? 6000 : 2400);
  }, []);

  const node = toast ? (
    <div className="toast" role="status" key={toast.key}>
      <span>{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.run();
            show("되돌렸어요.");
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  ) : null;

  return { show, node };
}
