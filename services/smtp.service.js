const nodemailer = require("nodemailer");
const tokenService = require("./token.service");
const Token = require("../models/token.model");

exports.sendEmail = async (googleId, to, subject, text) => {
     
    const tokenDoc = await Token.findOne({ googleId });

    if (!tokenDoc) {
        throw new Error("User tokens not found");
    }

    const accessToken = await tokenService.getValidAccessToken(googleId);

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: tokenDoc.email,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });

    const mailOptions = {
        from: tokenDoc.email,
        to,
        subject,
        text
    };

    const info = await transporter.sendMail(mailOptions);

    return info;
};