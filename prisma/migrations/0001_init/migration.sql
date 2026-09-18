-- CreateEnum
CREATE TYPE "PartNumberVerificationStatus" AS ENUM ('CANDIDATE', 'UNVERIFIED', 'VERIFIED', 'CONFLICT', 'REJECTED');

-- CreateEnum
CREATE TYPE "ModelEvidenceStatus" AS ENUM ('EXPLICIT', 'INFERRED', 'NOT_EXPLICIT');

-- CreateEnum
CREATE TYPE "DataConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "PartNumberPublishStatus" AS ENUM ('READY', 'HOLD', 'HIDDEN');

-- CreateTable
CREATE TABLE "Brand" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "country" TEXT,
    "logo" TEXT,
    "website" TEXT,
    "description" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "brandId" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "series" TEXT,
    "equipmentType" TEXT NOT NULL,
    "application" TEXT,
    "mineType" TEXT,
    "manufacturer" TEXT,
    "productionYear" INTEGER,
    "description" TEXT,
    "imageUrl" TEXT,
    "brochure" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "parentId" INTEGER,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartNumber" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "category" TEXT NOT NULL,
    "categoryId" INTEGER,
    "oldPartNumber" TEXT,
    "newPartNumber" TEXT,
    "alternativePartNumber" TEXT,
    "oemStatus" TEXT NOT NULL DEFAULT 'AFTERMARKET',
    "description" TEXT,
    "application" TEXT,
    "specification" TEXT,
    "material" TEXT,
    "drawing" TEXT,
    "images" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "supplierCount" INTEGER NOT NULL DEFAULT 0,
    "inquiryCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "brandId" INTEGER,
    "equipmentId" INTEGER,
    "normalizedPartNumber" TEXT,
    "verificationStatus" "PartNumberVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "modelEvidence" "ModelEvidenceStatus" NOT NULL DEFAULT 'NOT_EXPLICIT',
    "confidence" "DataConfidence" NOT NULL DEFAULT 'MEDIUM',
    "publishStatus" "PartNumberPublishStatus" NOT NULL DEFAULT 'HOLD',
    "evidenceSummary" TEXT,
    "sourceFiles" TEXT,
    "originalDescriptionEn" TEXT,
    "originalDescriptionCn" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "verifiedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "partNumberId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "productType" TEXT NOT NULL DEFAULT 'AFTERMARKET',
    "oemNumber" TEXT,
    "description" TEXT,
    "specification" TEXT,
    "material" TEXT,
    "application" TEXT,
    "price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "moq" INTEGER,
    "stock" INTEGER,
    "stockStatus" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "leadTime" TEXT,
    "warranty" TEXT,
    "images" TEXT,
    "datasheet" TEXT,
    "drawing" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "verificationReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" INTEGER,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" INTEGER,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "shortName" TEXT,
    "logo" TEXT,
    "province" TEXT,
    "city" TEXT,
    "address" TEXT,
    "contactName" TEXT,
    "position" TEXT,
    "mobile" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "wechat" TEXT,
    "whatsapp" TEXT,
    "mainBusiness" TEXT NOT NULL,
    "mainBrands" TEXT,
    "mainEquipment" TEXT,
    "description" TEXT,
    "factoryImages" TEXT,
    "certificates" TEXT,
    "verifiedStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "memberLevel" TEXT NOT NULL DEFAULT 'FREE',
    "businessLicense" TEXT,
    "rejectionReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" INTEGER,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" INTEGER,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "equipmentCount" INTEGER NOT NULL DEFAULT 0,
    "partNumberCount" INTEGER NOT NULL DEFAULT 0,
    "responseRate" DOUBLE PRECISION,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "inquiryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'BUYER',
    "supplierId" INTEGER,
    "buyerCompanyId" INTEGER,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "position" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "emailVerified" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerCompany" (
    "id" SERIAL NOT NULL,
    "companyName" TEXT NOT NULL,
    "unifiedCode" TEXT,
    "licenseImage" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "region" TEXT,
    "address" TEXT,
    "verifiedStatus" TEXT NOT NULL DEFAULT 'UNSUBMITTED',
    "rejectionReason" TEXT,
    "level" TEXT NOT NULL DEFAULT 'NORMAL',
    "ownerUserId" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "partNumberId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFQ" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "userID" INTEGER,
    "companyID" INTEGER,
    "brandId" INTEGER,
    "equipmentId" INTEGER,
    "partNumberId" INTEGER,
    "categoryId" INTEGER,
    "productName" TEXT,
    "partNumberStr" TEXT,
    "equipmentModel" TEXT,
    "brandName" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "description" TEXT NOT NULL,
    "images" TEXT,
    "attachments" TEXT,
    "purchaseType" TEXT NOT NULL DEFAULT 'NORMAL',
    "deliveryDate" TIMESTAMP(3),
    "deliveryLocation" TEXT,
    "incoterm" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "whatsapp" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "matchedSuppliers" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COLLECTING',
    "region" TEXT,
    "rfqNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "RFQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" SERIAL NOT NULL,
    "rfqId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "productId" INTEGER,
    "unitPrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "quantity" INTEGER,
    "moq" INTEGER,
    "stockStatus" TEXT,
    "leadTime" TEXT,
    "warranty" TEXT,
    "paymentTerms" TEXT,
    "incoterm" TEXT,
    "remarks" TEXT,
    "attachments" TEXT,
    "totalAmount" DOUBLE PRECISION,
    "quotedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFQItem" (
    "id" SERIAL NOT NULL,
    "rfqId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 1,
    "brandId" INTEGER,
    "partNumberId" INTEGER,
    "brandName" TEXT,
    "equipmentModel" TEXT,
    "productName" TEXT,
    "partNumberStr" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "description" TEXT,
    "images" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RFQItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "rfqItemId" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "quantity" INTEGER,
    "leadTime" TEXT,
    "quality" TEXT,
    "moq" INTEGER,
    "stockStatus" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFQInvitation" (
    "id" SERIAL NOT NULL,
    "rfqId" INTEGER NOT NULL,
    "supplierId" INTEGER,
    "externalCompanyName" TEXT,
    "externalContactName" TEXT,
    "externalEmail" TEXT,
    "externalPhone" TEXT,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_VIEW',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "lastReminderAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFQInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "content" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartNumberRequest" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "partNumber" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "brandName" TEXT,
    "equipmentModel" TEXT,
    "categoryId" INTEGER,
    "description" TEXT,
    "images" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartNumberRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentRequest" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "brandId" INTEGER,
    "brandName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "series" TEXT,
    "equipmentType" TEXT NOT NULL,
    "application" TEXT,
    "mineType" TEXT,
    "manufacturer" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "position" TEXT NOT NULL DEFAULT 'HOME_TOP',
    "targetType" TEXT NOT NULL,
    "targetId" INTEGER,
    "targetUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartNumberEquipment" (
    "id" SERIAL NOT NULL,
    "partNumberId" INTEGER NOT NULL,
    "equipmentModelId" INTEGER NOT NULL,
    "evidenceStatus" "ModelEvidenceStatus" NOT NULL DEFAULT 'NOT_EXPLICIT',
    "verificationStatus" "PartNumberVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "evidenceSummary" TEXT,
    "sourceReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartNumberEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartNumberAuditLog" (
    "id" SERIAL NOT NULL,
    "partNumberId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "oldVerification" TEXT,
    "newVerification" TEXT,
    "oldPublishStatus" TEXT,
    "newPublishStatus" TEXT,
    "reason" TEXT,
    "changedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartNumberAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_slug_key" ON "Equipment"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_model_key" ON "Equipment"("model");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PartNumber_number_key" ON "PartNumber"("number");

-- CreateIndex
CREATE UNIQUE INDEX "PartNumber_slug_key" ON "PartNumber"("slug");

-- CreateIndex
CREATE INDEX "PartNumber_number_idx" ON "PartNumber"("number");

-- CreateIndex
CREATE INDEX "PartNumber_categoryId_idx" ON "PartNumber"("categoryId");

-- CreateIndex
CREATE INDEX "PartNumber_normalizedPartNumber_idx" ON "PartNumber"("normalizedPartNumber");

-- CreateIndex
CREATE INDEX "PartNumber_verificationStatus_publishStatus_idx" ON "PartNumber"("verificationStatus", "publishStatus");

-- CreateIndex
CREATE INDEX "PartNumber_brandId_idx" ON "PartNumber"("brandId");

-- CreateIndex
CREATE INDEX "PartNumber_equipmentId_idx" ON "PartNumber"("equipmentId");

-- CreateIndex
CREATE INDEX "Product_supplierId_idx" ON "Product"("supplierId");

-- CreateIndex
CREATE INDEX "Product_partNumberId_idx" ON "Product"("partNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_partNumberId_supplierId_oemNumber_key" ON "Product"("partNumberId", "supplierId", "oemNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_slug_key" ON "Supplier"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "BuyerCompany_verifiedStatus_idx" ON "BuyerCompany"("verifiedStatus");

-- CreateIndex
CREATE INDEX "BuyerCompany_ownerUserId_idx" ON "BuyerCompany"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_partNumberId_key" ON "Favorite"("userId", "partNumberId");

-- CreateIndex
CREATE INDEX "RFQItem_rfqId_idx" ON "RFQItem"("rfqId");

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteItem_rfqItemId_idx" ON "QuoteItem"("rfqItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RFQInvitation_token_key" ON "RFQInvitation"("token");

-- CreateIndex
CREATE INDEX "RFQInvitation_rfqId_idx" ON "RFQInvitation"("rfqId");

-- CreateIndex
CREATE INDEX "RFQInvitation_supplierId_idx" ON "RFQInvitation"("supplierId");

-- CreateIndex
CREATE INDEX "RFQInvitation_status_idx" ON "RFQInvitation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RFQInvitation_rfqId_supplierId_key" ON "RFQInvitation"("rfqId", "supplierId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_readAt_idx" ON "Notification"("readAt");

-- CreateIndex
CREATE INDEX "PartNumberEquipment_equipmentModelId_idx" ON "PartNumberEquipment"("equipmentModelId");

-- CreateIndex
CREATE INDEX "PartNumberEquipment_verificationStatus_idx" ON "PartNumberEquipment"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PartNumberEquipment_partNumberId_equipmentModelId_key" ON "PartNumberEquipment"("partNumberId", "equipmentModelId");

-- CreateIndex
CREATE INDEX "PartNumberAuditLog_partNumberId_idx" ON "PartNumberAuditLog"("partNumberId");

-- CreateIndex
CREATE INDEX "PartNumberAuditLog_createdAt_idx" ON "PartNumberAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartNumber" ADD CONSTRAINT "PartNumber_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartNumber" ADD CONSTRAINT "PartNumber_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartNumber" ADD CONSTRAINT "PartNumber_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_partNumberId_fkey" FOREIGN KEY ("partNumberId") REFERENCES "PartNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_buyerCompanyId_fkey" FOREIGN KEY ("buyerCompanyId") REFERENCES "BuyerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_partNumberId_fkey" FOREIGN KEY ("partNumberId") REFERENCES "PartNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQ" ADD CONSTRAINT "RFQ_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQ" ADD CONSTRAINT "RFQ_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQ" ADD CONSTRAINT "RFQ_partNumberId_fkey" FOREIGN KEY ("partNumberId") REFERENCES "PartNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQ" ADD CONSTRAINT "RFQ_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQItem" ADD CONSTRAINT "RFQItem_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQItem" ADD CONSTRAINT "RFQItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQItem" ADD CONSTRAINT "RFQItem_partNumberId_fkey" FOREIGN KEY ("partNumberId") REFERENCES "PartNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_rfqItemId_fkey" FOREIGN KEY ("rfqItemId") REFERENCES "RFQItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQInvitation" ADD CONSTRAINT "RFQInvitation_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQInvitation" ADD CONSTRAINT "RFQInvitation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartNumberRequest" ADD CONSTRAINT "PartNumberRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartNumberRequest" ADD CONSTRAINT "PartNumberRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentRequest" ADD CONSTRAINT "EquipmentRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentRequest" ADD CONSTRAINT "EquipmentRequest_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartNumberEquipment" ADD CONSTRAINT "PartNumberEquipment_partNumberId_fkey" FOREIGN KEY ("partNumberId") REFERENCES "PartNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartNumberEquipment" ADD CONSTRAINT "PartNumberEquipment_equipmentModelId_fkey" FOREIGN KEY ("equipmentModelId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartNumberAuditLog" ADD CONSTRAINT "PartNumberAuditLog_partNumberId_fkey" FOREIGN KEY ("partNumberId") REFERENCES "PartNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

