const { google } = require("googleapis");
const tokenService = require("./token.service");

/**
 * Decode base64 Gmail body
 */
function decodeBase64(data) {
    if (!data) return "";
    return Buffer.from(
        data.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
    ).toString("utf-8");
}

/**
 * Remove HTML and noise
 */
function stripHtml(html) {
    return html
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<\/?[^>]+(>|$)/g, "")
        .replace(/&[a-zA-Z0-9#]+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Recursively extract base64 body
 */
function extractBody(part) {
    if (!part) return "";

    if (part.body && part.body.data) {
        return part.body.data;
    }

    if (part.parts) {
        for (let p of part.parts) {
            const data = extractBody(p);
            if (data) return data;
        }
    }

    return "";
}

/**
 * Create voice-friendly summary
 */
function createSummary(text) {

    if (!text) return "No content available.";

    // Trim very long text
    let summary = text.slice(0, 1000);

    // Remove links
     summary = summary
        .replace(/https?:\/\/\S+/g, "")
        .replace(/&nbsp;|&zwnj;|&amp;|&quot;|&#\d+;/g, " ") // remove entities
        .replace(/\s+/g, " ")
        .trim();

    // If still too long, shorten further
    if (summary.length > 300) {
        summary = summary.slice(0, 300) + "...";
    }

    return summary;
}

/**
 * Fetch inbox emails with clean voice-friendly summary
 */
exports.getInboxEmails = async (googleId, pageToken = null) => {

    const accessToken = await tokenService.getValidAccessToken(googleId);

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: "v1", auth });

    const response = await gmail.users.messages.list({
        userId: "me",
        labelIds: ["INBOX"],
        maxResults: 5,
        pageToken: pageToken || undefined
    });

    const messages = response.data.messages || [];
    const nextPageToken = response.data.nextPageToken || null;
    const emailData = [];

    for (let msg of messages) {

        const email = await gmail.users.messages.get({
            userId: "me",
            id: msg.id,
            format: "full"
        });

        const headers = email.data.payload.headers || [];

        const subject = headers.find(h => h.name === "Subject")?.value || "No subject";
        const from = headers.find(h => h.name === "From")?.value || "Unknown";

        const rawBody = extractBody(email.data.payload);
        let body = "";

        if (rawBody) {
            body = decodeBase64(rawBody);
        }

        body = stripHtml(body);

        if (!body) {
            body = email.data.snippet || "No content available.";
        }

        const summary = createSummary(body);

        emailData.push({
            id: msg.id,
            subject,
            from,
            summary
        });
    }

    return {
        emails: emailData,
        nextPageToken
    };
};
/**
 * Mark as read
 */
exports.markAsRead = async (googleId, messageId) => {
    const accessToken = await tokenService.getValidAccessToken(googleId);

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: "v1", auth });

    await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
            removeLabelIds: ["UNREAD"]
        }
    });
};

/**
 * Delete email
 */
exports.deleteEmail = async (googleId, messageId) => {
    const accessToken = await tokenService.getValidAccessToken(googleId);

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: "v1", auth });

    await gmail.users.messages.trash({
        userId: "me",
        id: messageId
    });
};
// another replacement for smtp 
// services/gmail.service.js


const Token = require("../models/token.model");
const oauth2Client = require("../config/oauth.config");

/**
 * Send email using Gmail API (OAuth2)
 * @param {String} googleId - User's Google ID
 * @param {String} to - Recipient email
 * @param {String} subject - Email subject
 * @param {String} text - Email body
 */
exports.sendEmail = async (googleId, to, subject, text) => {
    // Get user tokens
    const tokenDoc = await Token.findOne({ googleId });
    if (!tokenDoc) throw new Error("User tokens not found");

    // Get valid access token (refresh if needed)
    const accessToken = await tokenService.getValidAccessToken(googleId);

    // Set credentials for OAuth2 client
    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: tokenDoc.refreshToken
    });

    // Initialize Gmail API
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Encode email in base64url
    const message = [
        `From: ${tokenDoc.email}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        "",
        text
    ].join("\r\n");

    const encodedMessage = Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    // Send email
    const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
            raw: encodedMessage
        }
    });

    return res.data; // Gmail API response
};