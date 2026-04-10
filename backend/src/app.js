require("dotenv").config();
const express = require("express");
const app = express();
const session = require("express-session");
const path = require("path");
const passport = require("passport");
require("./config/passport.js");
//Middleware imports
const { isLoggedIn } = require("./middleware");
//Router imports
const authRouter = require("./routes/auth.routes.js");
const mainRouter = require("./routes/main.routes.js");
const courseRouter = require("./routes/course.routes.js");
const planRouter = require("./routes/plan.routes.js");
const timetableRouter = require("./routes/timetable.routes.js");

app.use(express.json());//for reading json requests
app.use(express.urlencoded({extended: true}));//to parse HTML Forms data
app.use(express.static(path.join(__dirname,"../../frontend")));//static files (frontend css and js files) are made available publically

//Express Session
const sessionOptions = {
    secret: process.env.SESSION_SECRET,
    resave: false, //session resaved only if modified during the request
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 24*60*60*1000, //expirese in 24hrs
        maxAge: 24*60*60*1000, //maxage 24hrs
        httpOnly: true //to protect against XSS attacks
    }
};
app.use(session(sessionOptions));

//Passport initialization and session enabling
app.use(passport.initialize());
app.use(passport.session());

//Server listening for requests
app.listen(process.env.PORT,()=>{
    console.log("server listening");
});

//Login Routes
app.use('/auth', authRouter);

//authentication before allowing access to anything beyond login routes
app.use(isLoggedIn);

//Course Routes
app.use('/courses', courseRouter);

//Plan Routes
app.use('/plan', planRouter);

//Timetable Routes
app.use('/timetable', timetableRouter);

//Main page Routes
app.get('/', mainRouter);