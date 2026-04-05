/*
  Warnings:

  - The primary key for the `section` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `day` on the `section` table. All the data in the column will be lost.
  - You are about to drop the column `end_time` on the `section` table. All the data in the column will be lost.
  - You are about to drop the column `start_time` on the `section` table. All the data in the column will be lost.
  - Added the required column `section_no` to the `Courses_Planned` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `courses_planned` ADD COLUMN `section_no` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `section` DROP PRIMARY KEY,
    DROP COLUMN `day`,
    DROP COLUMN `end_time`,
    DROP COLUMN `start_time`,
    ADD PRIMARY KEY (`course_code`, `section_no`);

-- CreateTable
CREATE TABLE `Schedule` (
    `course_code` VARCHAR(191) NOT NULL,
    `section_no` INTEGER NOT NULL,
    `day` ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NOT NULL,

    PRIMARY KEY (`course_code`, `section_no`, `day`, `start_time`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Schedule` ADD CONSTRAINT `Schedule_course_code_section_no_fkey` FOREIGN KEY (`course_code`, `section_no`) REFERENCES `Section`(`course_code`, `section_no`) ON DELETE RESTRICT ON UPDATE CASCADE;
