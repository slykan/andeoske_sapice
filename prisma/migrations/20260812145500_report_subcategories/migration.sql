CREATE TABLE `ReportSubcategory` (
  `id` VARCHAR(191) NOT NULL,
  `categoryId` VARCHAR(191) NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ReportSubcategory_categoryId_label_key`(`categoryId`, `label`),
  INDEX `ReportSubcategory_categoryId_idx`(`categoryId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReportFlag` (
  `id` VARCHAR(191) NOT NULL,
  `reportId` VARCHAR(191) NOT NULL,
  `subcategoryId` VARCHAR(191) NULL,
  `label` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ReportFlag_reportId_idx`(`reportId`),
  INDEX `ReportFlag_subcategoryId_idx`(`subcategoryId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ReportSubcategory` ADD CONSTRAINT `ReportSubcategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ReportCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReportFlag` ADD CONSTRAINT `ReportFlag_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReportFlag` ADD CONSTRAINT `ReportFlag_subcategoryId_fkey` FOREIGN KEY (`subcategoryId`) REFERENCES `ReportSubcategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `ReportSubcategory` (`id`, `categoryId`, `label`, `isActive`, `createdAt`, `updatedAt`)
SELECT CONCAT('sub_', REPLACE(UUID(), '-', '')), `id`, 'Nema vode', true, NOW(3), NOW(3)
FROM `ReportCategory`
WHERE `name` = 'Pas na lancu'
ON DUPLICATE KEY UPDATE `isActive` = true, `updatedAt` = VALUES(`updatedAt`);

INSERT INTO `ReportSubcategory` (`id`, `categoryId`, `label`, `isActive`, `createdAt`, `updatedAt`)
SELECT CONCAT('sub_', REPLACE(UUID(), '-', '')), `id`, 'Nema hrane', true, NOW(3), NOW(3)
FROM `ReportCategory`
WHERE `name` = 'Pas na lancu'
ON DUPLICATE KEY UPDATE `isActive` = true, `updatedAt` = VALUES(`updatedAt`);

INSERT INTO `ReportSubcategory` (`id`, `categoryId`, `label`, `isActive`, `createdAt`, `updatedAt`)
SELECT CONCAT('sub_', REPLACE(UUID(), '-', '')), `id`, 'Nema zaklona', true, NOW(3), NOW(3)
FROM `ReportCategory`
WHERE `name` = 'Pas na lancu'
ON DUPLICATE KEY UPDATE `isActive` = true, `updatedAt` = VALUES(`updatedAt`);

INSERT INTO `ReportSubcategory` (`id`, `categoryId`, `label`, `isActive`, `createdAt`, `updatedAt`)
SELECT CONCAT('sub_', REPLACE(UUID(), '-', '')), `id`, 'Vidljive ozljede', true, NOW(3), NOW(3)
FROM `ReportCategory`
WHERE `name` = 'Pas na lancu'
ON DUPLICATE KEY UPDATE `isActive` = true, `updatedAt` = VALUES(`updatedAt`);
