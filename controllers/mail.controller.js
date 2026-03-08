const gmailService = require("../services/gmail.service");
const smtpService = require("../services/smtp.service");
exports.readInbox = async (req, res) => {
    try {

        if (!req.session.googleId) {
            return res.status(401).send("Unauthorized");
        }

        const emails = await gmailService.getInboxEmails(req.session.googleId);

        res.json({
            success: true,
            emails
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


exports.sendMail = async (req, res) => {

    try {

        if (!req.session.googleId) {
            return res.status(401).send("Unauthorized");
        }

        const { to, subject, text } = req.body;

        const result = await smtpService.sendEmail(
            req.session.googleId,
            to,
            subject,
            text
        );

        res.json({
            success: true,
            messageId: result.messageId
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};