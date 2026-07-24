"use client";

import { useState } from "react";

/**
 * Foto prodotto estratta dal listino, servita da /api/product-image (dietro auth).
 * `<img>` nativo (niente PDF.js): i JPEG2000 del listino vengono estratti in PNG e
 * si vedono normalmente. Si nasconde da sola se il codice non ha immagine (404).
 */
export function ProductImage({ code, className }: { code: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sorgente dinamica dietro auth, non da ottimizzare
    <img
      src={`/api/product-image?code=${encodeURIComponent(code)}`}
      alt={`Foto del prodotto ${code}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
