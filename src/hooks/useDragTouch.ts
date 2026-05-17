"use client";

import { RefObject, useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────────
   useDragTouch
   Drag-and-drop via touch (iOS / Android) + souris (desktop).
   Stratégie :
     1. touchstart / mousedown  → clone l'élément, l'ajoute au <body>
        avec position:fixed → le clone suit le doigt sans dépendre
        des conteneurs scrollables ou de pointer capture.
     2. touchmove  / mousemove  → déplace le clone, détecte le slot
        sous le doigt via elementFromPoint (clone caché pendant la lecture).
     3. touchend   / mouseup    → supprime le clone, retourne la cible.
   Les listeners touch utilisent { passive: false } pour que
   e.preventDefault() fonctionne et bloque le scroll iOS.
───────────────────────────────────────────────────────────────── */

export interface SlotTarget {
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
}

interface Options {
  /** Appelé au début du drag */
  onDragStart?: () => void;
  /** Appelé en continu avec le slot survolé (null si aucun) */
  onDragOver?: (target: SlotTarget | null) => void;
  /** Appelé au lâcher avec le slot cible (null si raté) */
  onDrop: (target: SlotTarget | null) => void;
  /** Appelé si l'utilisateur n'a pas bougé (tap simple) */
  onTap: () => void;
  /** Appelé en cas d'annulation (touchcancel) */
  onCancel?: () => void;
}

const MOVE_THRESHOLD = 6; // px avant d'activer le drag

export function useDragTouch(
  ref: RefObject<HTMLElement | null>,
  options: Options
): void {
  // On garde une ref vers les options pour éviter les closures périmées
  const opts = useRef<Options>(options);
  opts.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const node: HTMLElement = el;

    let clone: HTMLElement | null = null;
    let offsetX = 0;
    let offsetY = 0;
    let startX = 0;
    let startY = 0;
    let moved = false;

    /* ── Clone ─────────────────────────────────────────── */
    function createClone(clientX: number, clientY: number) {
      const rect = node.getBoundingClientRect();
      const computed = window.getComputedStyle(node);

      // Offset = là où le doigt/curseur touche l'élément
      offsetX = clientX - rect.left;
      offsetY = clientY - rect.top;

      clone = node.cloneNode(true) as HTMLElement;
      clone.removeAttribute("id");

      // Styles inline : surcharge tout sans casser les classes Tailwind du clone
      clone.style.cssText = `
        position: fixed !important;
        left: ${rect.left}px;
        top: ${rect.top}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        margin: 0 !important;
        padding: ${computed.padding} !important;
        z-index: 9999;
        pointer-events: none;
        opacity: 0.93;
        transform: rotate(2deg) scale(1.07);
        box-shadow: 0 20px 48px rgba(0,0,0,0.22);
        border-radius: ${computed.borderRadius};
        transition: none !important;
        will-change: left, top;
        overflow: hidden;
      `;

      document.body.appendChild(clone);

      // Estompe l'original pour indiquer visuellement qu'il est "soulevé"
      node.style.opacity = "0.3";
    }

    function moveClone(clientX: number, clientY: number) {
      if (!clone) return;
      clone.style.left = `${clientX - offsetX}px`;
      clone.style.top  = `${clientY - offsetY}px`;
    }

    function removeClone() {
      clone?.remove();
      clone = null;
      node.style.opacity = "";
    }

    /* ── Détection du slot sous le doigt ───────────────── */
    function findSlot(clientX: number, clientY: number): SlotTarget | null {
      // On cache le clone pour que elementFromPoint "voie" ce qui est en dessous
      if (clone) clone.style.visibility = "hidden";
      const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      if (clone) clone.style.visibility = "";

      const slot = target?.closest<HTMLElement>("[data-slot]");
      if (!slot?.dataset.date || !slot?.dataset.time) return null;
      return { date: slot.dataset.date, time: slot.dataset.time };
    }

    /* ── TOUCH ─────────────────────────────────────────── */

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      e.preventDefault(); // Bloque : scroll, zoom, long-press callout iOS
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      moved = false;
      opts.current.onDragStart?.();
      createClone(t.clientX, t.clientY);
    }

    function onTouchMove(e: TouchEvent) {
      if (!clone || e.touches.length !== 1) return;
      e.preventDefault(); // Empêche iOS de reclasser ce touch comme scroll
      const t = e.touches[0];

      if (!moved) {
        const dx = Math.abs(t.clientX - startX);
        const dy = Math.abs(t.clientY - startY);
        if (dx < MOVE_THRESHOLD && dy < MOVE_THRESHOLD) return;
        moved = true;
      }

      moveClone(t.clientX, t.clientY);
      opts.current.onDragOver?.(findSlot(t.clientX, t.clientY));
    }

    function onTouchEnd(e: TouchEvent) {
      if (!clone) return;
      const t = e.changedTouches[0];
      const slot = findSlot(t.clientX, t.clientY);
      removeClone();

      if (moved) {
        opts.current.onDrop(slot);
      } else {
        opts.current.onDragOver?.(null); // nettoyage highlight
        opts.current.onTap();
      }
      moved = false;
    }

    function onTouchCancel() {
      removeClone();
      moved = false;
      opts.current.onDragOver?.(null);
      opts.current.onCancel?.();
    }

    /* ── MOUSE (desktop) ───────────────────────────────── */
    // mousemove et mouseup sur window → le curseur peut sortir de l'élément

    function onMouseMove(e: MouseEvent) {
      if (!clone) return;
      if (!moved) {
        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);
        if (dx < MOVE_THRESHOLD && dy < MOVE_THRESHOLD) return;
        moved = true;
      }
      moveClone(e.clientX, e.clientY);
      opts.current.onDragOver?.(findSlot(e.clientX, e.clientY));
    }

    function onMouseUp(e: MouseEvent) {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
      if (!clone) return;
      const slot = findSlot(e.clientX, e.clientY);
      removeClone();

      if (moved) {
        opts.current.onDrop(slot);
      } else {
        opts.current.onDragOver?.(null);
        opts.current.onTap();
      }
      moved = false;
    }

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return;
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      moved = false;
      opts.current.onDragStart?.();
      createClone(e.clientX, e.clientY);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup",   onMouseUp);
    }

    /* ── Enregistrement ────────────────────────────────── */
    el.addEventListener("touchstart",  onTouchStart,  { passive: false });
    el.addEventListener("touchmove",   onTouchMove,   { passive: false });
    el.addEventListener("touchend",    onTouchEnd);
    el.addEventListener("touchcancel", onTouchCancel);
    el.addEventListener("mousedown",   onMouseDown);

    return () => {
      el.removeEventListener("touchstart",  onTouchStart);
      el.removeEventListener("touchmove",   onTouchMove);
      el.removeEventListener("touchend",    onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
      el.removeEventListener("mousedown",   onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
      removeClone();
    };
  }, [ref]);
}
