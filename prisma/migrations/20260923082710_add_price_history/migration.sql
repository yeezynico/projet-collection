-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "cardId" TEXT,
    "sealedId" TEXT,
    "watchedId" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceHistory_cardId_date_key" ON "PriceHistory"("cardId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PriceHistory_sealedId_date_key" ON "PriceHistory"("sealedId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PriceHistory_watchedId_date_key" ON "PriceHistory"("watchedId", "date");

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_sealedId_fkey" FOREIGN KEY ("sealedId") REFERENCES "SealedProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_watchedId_fkey" FOREIGN KEY ("watchedId") REFERENCES "WatchedCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
