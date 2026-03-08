function detectConfirmation(text = "") {
    const lower = text.toLowerCase();

    if (lower.includes("yes") || lower.includes("yeah") || lower.includes("yep")) {
        return "YES";
    }

    if (lower.includes("no") || lower.includes("nope") || lower.includes("nah")) {
        return "NO";
    }

    return "UNKNOWN";
}

module.exports = { detectConfirmation };