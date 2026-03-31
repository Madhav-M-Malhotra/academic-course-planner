-- CreateTable
CREATE TABLE `Student` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `program` VARCHAR(191) NOT NULL,
    `major` VARCHAR(191) NOT NULL,
    `minor` VARCHAR(191) NULL,

    UNIQUE INDEX `Student_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Course` (
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `credits` INTEGER NOT NULL,
    `term` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `ger` ENUM('HL', 'SS', 'MPL', 'BLS', 'PVA') NULL,
    `school` VARCHAR(191) NOT NULL,
    `prereqs` VARCHAR(191) NULL,
    `antireqs` VARCHAR(191) NULL,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Faculty` (
    `course_code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`course_code`, `name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Section` (
    `course_code` VARCHAR(191) NOT NULL,
    `section_no` INTEGER NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `day` ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NOT NULL,

    PRIMARY KEY (`course_code`, `section_no`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Courses_Planned` (
    `student_id` VARCHAR(191) NOT NULL,
    `course_code` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`student_id`, `course_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Requirements` (
    `subject` VARCHAR(191) NOT NULL,
    `course_code` VARCHAR(191) NOT NULL,
    `for` ENUM('MAJOR', 'MINOR') NOT NULL,
    `type` ENUM('CORE', 'ELECTIVE') NOT NULL,

    PRIMARY KEY (`subject`, `course_code`, `for`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Faculty` ADD CONSTRAINT `Faculty_course_code_fkey` FOREIGN KEY (`course_code`) REFERENCES `Course`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Section` ADD CONSTRAINT `Section_course_code_fkey` FOREIGN KEY (`course_code`) REFERENCES `Course`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Courses_Planned` ADD CONSTRAINT `Courses_Planned_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Courses_Planned` ADD CONSTRAINT `Courses_Planned_course_code_fkey` FOREIGN KEY (`course_code`) REFERENCES `Course`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;
