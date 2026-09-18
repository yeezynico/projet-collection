-- Les lignes existantes valaient toutes sortOrder = 0 (valeur par défaut de
-- la migration précédente) : deux cartes jamais déplacées se retrouvaient
-- alors avec la même valeur, et un glisser-déposer entre elles calculait un
-- nouveau sortOrder identique (0+0)/2 = 0, qui ne changeait donc rien après
-- rafraîchissement. On donne ici à chaque ligne une valeur unique dérivée de
-- sa date de création, dans le même sens que les nouvelles lignes
-- (`-Date.now()` côté application) : plus récent = valeur plus négative =
-- affiché en premier, exactement l'ordre déjà visible aujourd'hui.

UPDATE "WatchedCard"
SET "sortOrder" = -(EXTRACT(EPOCH FROM "createdAt") * 1000)
WHERE "sortOrder" = 0;

UPDATE "SealedProduct"
SET "sortOrder" = -(EXTRACT(EPOCH FROM "createdAt") * 1000)
WHERE "sortOrder" = 0;
