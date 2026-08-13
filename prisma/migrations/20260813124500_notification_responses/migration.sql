ALTER TABLE `ReportNotification`
ADD COLUMN `responseToken` VARCHAR(191) NULL,
ADD COLUMN `responseStatus` VARCHAR(191) NULL,
ADD COLUMN `respondedAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `ReportNotification_responseToken_key` ON `ReportNotification`(`responseToken`);
