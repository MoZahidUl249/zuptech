import { type AdminProduct } from "@/lib/admin";

/** A blank product row for the "Add product" draft. */
export function emptyDraftProduct(): AdminProduct {
  return {
    id: "",
    slug: "",
    name: "",
    categoryId: "",
    category: "",
    section: "",
    sku: "", // typed in by the admin — the server no longer invents one
    price: 0,
    cost: 0,
    minDepositPct: 0,
    recommendedIds: [],
    onSale: false,
    salePrice: 0,
    deliveryFeeInsideDhaka: 0,
    deliveryFeeOutsideDhaka: 0,
    installationFeeInsideDhaka: 0,
    installationFeeOutsideDhaka: 0,
    quantityOffers: [],
    freeDeliveryOffers: [],
    warrantyMonths: 0,
    rating: 0,
    sold: 0,
    imgHint: "product photo",
    specs: [],
    video: "",
    stock: 0,
    reserved: 0,
    reorderAt: 0,
    visible: false,
    description: "",
    photos: [],
  };
}
