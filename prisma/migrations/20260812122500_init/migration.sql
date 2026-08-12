CREATE TABLE `Organization` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `city` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `User` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `role` ENUM('REPORTER', 'VOLUNTEER', 'ADMIN', 'ORGANIZATION') NOT NULL DEFAULT 'REPORTER',
  `organizationId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `User_email_key`(`email`),
  INDEX `User_organizationId_idx`(`organizationId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Report` (
  `id` VARCHAR(191) NOT NULL,
  `publicCode` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `animalType` VARCHAR(191) NOT NULL,
  `description` TEXT NOT NULL,
  `locationText` VARCHAR(191) NOT NULL,
  `latitude` DECIMAL(10, 7) NULL,
  `longitude` DECIMAL(10, 7) NULL,
  `urgency` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
  `status` ENUM('RECEIVED', 'IN_REVIEW', 'ASSIGNED', 'FORWARDED', 'IN_PROGRESS', 'CLOSED') NOT NULL DEFAULT 'RECEIVED',
  `isAnonymous` BOOLEAN NOT NULL DEFAULT false,
  `reporterName` VARCHAR(191) NULL,
  `reporterEmail` VARCHAR(191) NULL,
  `reporterPhone` VARCHAR(191) NULL,
  `createdById` VARCHAR(191) NULL,
  `assignedToId` VARCHAR(191) NULL,
  `organizationId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `closedAt` DATETIME(3) NULL,
  UNIQUE INDEX `Report_publicCode_key`(`publicCode`),
  INDEX `Report_status_idx`(`status`),
  INDEX `Report_urgency_idx`(`urgency`),
  INDEX `Report_createdAt_idx`(`createdAt`),
  INDEX `Report_assignedToId_idx`(`assignedToId`),
  INDEX `Report_organizationId_idx`(`organizationId`),
  INDEX `Report_createdById_idx`(`createdById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChainDetails` (
  `id` VARCHAR(191) NOT NULL,
  `reportId` VARCHAR(191) NOT NULL,
  `hasWater` BOOLEAN NOT NULL DEFAULT false,
  `hasFood` BOOLEAN NOT NULL DEFAULT false,
  `hasShelter` BOOLEAN NOT NULL DEFAULT false,
  `visibleInjuries` BOOLEAN NOT NULL DEFAULT false,
  `chainLength` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  UNIQUE INDEX `ChainDetails_reportId_key`(`reportId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReportAttachment` (
  `id` VARCHAR(191) NOT NULL,
  `reportId` VARCHAR(191) NOT NULL,
  `kind` ENUM('PHOTO', 'VIDEO', 'DOCUMENT') NOT NULL,
  `fileName` VARCHAR(191) NOT NULL,
  `storageKey` VARCHAR(191) NOT NULL,
  `mimeType` VARCHAR(191) NOT NULL,
  `byteSize` INTEGER NOT NULL,
  `exifStripped` BOOLEAN NOT NULL DEFAULT false,
  `uploadedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ReportAttachment_reportId_idx`(`reportId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReportStatusHistory` (
  `id` VARCHAR(191) NOT NULL,
  `reportId` VARCHAR(191) NOT NULL,
  `fromStatus` ENUM('RECEIVED', 'IN_REVIEW', 'ASSIGNED', 'FORWARDED', 'IN_PROGRESS', 'CLOSED') NULL,
  `toStatus` ENUM('RECEIVED', 'IN_REVIEW', 'ASSIGNED', 'FORWARDED', 'IN_PROGRESS', 'CLOSED') NOT NULL,
  `action` ENUM('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'NOTE_ADDED', 'ATTACHMENT_ADDED', 'REPORT_FORWARDED', 'CLOSED') NOT NULL DEFAULT 'STATUS_CHANGED',
  `note` TEXT NULL,
  `changedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ReportStatusHistory_reportId_idx`(`reportId`),
  INDEX `ReportStatusHistory_changedById_idx`(`changedById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FieldNote` (
  `id` VARCHAR(191) NOT NULL,
  `reportId` VARCHAR(191) NOT NULL,
  `authorId` VARCHAR(191) NULL,
  `visitedAt` DATETIME(3) NULL,
  `note` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `FieldNote_reportId_idx`(`reportId`),
  INDEX `FieldNote_authorId_idx`(`authorId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `User` ADD CONSTRAINT `User_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Report` ADD CONSTRAINT `Report_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Report` ADD CONSTRAINT `Report_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Report` ADD CONSTRAINT `Report_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ChainDetails` ADD CONSTRAINT `ChainDetails_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReportAttachment` ADD CONSTRAINT `ReportAttachment_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReportStatusHistory` ADD CONSTRAINT `ReportStatusHistory_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReportStatusHistory` ADD CONSTRAINT `ReportStatusHistory_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FieldNote` ADD CONSTRAINT `FieldNote_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `FieldNote` ADD CONSTRAINT `FieldNote_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
