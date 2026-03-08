const express = require("express");
const router = express.Router();
const mailController = require("../controllers/mail.controller");
const asyncHandler=require("../utils/asyncHandler");
router.get("/inbox",asyncHandler(mailController.readInbox));
router.post("/send", asyncHandler(mailController.sendMail));
module.exports = router;