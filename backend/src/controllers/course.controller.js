const courseService = require("../services/course.service");


module.exports.getCoursesInfo = async(req, res) =>{
    const coursesList = await courseService.getAllCourses(); //get all the courses from the DB
    const plannedCourses = await courseService.getPlannedCourses(req.user.id); //get planned courses for the student form the DB
    
    if(plannedCourses.length){ //if the student has planned courses priorly
        courseService.updateCompatibility(plannedCourses, coursesList); //add compatibility attribute to the courses
    }

    res.json({plannedCourses: plannedCourses, coursesList: coursesList}); //send the lists to the frontend
};