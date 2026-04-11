const express = require("express");
const router = express.Router();
const planController = require("../controllers/plan.controller");

//Add route: add course to the plan
router.post('/:courseCode', planController.addCourse);

//Remove route: remove course from the plan
router.delete('/:courseCode', planController.removeCourse);

module.exports = router;