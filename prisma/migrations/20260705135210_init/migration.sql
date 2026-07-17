-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MARKETER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "WorkCategory" AS ENUM ('BRAND_BLOG', 'BLOG_DISTRIBUTION', 'BLOG_SEO', 'RECEIPT_REVIEW', 'PLACE_RANKING', 'SNS_MANAGEMENT', 'ACCOUNT_MANAGEMENT', 'MONTHLY_REPORT', 'PERFORMANCE_COLLECTION');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'REVIEW_NEEDED', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('DRAFT', 'ISSUED', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "ExpenseReviewStatus" AS ENUM ('UNREVIEWED', 'REVIEWED', 'EXCLUDED', 'NEEDS_FOLLOW_UP');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'HALF_DAY_AM', 'HALF_DAY_PM', 'SICK', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'REVIEW_NEEDED', 'APPROVED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('INTERNAL', 'GOOGLE', 'NAVER');

-- CreateEnum
CREATE TYPE "CalendarEventKind" AS ENUM ('TASK', 'CLIENT_MEETING', 'REPORT_DEADLINE', 'LEAVE', 'INTERNAL_INSTRUCTION');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CARD', 'CASH', 'VIRTUAL_ACCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL', 'KAKAOPAY', 'TOSSPAYMENTS', 'INICIS', 'OTHER');

-- CreateEnum
CREATE TYPE "FinancialAccountType" AS ENUM ('BANK', 'CARD');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "ClientAccountPlatform" AS ENUM ('BLOG', 'SNS', 'PLACE', 'RECEIPT_REVIEW', 'ANALYTICS', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('BLOG_POST', 'SNS_POST', 'CARD_NEWS', 'SHORT_VIDEO', 'REVIEW_GUIDE');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('RESEARCH', 'DRAFTING', 'COMPLIANCE_REVIEW', 'READY', 'SCHEDULED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ComplianceVerdict" AS ENUM ('PENDING', 'PASS', 'WARN', 'BLOCK');

-- CreateEnum
CREATE TYPE "PublishChannel" AS ENUM ('NAVER_BLOG', 'WORDPRESS', 'INSTAGRAM', 'PLACE', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "canAccessSettings" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "kakaoId" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "googleCalendarConnected" BOOLEAN NOT NULL DEFAULT false,
    "naverCalendarConnected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessScope" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "marketerId" TEXT,
    "clientId" TEXT,
    "allMarketers" BOOLEAN NOT NULL DEFAULT false,
    "allClients" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "businessNumber" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "monthlyContractFee" DECIMAL(12,2),
    "serviceNotes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assignedMarketerId" TEXT,
    "industryCategoryId" TEXT,
    "industryCustom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAccount" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "managerId" TEXT,
    "platform" "ClientAccountPlatform",
    "channelTypeId" TEXT,
    "usernameEnc" TEXT,
    "passwordEnc" TEXT,
    "label" TEXT NOT NULL,
    "handle" TEXT,
    "loginReference" TEXT,
    "credentialHint" TEXT,
    "externalUrl" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "WorkCategory" NOT NULL,
    "defaultPriority" INTEGER NOT NULL DEFAULT 3,
    "estimatedHours" DECIMAL(6,2),
    "cadenceDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdById" TEXT,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "category" "WorkCategory" NOT NULL,
    "status" "WorkStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "dueDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "progressNotes" TEXT,
    "resultSummary" TEXT,
    "attachmentUrl" TEXT,
    "parentId" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "estimatedMinutes" INTEGER,
    "workCategoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "provider" "CalendarProvider" NOT NULL DEFAULT 'INTERNAL',
    "kind" "CalendarEventKind" NOT NULL,
    "syncStatus" "ConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "syncError" TEXT,
    "externalEventId" TEXT,
    "externalCalendarId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "clientId" TEXT,
    "workItemId" TEXT,
    "leaveRequestId" TEXT,
    "reportId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "issuedById" TEXT,
    "billingMonth" TIMESTAMP(3) NOT NULL,
    "contractAmount" DECIMAL(12,2) NOT NULL,
    "issuedAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "status" "BillingStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceNumber" TEXT,
    "dueDate" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "pgProvider" "PaymentProvider",
    "pgCustomerReference" TEXT,
    "webhookStatus" TEXT,
    "reconciliationStatus" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "billingRecordId" TEXT NOT NULL,
    "recordedById" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "method" "PaymentMethod" NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "transactionId" TEXT,
    "providerPaymentId" TEXT,
    "virtualAccountNumber" TEXT,
    "webhookStatus" TEXT,
    "reconciliationStatus" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "submittedById" TEXT,
    "reviewedById" TEXT,
    "financialAccountId" TEXT,
    "category" TEXT NOT NULL,
    "vendor" TEXT,
    "memo" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2),
    "paymentMethod" "PaymentMethod" NOT NULL,
    "reviewStatus" "ExpenseReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "paidAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "excludedReason" TEXT,
    "syncProvider" TEXT,
    "externalTransactionId" TEXT,
    "externalReference" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "type" "FinancialAccountType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "institutionName" TEXT,
    "accountLast4" TEXT,
    "cardLast4" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectionStatus" "ConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "provider" TEXT,
    "externalAccountId" TEXT,
    "syncCursor" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "annualDays" DECIMAL(5,2) NOT NULL,
    "carryOverDays" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "usedDays" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "approverId" TEXT,
    "leavePolicyId" TEXT,
    "type" "LeaveType" NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'REQUESTED',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "daysRequested" DECIMAL(5,2) NOT NULL,
    "reason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "workItemId" TEXT,
    "reportingMonth" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "metrics" JSONB,
    "notes" TEXT,
    "attachmentUrl" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

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

-- CreateTable
CREATE TABLE "KeywordResearch" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "workItemId" TEXT,
    "seedKeyword" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeywordResearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAsset" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "workItemId" TEXT,
    "type" "ContentType" NOT NULL,
    "stage" "PipelineStage" NOT NULL DEFAULT 'RESEARCH',
    "title" TEXT,
    "bodyMarkdown" TEXT,
    "meta" JSONB,
    "complianceVerdict" "ComplianceVerdict" NOT NULL DEFAULT 'PENDING',
    "complianceNotes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeAsset" (
    "id" TEXT NOT NULL,
    "contentAssetId" TEXT,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT,
    "provider" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishJob" (
    "id" TEXT NOT NULL,
    "contentAssetId" TEXT NOT NULL,
    "channel" "PublishChannel" NOT NULL,
    "clientAccountId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "externalUrl" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_kakaoId_key" ON "User"("kakaoId");

-- CreateIndex
CREATE INDEX "AccessScope_adminId_idx" ON "AccessScope"("adminId");

-- CreateIndex
CREATE INDEX "AccessScope_marketerId_idx" ON "AccessScope"("marketerId");

-- CreateIndex
CREATE INDEX "AccessScope_clientId_idx" ON "AccessScope"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_code_key" ON "Client"("code");

-- CreateIndex
CREATE INDEX "Client_assignedMarketerId_idx" ON "Client"("assignedMarketerId");

-- CreateIndex
CREATE INDEX "Client_industryCategoryId_idx" ON "Client"("industryCategoryId");

-- CreateIndex
CREATE INDEX "ClientAccount_clientId_platform_idx" ON "ClientAccount"("clientId", "platform");

-- CreateIndex
CREATE INDEX "ClientAccount_managerId_idx" ON "ClientAccount"("managerId");

-- CreateIndex
CREATE INDEX "ClientAccount_channelTypeId_idx" ON "ClientAccount"("channelTypeId");

-- CreateIndex
CREATE INDEX "WorkTemplate_category_active_idx" ON "WorkTemplate"("category", "active");

-- CreateIndex
CREATE INDEX "WorkTemplate_createdById_idx" ON "WorkTemplate"("createdById");

-- CreateIndex
CREATE INDEX "WorkItem_clientId_status_dueDate_idx" ON "WorkItem"("clientId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "WorkItem_ownerId_status_dueDate_idx" ON "WorkItem"("ownerId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "WorkItem_templateId_idx" ON "WorkItem"("templateId");

-- CreateIndex
CREATE INDEX "WorkItem_createdById_idx" ON "WorkItem"("createdById");

-- CreateIndex
CREATE INDEX "WorkItem_parentId_idx" ON "WorkItem"("parentId");

-- CreateIndex
CREATE INDEX "WorkItem_ownerId_scheduledStart_idx" ON "WorkItem"("ownerId", "scheduledStart");

-- CreateIndex
CREATE INDEX "WorkItem_workCategoryId_idx" ON "WorkItem"("workCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_leaveRequestId_key" ON "CalendarEvent"("leaveRequestId");

-- CreateIndex
CREATE INDEX "CalendarEvent_startsAt_endsAt_idx" ON "CalendarEvent"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_clientId_idx" ON "CalendarEvent"("clientId");

-- CreateIndex
CREATE INDEX "CalendarEvent_workItemId_idx" ON "CalendarEvent"("workItemId");

-- CreateIndex
CREATE INDEX "CalendarEvent_reportId_idx" ON "CalendarEvent"("reportId");

-- CreateIndex
CREATE INDEX "CalendarEvent_createdById_idx" ON "CalendarEvent"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_invoiceNumber_key" ON "BillingRecord"("invoiceNumber");

-- CreateIndex
CREATE INDEX "BillingRecord_status_dueDate_idx" ON "BillingRecord"("status", "dueDate");

-- CreateIndex
CREATE INDEX "BillingRecord_issuedById_idx" ON "BillingRecord"("issuedById");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_clientId_billingMonth_key" ON "BillingRecord"("clientId", "billingMonth");

-- CreateIndex
CREATE INDEX "PaymentRecord_billingRecordId_receivedAt_idx" ON "PaymentRecord"("billingRecordId", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentRecord_recordedById_idx" ON "PaymentRecord"("recordedById");

-- CreateIndex
CREATE INDEX "ExpenseRecord_clientId_idx" ON "ExpenseRecord"("clientId");

-- CreateIndex
CREATE INDEX "ExpenseRecord_financialAccountId_idx" ON "ExpenseRecord"("financialAccountId");

-- CreateIndex
CREATE INDEX "ExpenseRecord_reviewStatus_paidAt_idx" ON "ExpenseRecord"("reviewStatus", "paidAt");

-- CreateIndex
CREATE INDEX "ExpenseRecord_submittedById_idx" ON "ExpenseRecord"("submittedById");

-- CreateIndex
CREATE INDEX "ExpenseRecord_reviewedById_idx" ON "ExpenseRecord"("reviewedById");

-- CreateIndex
CREATE INDEX "FinancialAccount_type_isActive_idx" ON "FinancialAccount"("type", "isActive");

-- CreateIndex
CREATE INDEX "LeavePolicy_year_idx" ON "LeavePolicy"("year");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicy_userId_year_key" ON "LeavePolicy"("userId", "year");

-- CreateIndex
CREATE INDEX "LeaveRequest_requesterId_status_startDate_idx" ON "LeaveRequest"("requesterId", "status", "startDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_approverId_idx" ON "LeaveRequest"("approverId");

-- CreateIndex
CREATE INDEX "LeaveRequest_leavePolicyId_idx" ON "LeaveRequest"("leavePolicyId");

-- CreateIndex
CREATE INDEX "Report_authorId_idx" ON "Report"("authorId");

-- CreateIndex
CREATE INDEX "Report_reviewerId_idx" ON "Report"("reviewerId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_workItemId_idx" ON "Report"("workItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_clientId_reportingMonth_key" ON "Report"("clientId", "reportingMonth");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

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
CREATE INDEX "KeywordResearch_clientId_collectedAt_idx" ON "KeywordResearch"("clientId", "collectedAt");

-- CreateIndex
CREATE INDEX "KeywordResearch_workItemId_idx" ON "KeywordResearch"("workItemId");

-- CreateIndex
CREATE INDEX "ContentAsset_clientId_stage_idx" ON "ContentAsset"("clientId", "stage");

-- CreateIndex
CREATE INDEX "ContentAsset_workItemId_idx" ON "ContentAsset"("workItemId");

-- CreateIndex
CREATE INDEX "ContentAsset_createdById_idx" ON "ContentAsset"("createdById");

-- CreateIndex
CREATE INDEX "CreativeAsset_clientId_idx" ON "CreativeAsset"("clientId");

-- CreateIndex
CREATE INDEX "CreativeAsset_contentAssetId_idx" ON "CreativeAsset"("contentAssetId");

-- CreateIndex
CREATE INDEX "PublishJob_channel_status_scheduledAt_idx" ON "PublishJob"("channel", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "PublishJob_contentAssetId_idx" ON "PublishJob"("contentAssetId");

-- AddForeignKey
ALTER TABLE "AccessScope" ADD CONSTRAINT "AccessScope_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessScope" ADD CONSTRAINT "AccessScope_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessScope" ADD CONSTRAINT "AccessScope_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_assignedMarketerId_fkey" FOREIGN KEY ("assignedMarketerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_industryCategoryId_fkey" FOREIGN KEY ("industryCategoryId") REFERENCES "IndustryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_channelTypeId_fkey" FOREIGN KEY ("channelTypeId") REFERENCES "ChannelType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTemplate" ADD CONSTRAINT "WorkTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_workCategoryId_fkey" FOREIGN KEY ("workCategoryId") REFERENCES "WorkCategoryMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRecord" ADD CONSTRAINT "BillingRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRecord" ADD CONSTRAINT "BillingRecord_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_billingRecordId_fkey" FOREIGN KEY ("billingRecordId") REFERENCES "BillingRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicy" ADD CONSTRAINT "LeavePolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "LeavePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustryCategory" ADD CONSTRAINT "IndustryCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "IndustryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginHistory" ADD CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedBillingId_fkey" FOREIGN KEY ("matchedBillingId") REFERENCES "BillingRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordResearch" ADD CONSTRAINT "KeywordResearch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordResearch" ADD CONSTRAINT "KeywordResearch_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeAsset" ADD CONSTRAINT "CreativeAsset_contentAssetId_fkey" FOREIGN KEY ("contentAssetId") REFERENCES "ContentAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeAsset" ADD CONSTRAINT "CreativeAsset_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishJob" ADD CONSTRAINT "PublishJob_contentAssetId_fkey" FOREIGN KEY ("contentAssetId") REFERENCES "ContentAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishJob" ADD CONSTRAINT "PublishJob_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
