const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

//get all courses from DB with all info regarding faculties, sections and schedules, sorted in ascending order w.r.t. school name
module.exports.getAllCourses = async() => {
    return await prisma.course.findMany({
        include: {
            faculties: {
                select: {
                    name: true
                }
            },
            sections: {
                select: {
                    section_no: true,
                    start_date: true,
                    end_date: true,
                    schedule: {
                        select: {
                            day: true,
                            start_time: true,
                            end_time: true
                        }
                    }
                }
            }
        },
        orderBy: {
            school: 'asc'
        }
    });
}

//get all sections that are planned by the student with info about their schedule
module.exports.getPlannedCourses = async(id) => {
    const planned = await prisma.courses_Planned.findMany({
        select: {
            course_code: true,
            section_no: true
        },
        where: { student_id: id }
    });

    return await prisma.section.findMany({
        where: {
            OR: planned
        },
        include: {
            schedule: {
                select: {
                    day: true,
                    start_time: true,
                    end_time: true
                }
            }
        }
    });
}

//add or update compatibility attribute of the courses in the coursesList
module.exports.updateCompatibility = (plannedCourses, coursesList) => {
     coursesList.forEach(course => { //a course is compaitable if atleast one of its section is compaitable with the planned courses
        course.compatible = (!course.sections?.length); //use of ? ensuers that incase course.sections is undefined then the app doesn't crash
        course.sections.forEach(section => { //checking comapitablilty of each section
            section.compatible = module.exports.isCompatible(plannedCourses, section);
            if(section.compatible){
                course.compatible = true;
            }
        });
    });
}

module.exports.isCompatible = (plannedCourses, newCourse) => {
    for(const course of plannedCourses) { //for each course planned
        if(course.start_date<newCourse.start_date){ //we check if the dates overlap or not
            if(course.end_date<newCourse.start_date){
                continue;
            }
        }else if(course.start_date>newCourse.end_date){
            continue;
        }

        for(const ps of course.schedule){ //if the dates overlap we check the schedules
            for(const ns of newCourse.schedule){
                if(ps.day === ns.day){ //if the day matches
                    if(ps.start_time<ns.start_time){ //if the time clashes
                        if(ps.end_time>ns.start_time){
                            return false; //not compaitable
                        }
                    }else if(ps.start_time<ns.end_time){
                        return false;
                    }
                }
            }
        }
    };

    return true; //else compaitable
}