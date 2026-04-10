const express = require("express");
const router = express.Router();
const courseController = require("../controllers/course.controller");

//returns a list of all courses with info, as well as a list of courses planned by the user
router.get('/', courseController.getCoursesInfo);

module.exports = router;