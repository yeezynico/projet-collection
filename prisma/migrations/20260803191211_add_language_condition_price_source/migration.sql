-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "condition" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "priceSource" TEXT,
ADD COLUMN     "priceUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SealedProduct" ADD COLUMN     "condition" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "priceSource" TEXT,
ADD COLUMN     "priceUpdatedAt" TIMESTAMP(3);
