"use client";

import { useEffect } from "react";

/**
 * Locks **document** scroll while overlays are open without moving the page.
 *
 * We intentionally avoid `position: fixed` on `body`: that shrinks the body's
 * layout box to the viewport and **clips** long pages (home looks “empty”
 * behind the cart drawer). Overflow-only keeps full content painted and
 * preserves scroll position—no `scrollTo` needed on unlock.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const html = document.documentElement;
    const body = document.body;
    const scrollbarGap = Math.max(0, window.innerWidth - html.clientWidth);

    const prev = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.getPropertyValue("overscroll-behavior"),
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
    };

    html.style.overflow = "hidden";
    html.style.setProperty("overscroll-behavior", "none");
    body.style.overflow = "hidden";
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`;
    }

    return () => {
      html.style.overflow = prev.htmlOverflow;
      if (prev.htmlOverscroll) {
        html.style.setProperty("overscroll-behavior", prev.htmlOverscroll);
      } else {
        html.style.removeProperty("overscroll-behavior");
      }
      body.style.overflow = prev.bodyOverflow;
      body.style.paddingRight = prev.bodyPaddingRight;
    };
  }, [locked]);
}
