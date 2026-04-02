/*
  Warnings:

  - The primary key for the `section` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE `section` DROP PRIMARY KEY,
    ADD PRIMARY KEY (`course_code`, `section_no`, `day`, `start_time`);
