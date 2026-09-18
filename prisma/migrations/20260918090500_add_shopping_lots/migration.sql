-- CreateTable
CREATE TABLE "ShoppingLot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShoppingLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ShoppingLotToWatchedCard" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ShoppingLotToWatchedCard_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ShoppingLotToWatchedCard_B_index" ON "_ShoppingLotToWatchedCard"("B");

-- AddForeignKey
ALTER TABLE "ShoppingLot" ADD CONSTRAINT "ShoppingLot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShoppingLotToWatchedCard" ADD CONSTRAINT "_ShoppingLotToWatchedCard_A_fkey" FOREIGN KEY ("A") REFERENCES "ShoppingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShoppingLotToWatchedCard" ADD CONSTRAINT "_ShoppingLotToWatchedCard_B_fkey" FOREIGN KEY ("B") REFERENCES "WatchedCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Préserve la sélection en cours : l'ancien panier (inBasket = true) devient
-- un lot "Panier" par utilisateur concerné, pour ne rien perdre au passage
-- vers les lots nommés.
INSERT INTO "ShoppingLot" ("id", "userId", "name", "createdAt")
SELECT gen_random_uuid(), "userId", 'Panier', now()
FROM "WatchedCard"
WHERE "inBasket" = true
GROUP BY "userId";

INSERT INTO "_ShoppingLotToWatchedCard" ("A", "B")
SELECT lot."id", wc."id"
FROM "WatchedCard" wc
JOIN "ShoppingLot" lot ON lot."userId" = wc."userId" AND lot."name" = 'Panier'
WHERE wc."inBasket" = true;

-- AlterTable
ALTER TABLE "WatchedCard" DROP COLUMN "inBasket";
