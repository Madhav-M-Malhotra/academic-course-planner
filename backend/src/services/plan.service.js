const courseService = require('../services/course.service');
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

//add course to the plan
module.exports.addCourse = async(studentId, courseCode, sectionNo) => {
    if(!(await courseExists(courseCode, sectionNo))){ //check if the course code and section no. combination exists in the DB
        throw new Error("COURSE_NOT_FOUND"); //raise error if the combination is not found in the DB
    }

    if(await alreadyPlanned(studentId, courseCode)){ //check if the course code has already been planned by the student
        throw new Error("ALREADY_PLANNED"); //raise error if the student has already added the course to their plan
    }

    if(!(await addIfCompatible(studentId, courseCode, sectionNo))){ //check compatabibility of the newCourse with perviously planned courses and add if compatible
        throw new Error("TIME_CONFLICT"); //raise error if the newCourse is not compatible with courses perviously planned by the student
    }

    return await getAllCompatiable(studentId); //if the course was successfully added to the plan, then return the list of courses and sections, compatible with student's current plan
};

//remove course from the plan
module.exports.removeCourse = async(studentId, courseCode) => {
    const { count } = await prisma.courses_Planned.deleteMany({
        where: {
            student_id: studentId,
            course_code: courseCode
        }
    }); //try to remove the course from the plan for the student
    
    if(count === 0){ //if nothing was removed
        throw new Error("COURSE_NOT_IN_PLAN"); //raise an error that the requested removal was already not a part of plan for the student
    }

    return await getAllCompatiable(studentId); //if course was removed successfully, then return the list of courses and sections, compatible with student's current plan
};

//check if the course code and section, combinition exists in the DB
courseExists = async(courseCode, sectionNo) => {
    const section = await prisma.section.findUnique({
        select: { course_code: true },
        where: { 
            course_code_section_no: {
                course_code: courseCode,
                section_no: sectionNo
            }
        }
    }); //try to find the entry for the combition in the DB

    if(section){ //if found (combination exists) return true
        return true;
    }else{ //else (combinition doesn't exist) return false
        return false;
    }
};

//check if the course is already a part of the student's plan
alreadyPlanned = async(studentId, courseCode) => {
    const course = await prisma.courses_Planned.findUnique({
        where: {
            student_id_course_code:{
                student_id: studentId,
                course_code: courseCode
            }
        }
    }); //try to find an entry for the course and student's id, in the DB
        
    if(course){ //if found (the course is already planned) return true
        return true;
    }else{ //else (the course isn't planned) return false
        return false;
    }
};

//check compatabibility of the newCourse with perviously planned courses and add if compatible
addIfCompatible = async(studentId, courseCode, sectionNo) => {
    const plannedCourses = await courseService.getPlannedCourses(studentId); //get planned courses for the student form the DB
    const newCourse = await prisma.section.findUnique({
        select: {
            start_date: true,
            end_date: true,
            schedule: {
                select: {
                    day: true,
                    start_time: true,
                    end_time: true
                }
            }
        },
        where: {
            course_code_section_no:{
                course_code: courseCode,
                section_no: sectionNo
            }
        }
    }); //get required info about the new course section that is requested to be added

    if(courseService.isCompatible(plannedCourses, newCourse)){ //check their compatibility
        await prisma.courses_Planned.create({
            data: {
                student_id: studentId,
                course_code: courseCode,
                section_no: sectionNo
            }
        }); //if compatible, add the new course section to the course_Planned table with student's id

        return true; //and return true
    }

    return false; //else if not compatible, return false
};

//get the list of courses and sections, compatible with student's current plan
getAllCompatiable = async(studentId) => {
    const plannedCourses = await courseService.getPlannedCourses(studentId);//get planned courses for the student form the DB
    const allCourses = await courseService.getAllCourses(); //get all the courses from the DB
    const result = []; //to store the compatible courses

    allCourses.forEach(course => { //for each course being offered in the sem
        const compatibleSections = []; //to store the compatible sections for the course
        course.sections.forEach(section => { //we check for each of its section
            if(courseService.isCompatible(plannedCourses, section)){ //if its compatible
                compatibleSections.push(section.section_no); //add the section to the list of compatibles
            }
        });
        if(compatibleSections.length || !course.sections?.length){ //if there are no sections listed for the course, or if atleast one of the sections listed for the course is compaitable
            result.push({
                course_code: course.code,
                sections: compatibleSections
            }); //add the course to the list of compatibles
        }
    });

    return result; //return the final list of compatible courses and sections
};