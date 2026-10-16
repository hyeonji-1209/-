"use client";

import { useEffect, useState } from "react";

/** 폰 키패드가 올라와 있는지. visualViewport 높이가 줄면(또는 입력칸에 포커스가 있으면) 열린 것으로 본다 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    let focused = false;
    const update = () => {
      const shrunk = vv ? vv.height < window.innerHeight * 0.78 : false;
      setOpen(shrunk || (focused && !vv));
    };
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      focused = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
      update();
    };
    const onBlur = () => {
      focused = false;
      // 키패드가 내려가는 데 한 박자 걸린다
      setTimeout(update, 120);
    };
    vv?.addEventListener("resize", update);
    window.addEventListener("focusin", onFocus);
    window.addEventListener("focusout", onBlur);
    update();
    return () => {
      vv?.removeEventListener("resize", update);
      window.removeEventListener("focusin", onFocus);
      window.removeEventListener("focusout", onBlur);
    };
  }, []);
  return open;
}
