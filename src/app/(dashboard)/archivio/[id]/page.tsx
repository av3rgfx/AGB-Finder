import type { Metadata } from "next";
import { ProductDetail } from "@/components/product/product-detail";

export const metadata: Metadata = { title: "Dettaglio prodotto — UFPtrade" };

// Next 15: params è una Promise.
export default async function ProdottoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetail id={id} />;
}
