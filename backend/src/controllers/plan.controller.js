const planService = require("../services/plan.service");

module.exports.addCourse = async(req, res) => {
    const courseCode = req.params.courseCode; //get the course code from the url
    const sectionNo = req.body.section_no; //get the section no from the json sent
    
    try { //try to add the particular section and course for the student
        const result = await planService.addCourse(req.user.id, courseCode, sectionNo);
        res.status(201).json(result); //return with success status
    } catch (err) { //if error occurs, return the respective error message with appropriate status code
        if (err.message === "COURSE_NOT_FOUND"){
            res.status(400).json({ error: "Invalid Course Code or Section Number" });
        }

        if (err.message === "ALREADY_PLANNED") {
            return res.status(409).json({ error: "Course is already present in your plan" });
        }

        if (err.message === "TIME_CONFLICT") {
            return res.status(409).json({ error: "Schedule conflicts with priorly planned courses" });
        }
    }
};

module.exports.removeCourse = async(req, res) => {
    const courseCode = req.params.courseCode; //get teh course code from the url

    try{ //try to remove the course from the plan for the student
        const result = await planService.removeCourse(req.user.id, courseCode);
        res.status(200).json(result); //return with success status
    } catch (err) { //if error occurs, return the respective error message with appropriate status code
        if(err.message === "COURSE_NOT_IN_PLAN"){
            res.status(404).json({ error: "Cannot remove a course that is not planned" });
        }
    }
};