/*
  Warnings:

  - You are about to alter the column `section_no` on the `courses_planned` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.

*/
-- AlterTable
ALTER TABLE `courses_planned` MODIFY `section_no` INTEGER NOT NULL;
