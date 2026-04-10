const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

//Passport Google OAuth2 Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async(accessToken, refreshToken, profile, cb) => {
    if(profile._json.hd === process.env.UNI_DOMAIN){
      const user = await prisma.student.findUnique({
        where: { email: profile._json.email },
        select: {
          id: true,
          major: true,
          minor: true
        }
      });
      return cb(null, user);
    }else{
      return cb(null, false);
    }
  }
));

passport.serializeUser(function(user, cb){
  cb(null,user);
});
passport.deserializeUser(function(user, cb){
  cb(null, user);
});