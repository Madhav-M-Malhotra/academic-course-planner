const express = require("express");
const router = express.Router();
const path = require("path");

//Index route: access the main page
router.get('/', (req,res)=>{
    res.sendFile(path.join(__dirname,"../../../frontend/main/index.html"));
});

module.exports = router;