const express = require("express");
const router = express.Router();

const voiceController = require("../controllers/voice.controller");
const asyncHandler=require("../utils/asyncHandler");
// store uploaded files temporarily in "uploads" folder
function ensureAuth(req, res, next) {
    if (!req.session.googleId) {
        return res.redirect("/login");
    }
    next();
}

router.post("/command",ensureAuth,asyncHandler(voiceController.handleVoiceCommand) );

module.exports = router;