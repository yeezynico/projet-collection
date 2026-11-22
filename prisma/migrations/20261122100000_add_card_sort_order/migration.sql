-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Chaque carte existante reçoit une valeur unique dérivée de sa date de
-- création (plus récente = plus négative = affichée en premier), pour
-- conserver l'ordre actuel et éviter les égalités à 0 qui rendraient le
-- glisser-déposer sans effet.
UPDATE "Card"
SET "sortOrder" = -(EXTRACT(EPOCH FROM "createdAt") * 1000);
