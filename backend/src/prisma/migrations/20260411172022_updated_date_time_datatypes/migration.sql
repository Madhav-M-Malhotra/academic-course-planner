/*
  Warnings:

  - The primary key for the `schedule` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE `schedule` DROP PRIMARY KEY,
    MODIFY `start_time` TIME NOT NULL,
    MODIFY `end_time` TIME NOT NULL,
    ADD PRIMARY KEY (`course_code`, `section_no`, `day`, `start_time`);

-- AlterTable
ALTER TABLE `section` MODIFY `start_date` DATE NOT NULL,
    MODIFY `end_date` DATE NOT NULL;
