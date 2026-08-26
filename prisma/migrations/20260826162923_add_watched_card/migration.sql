-- CreateTable
CREATE TABLE "WatchedCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "extension" TEXT,
    "number" TEXT,
    "category" TEXT,
    "language" TEXT,
    "condition" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "currentPrice" DOUBLE PRECISION,
    "priceSource" TEXT,
    "priceUpdatedAt" TIMESTAMP(3),
    "imageUrl" TEXT,
    "cardmarketUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchedCard_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WatchedCard" ADD CONSTRAINT "WatchedCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

