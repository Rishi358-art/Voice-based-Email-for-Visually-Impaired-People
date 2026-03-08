const { google } = require("googleapis");
const oauth2Client = require("../config/oauth.config");
const Token = require("../models/token.model");

/*
  Get Valid Access Token
*/
exports.getValidAccessToken = async (googleId) => {

    const tokenDoc = await Token.findOne({ googleId });

    if (!tokenDoc) {
        throw new Error("User tokens not found");
    }

    const now = Date.now();

    // If token expired
    if (now >= tokenDoc.expiryDate) {

        oauth2Client.setCredentials({
            refresh_token: tokenDoc.refreshToken
        });

        const { credentials } = await oauth2Client.refreshAccessToken();

        tokenDoc.accessToken = credentials.access_token;
        tokenDoc.expiryDate = credentials.expiry_date;

        await tokenDoc.save();

        return credentials.access_token;
    }

    return tokenDoc.accessToken;
};