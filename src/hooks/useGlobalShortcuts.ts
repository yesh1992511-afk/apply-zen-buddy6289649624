import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

/**
 * Vim-style `g <key>` jump shortcuts + `?` for help.
 * Ignored while the user is typing in an input / textarea / contentEditable.
 */
export function useGlobalShortcuts(onShowHelp: () => void) {
  const navigate = useNavigate();

  useEffect(() => {
    let pendingG = false;
    let gTimer: number | null = null;

    const isTyping = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        onShowHelp();
        return;
      }

      if (pendingG) {
        pendingG = false;
        if (gTimer) window.clearTimeout(gTimer);
        const map: Record<string, string> = {
          d: "/dashboard",
          j: "/jobs",
          a: "/applications",
          s: "/sources",
          f: "/filters",
          p: "/profile",
          n: "/notifications",
          l: "/logs",
          e: "/extension",
          o: "/automation",
        };
        const to = map[e.key.toLowerCase()];
        if (to) {
          e.preventDefault();
          navigate({ to });
        }
        return;
      }

      if (e.key === "g") {
        pendingG = true;
        gTimer = window.setTimeout(() => { pendingG = false; }, 1200);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gTimer) window.clearTimeout(gTimer);
    };
  }, [navigate, onShowHelp]);
}
