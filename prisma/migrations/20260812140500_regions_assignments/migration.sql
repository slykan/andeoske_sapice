CREATE TABLE `Region` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `Region_name_key`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `User` ADD COLUMN `regionId` VARCHAR(191) NULL;
ALTER TABLE `Organization` ADD COLUMN `regionId` VARCHAR(191) NULL;
ALTER TABLE `Report` ADD COLUMN `regionId` VARCHAR(191) NULL;

CREATE INDEX `User_regionId_idx` ON `User`(`regionId`);
CREATE INDEX `Organization_regionId_idx` ON `Organization`(`regionId`);
CREATE INDEX `Report_regionId_idx` ON `Report`(`regionId`);

ALTER TABLE `User` ADD CONSTRAINT `User_regionId_fkey` FOREIGN KEY (`regionId`) REFERENCES `Region`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Organization` ADD CONSTRAINT `Organization_regionId_fkey` FOREIGN KEY (`regionId`) REFERENCES `Region`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Report` ADD CONSTRAINT `Report_regionId_fkey` FOREIGN KEY (`regionId`) REFERENCES `Region`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
