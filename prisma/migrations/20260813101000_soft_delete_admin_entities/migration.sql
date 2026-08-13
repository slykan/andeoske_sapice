ALTER TABLE `Region` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `Organization` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `User` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX `Region_isActive_idx` ON `Region`(`isActive`);
CREATE INDEX `Organization_isActive_idx` ON `Organization`(`isActive`);
CREATE INDEX `User_isActive_idx` ON `User`(`isActive`);
