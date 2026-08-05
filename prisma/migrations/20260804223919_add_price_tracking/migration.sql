-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "SealedProduct" ADD COLUMN     "externalId" TEXT;

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT,
    "sealedId" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceSnapshot_cardId_createdAt_idx" ON "PriceSnapshot"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "PriceSnapshot_sealedId_createdAt_idx" ON "PriceSnapshot"("sealedId", "createdAt");

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_sealedId_fkey" FOREIGN KEY ("sealedId") REFERENCES "SealedProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
