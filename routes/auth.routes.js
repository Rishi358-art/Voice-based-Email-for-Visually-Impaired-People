const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

const asyncHandler=require("../utils/asyncHandler");
router.get("/login",(req,res)=>{
     res.render("login");
})
router.get("/google", asyncHandler(authController.googleLogin));
router.get("/google/callback", asyncHandler(authController.googleCallback));
router.get("/logout",asyncHandler(authController.logout));

module.exports = router;