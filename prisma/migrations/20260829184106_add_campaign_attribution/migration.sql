-- CreateTable
CREATE TABLE "CampaignExposure" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convertedAt" TIMESTAMP(3),
    "orderId" TEXT,

    CONSTRAINT "CampaignExposure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignExposure_campaignId_exposedAt_idx" ON "CampaignExposure"("campaignId", "exposedAt");

-- CreateIndex
CREATE INDEX "CampaignExposure_campaignId_userId_idx" ON "CampaignExposure"("campaignId", "userId");

-- CreateIndex
CREATE INDEX "CampaignExposure_orderId_idx" ON "CampaignExposure"("orderId");

-- AddForeignKey
ALTER TABLE "CampaignExposure" ADD CONSTRAINT "CampaignExposure_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignExposure" ADD CONSTRAINT "CampaignExposure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
