-- CreateTable
CREATE TABLE "PageHero" (
    "id" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'plain',
    "background" TEXT NOT NULL DEFAULT '',
    "overlay" INTEGER NOT NULL DEFAULT 55,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageHero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeroPoster" (
    "id" TEXT NOT NULL,
    "heroId" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "href" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HeroPoster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PageHero_pageKey_key" ON "PageHero"("pageKey");

-- CreateIndex
CREATE INDEX "HeroPoster_heroId_idx" ON "HeroPoster"("heroId");

-- AddForeignKey
ALTER TABLE "HeroPoster" ADD CONSTRAINT "HeroPoster_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "PageHero"("id") ON DELETE CASCADE ON UPDATE CASCADE;
