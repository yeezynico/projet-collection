"use client";

import { useEffect, useRef } from "react";

/** Fenêtres ouvertes, de la plus ancienne à la plus récente. */
const STACK = [];

/**
 * Comportements attendus de toute fenêtre modale : fermeture par la touche
 * Échap — pour la fenêtre du dessus uniquement — et blocage du défilement de
 * la page en arrière-plan.
 *
 * Le rappel est conservé dans une référence : la fenêtre n'ajoute son écouteur
 * qu'à l'ouverture, sans le reposer à chaque frappe dans un formulaire.
 */
export function useModalDismiss(onClose, active = true) {
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!active) return;

    // Seule la fenêtre au sommet réagit : l'assistant de prix ouvert par-dessus
    // un formulaire d'édition ne doit pas refermer les deux d'un coup.
    const token = {};
    STACK.push(token);

    function onKey(e) {
      if (e.key === "Escape" && STACK[STACK.length - 1] === token) {
        close.current();
      }
    }

    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      STACK.splice(STACK.indexOf(token), 1);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [active]);
}

/**
 * Enveloppe commune des fenêtres modales : voile assombri, fermeture par Échap
 * ou par clic en dehors du panneau.
 *
 * À monter conditionnellement — `{editingCard && <Modal …>}` — pour que le
 * contenu ne soit évalué que lorsqu'il a des données à afficher.
 */
export default function Modal({
  onClose,
  children,
  className = "",
  panelClassName = "",
}) {
  useModalDismiss(onClose);

  return (
    <div
      className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${className}`}
      onClick={onClose}
    >
      {/* Le clic est arrêté ici : seul le voile ferme la fenêtre. */}
      <div onClick={(e) => e.stopPropagation()} className={panelClassName}>
        {children}
      </div>
    </div>
  );
}
