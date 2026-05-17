"use client";

import { RefObject, useEffect, useRef } from "react";

/*
  useDragTouch — long-press drag pour iOS Safari + souris desktop.

  Pourquoi long-press ?
  Appeler e.preventDefault() dans touchstart à l'intérieur d'un conteneur
  overflow:scroll provoque un touchcancel IMMÉDIAT sur iOS Safari.
  Solution : ne JAMAIS appeler preventDefault dans touchstart.
  Attendre 220ms immobile → drag activé → seulement là on preventDefault
  dans touchmove pour bloquer le scroll.
*/

export interface SlotTarget {
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
}

interface Options {
  onDragStart?: () => void;
  onDragOver?:  (target: SlotTarget | null) => void;
  onDrop:       (target: SlotTarget | null) => void;
  onTap:        () => void;
  onCancel?:    () => void;
}

const LONG_PRESS_MS  = 220;  // ms avant activation du drag
const SCROLL_CANCEL  = 10;   // px de mouvement qui annule le long-press

export function useDragTouch(
  ref: RefObject<HTMLElement | null>,
  options: Options
): void {
  const opts = useRef<Options>(options);
  opts.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const node: HTMLElement = el;

    let clone:       HTMLElement | null = null;
    let offsetX    = 0;
    let offsetY    = 0;
    let startX     = 0;
    let startY     = 0;
    let dragActive = false;
    let cancelled  = false;
    let timer:       ReturnType<typeof setTimeout> | null = null;

    /* ── Clone ──────────────────────────────────────────── */
    function createClone(clientX: number, clientY: number) {
      const rect     = node.getBoundingClientRect();
      const computed = window.getComputedStyle(node);

      offsetX = clientX - rect.left;
      offsetY = clientY - rect.top;

      clone = node.cloneNode(true) as HTMLElement;
      clone.removeAttribute("id");
      clone.style.cssText = `
        position: fixed !important;
        left: ${rect.left}px;
        top:  ${rect.top}px;
        width:  ${rect.width}px;
        height: ${rect.height}px;
        margin: 0 !important;
        z-index: 9999;
        pointer-events: none;
        opacity: 0.92;
        transform: rotate(2deg) scale(1.08);
        box-shadow: 0 20px 48px rgba(0,0,0,0.25);
        border-radius: ${computed.borderRadius};
        transition: transform 0.12s ease, box-shadow 0.12s ease;
        will-change: left, top;
        overflow: hidden;
      `;
      document.body.appendChild(clone);
      node.style.opacity = "0.3";
    }

    function moveClone(clientX: number, clientY: number) {
      if (!clone) return;
      clone.style.left       = `${clientX - offsetX}px`;
      clone.style.top        = `${clientY - offsetY}px`;
      clone.style.transition = "none"; // supprime l'animation d'entrée après 1er move
    }

    function removeClone() {
      clone?.remove();
      clone = null;
      node.style.opacity = "";
    }

    /* ── Détection du slot ──────────────────────────────── */
    function findSlot(clientX: number, clientY: number): SlotTarget | null {
      if (clone) clone.style.visibility = "hidden";
      const hit = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      if (clone) clone.style.visibility = "";
      const slot = hit?.closest<HTMLElement>("[data-slot]");
      if (!slot?.dataset.date || !slot?.dataset.time) return null;
      return { date: slot.dataset.date, time: slot.dataset.time };
    }

    /* ── Nettoyage des listeners document ───────────────── */
    function detach() {
      if (timer) { clearTimeout(timer); timer = null; }
      dragActive = false;
      cancelled  = false;
      document.removeEventListener("touchmove",   onDocMove);
      document.removeEventListener("touchend",    onDocEnd);
      document.removeEventListener("touchcancel", onDocCancel);
    }

    /* ── TOUCH — listeners sur document ─────────────────── */

    function onDocMove(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;

      if (!dragActive) {
        // Long-press pas encore confirmé : vérifier si l'utilisateur scrolle
        const dx = Math.abs(t.clientX - startX);
        const dy = Math.abs(t.clientY - startY);
        if (dx > SCROLL_CANCEL || dy > SCROLL_CANCEL) {
          // Mouvement trop grand → c'est un scroll, on annule le drag
          if (timer) { clearTimeout(timer); timer = null; }
          cancelled = true;
          detach();
          // Ne PAS appeler preventDefault : iOS gère le scroll normalement
        }
        return;
      }

      // Drag actif → MAINTENANT on peut appeler preventDefault sans risque
      e.preventDefault();
      moveClone(t.clientX, t.clientY);
      opts.current.onDragOver?.(findSlot(t.clientX, t.clientY));
    }

    function onDocEnd(e: TouchEvent) {
      const wasDrag      = dragActive;
      const wasCancelled = cancelled;
      detach();

      if (wasDrag && clone) {
        const t    = e.changedTouches[0];
        const slot = findSlot(t.clientX, t.clientY);
        removeClone();
        opts.current.onDragOver?.(null);
        opts.current.onDrop(slot);
      } else if (!wasDrag && !wasCancelled) {
        // Relâché rapidement → tap
        opts.current.onTap();
      }
      // Si wasCancelled → scroll iOS, on ne fait rien
    }

    function onDocCancel() {
      detach();
      if (clone) { removeClone(); opts.current.onDragOver?.(null); opts.current.onCancel?.(); }
    }

    /* ── touchstart sur l'élément ──────────────────────────
       PAS de e.preventDefault() ici.
       Sur iOS Safari, l'appeler dans touchstart à l'intérieur d'un
       conteneur scrollable déclenche touchcancel immédiat. */
    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;

      const t  = e.touches[0];
      startX   = t.clientX;
      startY   = t.clientY;
      dragActive  = false;
      cancelled   = false;

      // Démarrer le timer du long-press
      timer = setTimeout(() => {
        timer      = null;
        dragActive = true;
        createClone(startX, startY);
        opts.current.onDragStart?.();
      }, LONG_PRESS_MS);

      // Attacher les listeners sur document.
      // onDocMove est { passive:false } pour pouvoir appeler preventDefault
      // une fois que dragActive est true. Avant ça, on ne l'appelle pas.
      document.addEventListener("touchmove",   onDocMove,   { passive: false });
      document.addEventListener("touchend",    onDocEnd);
      document.addEventListener("touchcancel", onDocCancel);
    }

    /* ── MOUSE (desktop) ─────────────────────────────────── */

    function onMouseMove(e: MouseEvent) {
      if (!clone) return;
      moveClone(e.clientX, e.clientY);
      opts.current.onDragOver?.(findSlot(e.clientX, e.clientY));
    }

    function onMouseUp(e: MouseEvent) {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
      if (!clone) return;
      const slot = findSlot(e.clientX, e.clientY);
      removeClone();
      opts.current.onDragOver?.(null);
      opts.current.onDrop(slot);
    }

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return;
      e.preventDefault();
      startX = e.clientX; startY = e.clientY;
      createClone(e.clientX, e.clientY);
      opts.current.onDragStart?.();
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup",   onMouseUp);
    }

    /* ── Enregistrement ─────────────────────────────────── */
    node.addEventListener("touchstart", onTouchStart);
    node.addEventListener("mousedown",  onMouseDown);

    return () => {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("mousedown",  onMouseDown);
      detach();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
      removeClone();
    };
  }, [ref]);
}
