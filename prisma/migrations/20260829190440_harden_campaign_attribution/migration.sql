/*
  Warnings:

  - A unique constraint covering the columns `[orderId]` on the table `CampaignExposure` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "CampaignExposure_orderId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "CampaignExposure_orderId_key" ON "CampaignExposure"("orderId");

-- CreateIndex
CREATE INDEX "CampaignExposure_userId_exposedAt_idx" ON "CampaignExposure"("userId", "exposedAt");

-- AddForeignKey
ALTER TABLE "CampaignExposure" ADD CONSTRAINT "CampaignExposure_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
