CREATE TABLE `ReportCategory` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ReportCategory_name_key`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `ReportCategory` (`id`, `name`, `isActive`, `createdAt`, `updatedAt`) VALUES
  ('cat_pas_na_lancu', 'Pas na lancu', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cat_bez_vode_hrane', 'Bez vode/hrane', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cat_ozljeda_bolest', 'Ozljeda ili bolest', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cat_nehigijenski_uvjeti', 'Nehigijenski uvjeti', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cat_napustena_zivotinja', 'Napuštena životinja', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cat_zivotinja_u_vozilu', 'Životinja u vozilu', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
