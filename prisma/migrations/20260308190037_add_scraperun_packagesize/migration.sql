-- CreateEnum
CREATE TYPE "ScrapeStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "PriceEntry" ADD COLUMN     "packageSize" INTEGER,
ADD COLUMN     "shippingCost" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "freeShippingThreshold" DECIMAL(10,2),
ADD COLUMN     "shippingNote" TEXT;

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "ScrapeStatus" NOT NULL DEFAULT 'RUNNING',
    "productsScraped" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrapeRun_storeId_startedAt_idx" ON "ScrapeRun"("storeId", "startedAt");

-- CreateIndex
CREATE INDEX "ScrapeRun_status_idx" ON "ScrapeRun"("status");

-- AddForeignKey
ALTER TABLE "ScrapeRun" ADD CONSTRAINT "ScrapeRun_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
