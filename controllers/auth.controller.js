const oauthService = require("../services/oauth.service");
const oauth2Client = require("../config/oauth.config");
const Token = require("../models/token.model");
const { google } = require("googleapis");

exports.googleLogin = (req, res) => {
    const url = oauthService.generateAuthUrl();
   console.log("AUTH URL:", url);
    res.redirect(url);
};

exports.googleCallback = async (req, res) => {
    try {
        const code = req.query.code;

        const tokens = await oauthService.getTokens(code);

        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({
            auth: oauth2Client,
            version: "v2"
        });

        const userInfo = await oauth2.userinfo.get();
        const googleId = userInfo.data.id;
        const email = userInfo.data.email;

        await Token.findOneAndUpdate(
    { googleId },
    {
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date
    },
    { upsert: true }
);
        req.session.googleId = googleId;

        res.redirect("/dashboard");

    } catch (error) {
        console.error("OAuth Error:", error);
        res.status(500).send("Authentication Failed");
    }
};
exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect("/auth/login");
    });
};