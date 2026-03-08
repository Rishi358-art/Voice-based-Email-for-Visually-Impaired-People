
exports.parseCommand = (text) => {
    if (!text || typeof text !== "string") return "UNKNOWN";

    const input = text.toLowerCase();
   const numberWords = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    two: 2,
    tree: 3,
    for: 4,
    too: 2,
    van: 1
};
    if (input.includes("read") && input.includes("inbox")) return "READ_INBOX";
    if (input.includes("send") && input.includes("email")) return "SEND_EMAIL";
    // Detect "read email"
if (/read\s+email/i.test(text)) {
    return "READ_EMAIL";
}

// Detect "read <number>"
// READ EMAIL BY NUMBER (supports read 1 and read one)
const match = text.match(/read\s+(\w+)/i);

if (match) {
    const value = match[1].toLowerCase();

    let number = numberWords[value];

    // if user said digit like "1"
    if (!number && !isNaN(value)) {
        number = parseInt(value);
    }

    if (number) {
        return {
            type: "READ_EMAIL_NUMBER",
            number
        };
    }
}
    return "UNKNOWN";
};