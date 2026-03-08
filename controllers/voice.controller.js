const gmailService = require("../services/gmail.service");
const smtpService = require("../services/smtp.service");
const parser = require("../utils/commandParser");
const AppError = require("../utils/AppError");


function buildEmail(text) {
    return (text || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") + "@gmail.com";
}

function resetVoiceState(req) {
    req.session.voiceState = {
        flow: null,
        step: null,
        data: {}
    };
}

function isYes(text) {
    return /yes|yeah|yep|sure|okay|read|ok|send/i.test(text);
}

function isNo(text) {
    return /no|nope|cancel/i.test(text);
}
function isStop(text) {
    return /stop|abort|exit|quit|cancel operation/i.test(text);
}
function isDeleteCommand(text) {
    return /delete|remove|trash|discard|erase|clear/i.test(text);
}
exports.handleVoiceCommand = async (req, res) => {
    
    if (!req.session || !req.session.googleId) {
    throw new AppError("Session expired. Please login again.", 401);
}

    if (!req.session.voiceState) {
        resetVoiceState(req);
    }

    const text = req.body.text;
    const lowerText = text.toLowerCase();

if (isStop(lowerText) && req.session.voiceState.flow) {
    resetVoiceState(req);

    return res.json({
        action: "STOPPED",
        message: "Stopping current operation. What would you like to do next?"
    });
}

    if (!text || !text.trim()) {
        return res.status(400).json({ action: "NO_TEXT" });
    }

    const command = parser.parseCommand(text);
    // 🔴 HARD RESET if new root command comes during active flow
if (
    req.session.voiceState.flow &&
    (command === "READ_INBOX" || command === "SEND_EMAIL")
) {
    resetVoiceState(req);
}
// 🟢 NEW: Start READ EMAIL flow
if (command === "READ_EMAIL") {

    const emails = req.session.voiceState?.data?.emails;

    if (!emails || emails.length === 0) {
        return res.json({
            action: "EMPTY",
            message: "No emails available. Please read inbox first."
        });
    }

    req.session.voiceState.flow = "READ_EMAIL";
    req.session.voiceState.step = "ASK_NUMBER";

    return res.json({
        action: "ASK_NUMBER",
        message: "Which email number would you like to read?"
    });
}

  

        // ===============================
        // READ EMAIL FLOW
        // ===============================
       if (req.session.voiceState.flow === "READ_EMAIL") {

    const confirmation = text.toLowerCase();
    const { emails, currentIndex } = req.session.voiceState.data;
    if (confirmation.includes("reply")) {

    req.session.voiceState.step = "ASK_REPLY_BODY";

    return res.json({
        action: "ASK_REPLY",
        message: "What should I reply?"
    });
}
     if (
        req.session.voiceState.step === "ASK_NUMBER" &&
        typeof command === "object" &&
        command.type === "READ_EMAIL_NUMBER"
    ) {

        const index = command.number - 1;

        if (!emails || index < 0 || index >= emails.length) {
            return res.json({
                action: "INVALID",
                message: "Invalid email number. Please say a valid number."
            });
        }

        const email = emails[index];

        resetVoiceState(req);

        return res.json({
            action: "READING_EMAIL",
            message: `Email from ${email.from}. Subject: ${email.subject}. ${email.summary}`
        });
    }
    if (isDeleteCommand(confirmation)) {

    req.session.voiceState.step = "CONFIRM_DELETE";

    return res.json({
        action: "CONFIRM_DELETE",
        message: "Are you sure you want to delete this email?"
    });
}

    
    // STEP: ASK_READ_CONFIRM (first read)
   
    if (req.session.voiceState.step === "ASK_READ_CONFIRM") {

        if (isYes(confirmation) || confirmation.includes("next")) {

            const email = emails[currentIndex];
            console.log(email);
            console.log("Email ID:",email.id);
            //Mark as Read
             await gmailService.markAsRead(req.session.googleId, email.id);

            req.session.voiceState.step = "ASK_NEXT_EMAIL";

            return res.json({
                action: "READ_EMAIL",
                message: `
Email ${currentIndex + 1}.
From: ${email.from}.
Subject: ${email.subject}.

Body:
${email.summary}

Say next to read the next email or no to stop.
`
            });
        }

        if (isNo(confirmation) || confirmation.includes("skip")) {

            const nextIndex = currentIndex + 1;

            if (nextIndex >= emails.length) {
                resetVoiceState(req);
                return res.json({
                    action: "NO_MORE_EMAILS",
                    message: "No more emails."
                });
            }

            req.session.voiceState.data.currentIndex = nextIndex;

            return res.json({
                action: "ASK_READ_CONFIRM",
                message: `Do you want to read email ${nextIndex + 1}?`
            });
        }

        return res.json({
            action: "ASK_READ_CONFIRM",
            message: "Please say yes to read the email, next, or no to skip."
        });
    }

    
    // STEP: ASK_NEXT_EMAIL (after reading)
    
    if (req.session.voiceState.step === "ASK_NEXT_EMAIL") {

        if (isYes(confirmation) || confirmation.includes("next")) {

            const nextIndex = currentIndex + 1;

            if (nextIndex >= emails.length) {
                resetVoiceState(req);
                return res.json({
                    action: "NO_MORE_EMAILS",
                    message: "No more emails."
                });
            }
            if (confirmation.includes("more") || confirmation.includes("next page")) {

    const { pageToken } = req.session.voiceState.data;

    const { emails, nextPageToken } = await gmailService.getInboxEmails(
        req.session.googleId,
        pageToken
    );

    if (!emails || emails.length === 0) {
        return res.json({
            action: "NO_MORE_EMAILS",
            message: "No more emails."
        });
    }

    req.session.voiceState.data.emails = emails;
    req.session.voiceState.data.pageToken = nextPageToken;
    req.session.voiceState.data.currentIndex = 0;

    return res.json({
        action: "ASK_READ_CONFIRM",
        message: "Loaded next page. Do you want to read email 1?"
    });
}

            req.session.voiceState.data.currentIndex = nextIndex;
            const email = emails[nextIndex];

            return res.json({
                action: "READ_EMAIL",
                message: `
Email ${nextIndex + 1}.
From: ${email.from}.
Subject: ${email.subject}.

Body:
${email.summary}

Say next to continue or no to stop.
`
            });
        }

        if (isNo(confirmation) || confirmation.includes("stop")) {
            resetVoiceState(req);

            return res.json({
                action: "STOP_READING",
                message: "Stopped reading emails. What would you like to do next?"
            });
        }
         // PREVIOUS EMAIL SUPPORT
if (/previous|back|go back/i.test(confirmation)) {

    const prevIndex = currentIndex - 1;

    if (prevIndex < 0) {
        return res.json({
            action: "NO_PREVIOUS",
            message: "This is the first email."
        });
    }

    req.session.voiceState.data.currentIndex = prevIndex;
    const email = emails[prevIndex];

    return res.json({
        action: "READ_EMAIL",
        message: `
Email ${prevIndex + 1}.
From: ${email.from}.
Subject: ${email.subject}.

Body:
${email.summary}

Say next to continue, previous to go back, or no to stop.
`
    });
}
        return res.json({
            action: "ASK_NEXT_EMAIL",
            message: "Please say next to continue or no to stop."
        });
    }
   if (req.session.voiceState.step === "ASK_REPLY_BODY") {

    req.session.voiceState.data.body = text;
    req.session.voiceState.data.summary = text.slice(0, 200);
    req.session.voiceState.step = "CONFIRM_REPLY";

    return res.json({
        action: "CONFIRM_REPLY",
        message: `You replied: ${req.session.voiceState.data.summary}. Should I send it?`
    });
    
}

if (req.session.voiceState.step === "CONFIRM_REPLY")
     {

    const confirmation = text.toLowerCase();
    const email = emails[currentIndex];

    if (isYes(confirmation)) {

        try {
            // await smtpService.sendEmail(
            //     req.session.googleId,
            //     email.from,
            //     "Re: " + email.subject,
            //     req.session.voiceState.data.body
            // );
            // NEW GMAIL API VERSION
        await gmailService.sendEmail(
            req.session.googleId,
            email.from,
            "Re: " + email.subject,
            req.session.voiceState.data.body
        );
        } catch {
            throw new AppError("Failed to send email.", 503);
        }

        resetVoiceState(req);

        return res.json({
            action: "EMAIL_REPLIED",
            message: "Reply sent. What would you like to do next?"
        });
    }

    if (isNo(confirmation)) {
        resetVoiceState(req);

        return res.json({
            action: "REPLY_CANCELLED",
            message: "Reply cancelled."
        });
    }

    return res.json({
        action: "CONFIRM_REPLY",
        message: "Please say yes to send or no to cancel."
    });
}
if (req.session.voiceState.step === "CONFIRM_DELETE") {

    const email = emails[currentIndex];

    if (isYes(confirmation)) {

        try {
            await gmailService.deleteEmail(
                req.session.googleId,
                email.id
            );
        } catch {
            throw new AppError("Failed to delete email.", 502);
        }

        resetVoiceState(req);

        return res.json({
            action: "EMAIL_DELETED",
            message: "Email deleted successfully."
        });
    }

    if (isNo(confirmation)) {

        req.session.voiceState.step = "ASK_NEXT_EMAIL";

        return res.json({
            action: "DELETE_CANCELLED",
            message: "Deletion cancelled."
        });
    }

    return res.json({
        action: "CONFIRM_DELETE",
        message: "Please say yes to delete or no to cancel."
    });
}
    
}

        // ===============================
        // SEND EMAIL FLOW
        // ===============================
        if (req.session.voiceState.flow === "SEND_EMAIL") {

            if (req.session.voiceState.step === "ASK_RECIPIENT") {
                req.session.voiceState.data.to = buildEmail(text);
                req.session.voiceState.step = "ASK_SUBJECT";

                return res.json({
                    action: "ASK_SUBJECT",
                    message: "What is the subject?"
                });
            }

            if (req.session.voiceState.step === "ASK_SUBJECT") {
                req.session.voiceState.data.subject = text;
                req.session.voiceState.step = "ASK_BODY";

                return res.json({
                    action: "ASK_BODY",
                    message: "What should I write in the email?"
                });
            }

           if (req.session.voiceState.step === "ASK_BODY") {
    req.session.voiceState.data.body = text;
    req.session.voiceState.data.summary = text.slice(0, 200); // voice friendly
    req.session.voiceState.step = "CONFIRM";

    const { to, subject, summary } = req.session.voiceState.data;

    return res.json({
        action: "CONFIRM_EMAIL",
        message: `You are sending an email to ${to}. Subject: ${subject}. Body: ${summary}. Should I send it?`
    });
}

            if (req.session.voiceState.step === "CONFIRM") {

                const confirmation = text.toLowerCase();

                if (isYes(confirmation)) {

                    const { to, subject, body } = req.session.voiceState.data;
                    try{
                    //       await smtpService.sendEmail(
                    //     req.session.googleId,
                    //     to,
                    //     subject,
                    //     body
                    // );
                     // NEW GMAIL API VERSION
            await gmailService.sendEmail(
                req.session.googleId,
                to,
                subject,
                body
            );
                    }catch{
                        throw new AppError("Failed to send email.", 503);
                    }
                   

                    resetVoiceState(req);

                    return res.json({
                        action: "EMAIL_SENT",
                        message: "Your email has been sent successfully."
                    });
                }

                if (isNo(confirmation)) {
                    resetVoiceState(req);
                    return res.json({
                        action: "EMAIL_CANCELLED",
                        message: "Email sending cancelled."
                    });
                }

                return res.json({
                    action: "CONFIRM_EMAIL",
                    message: "Please say yes to send or no to cancel."
                });
            }
        }

        // ===============================
        // NEW COMMANDS
        // ===============================
        if (command === "READ_INBOX") {

            const { emails, nextPageToken } = await gmailService.getInboxEmails(req.session.googleId);

if (!emails || emails.length === 0) {
    return res.json({
        action: "EMPTY_INBOX",
        message: "Your inbox is empty."
    });
}
console.log("NextPageToken:", nextPageToken);
req.session.voiceState = {
    flow: "READ_EMAIL",
    step: "ASK_READ_CONFIRM",
    data: {
        emails,
        currentIndex: 0,
        pageToken: nextPageToken
    }
};

return res.json({
    action: "ASK_READ_CONFIRM",
    message: `You have ${emails.length} emails. Do you want to read email 1?`
});
        }

        if (command === "SEND_EMAIL") {

            req.session.voiceState = {
                flow: "SEND_EMAIL",
                step: "ASK_RECIPIENT",
                data: { to: null, subject: null, body: null }
            };

            return res.json({
                action: "ASK_RECIPIENT",
                message: "Who do you want to send the email to?"
            });
        }

        return res.json({ action: "UNKNOWN", message: "Command not recognized." });

    
};