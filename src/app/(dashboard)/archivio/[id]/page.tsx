import type { Metadata } from "next";
import { ProductDetail } from "@/components/product/product-detail";

export const metadata: Metadata = { title: "Dettaglio prodotto — UFPtrade" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-[1200px]">
      <ProductDetail productId={id} />
    </div>
  );
}
