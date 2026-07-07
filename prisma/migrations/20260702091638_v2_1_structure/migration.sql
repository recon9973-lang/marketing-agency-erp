-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "industryCategoryId" TEXT,
ADD COLUMN     "industryCustom" TEXT;

-- AlterTable
ALTER TABLE "ClientAccount" ADD COLUMN     "channelTypeId" TEXT,
ADD COLUMN     "passwordEnc" TEXT,
ADD COLUMN     "usernameEnc" TEXT,
ALTER COLUMN "platform" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WorkItem" ADD COLUMN     "estimatedMinutes" INTEGER,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "scheduledEnd" TIMESTAMP(3),
ADD COLUMN     "scheduledStart" TIMESTAMP(3),
ADD COLUMN     "sequence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workCategoryId" TEXT;

-- CreateTable
CREATE TABLE "IndustryCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "colorTag" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndustryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkCategoryMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "colorTag" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkCategoryMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorTag" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "logoutAt" TIMESTAMP(3),

    CONSTRAINT "LoginHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "txDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "counterpartyName" TEXT,
    "memo" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "matchedBillingId" TEXT,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySetting" (
    "id" TEXT NOT NULL,
    "adminCanManageExpense" BOOLEAN NOT NULL DEFAULT false,
    "auditRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "workloadDailyMinutes" INTEGER NOT NULL DEFAULT 480,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IndustryCategory_parentId_idx" ON "IndustryCategory"("parentId");

-- CreateIndex
CREATE INDEX "IndustryCategory_isActive_sortOrder_idx" ON "IndustryCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "WorkCategoryMaster_isActive_sortOrder_idx" ON "WorkCategoryMaster"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ChannelType_isActive_sortOrder_idx" ON "ChannelType"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "LoginHistory_userId_at_idx" ON "LoginHistory"("userId", "at");

-- CreateIndex
CREATE INDEX "LoginHistory_at_idx" ON "LoginHistory"("at");

-- CreateIndex
CREATE INDEX "BankTransaction_matchStatus_txDate_idx" ON "BankTransaction"("matchStatus", "txDate");

-- CreateIndex
CREATE INDEX "BankTransaction_matchedBillingId_idx" ON "BankTransaction"("matchedBillingId");

-- CreateIndex
CREATE INDEX "Client_industryCategoryId_idx" ON "Client"("industryCategoryId");

-- CreateIndex
CREATE INDEX "ClientAccount_channelTypeId_idx" ON "ClientAccount"("channelTypeId");

-- CreateIndex
CREATE INDEX "WorkItem_parentId_idx" ON "WorkItem"("parentId");

-- CreateIndex
CREATE INDEX "WorkItem_ownerId_scheduledStart_idx" ON "WorkItem"("ownerId", "scheduledStart");

-- CreateIndex
CREATE INDEX "WorkItem_workCategoryId_idx" ON "WorkItem"("workCategoryId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_industryCategoryId_fkey" FOREIGN KEY ("industryCategoryId") REFERENCES "IndustryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_channelTypeId_fkey" FOREIGN KEY ("channelTypeId") REFERENCES "ChannelType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_workCategoryId_fkey" FOREIGN KEY ("workCategoryId") REFERENCES "WorkCategoryMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustryCategory" ADD CONSTRAINT "IndustryCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "IndustryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginHistory" ADD CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedBillingId_fkey" FOREIGN KEY ("matchedBillingId") REFERENCES "BillingRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

