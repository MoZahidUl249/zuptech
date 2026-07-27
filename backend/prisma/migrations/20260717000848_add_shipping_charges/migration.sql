-- CreateTable
CREATE TABLE "ShippingCharge" (
    "district" TEXT NOT NULL,
    "fee" INTEGER NOT NULL,
    "freeAbove" INTEGER NOT NULL DEFAULT 0,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShippingCharge_pkey" PRIMARY KEY ("district")
);
