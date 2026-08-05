-- DropForeignKey
ALTER TABLE "PriceSnapshot" DROP CONSTRAINT "PriceSnapshot_cardId_fkey";

-- DropForeignKey
ALTER TABLE "PriceSnapshot" DROP CONSTRAINT "PriceSnapshot_sealedId_fkey";

-- AlterTable
ALTER TABLE "Card" DROP COLUMN "priceRatio";

-- AlterTable
ALTER TABLE "SealedProduct" DROP COLUMN "priceRatio";

-- DropTable
DROP TABLE "PriceSnapshot";

