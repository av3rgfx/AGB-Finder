"use client";

import { useState, type ReactNode } from "react";

/**
 * Foto prodotto estratta dal listino, servita da /api/product-image (dietro auth).
 * `<img>` nativo (i JPEG2000 del listino sono estratti in PNG). Su 404/errore mostra
 * `fallback` (se fornito), altrimenti si nasconde.
 */
export function ProductImage({
  code,
  className,
  alt,
  fallback,
}: {
  code: string;
  className?: string;
  alt?: string;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback ?? null}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sorgente dinamica dietro auth, non da ottimizzare
    <img
      src={`/api/product-image?code=${encodeURIComponent(code)}`}
      alt={alt ?? `Foto del prodotto ${code}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
