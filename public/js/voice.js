let recognition;
let isListening = false;
let speechDetected = false;
let wasInterrupted = false;
let mode = "normal"; // "normal" or "continue"
let lastCommand = null;
let lastSpokenMessage = null;
let rootCommands = ["read inbox", "send email"];

/* ---------------- UI HELPERS ---------------- */

function updateStatus(text) {
    const statusEl = document.getElementById("status");
    if (statusEl) statusEl.innerText = "Status: " + text;
}

function updateLastCommand(text) {
    const el = document.getElementById("lastCommand");
    if (el) el.innerText = "Last Command: " + text;
}

function updateResponse(text) {
    const el = document.getElementById("response");
    if (el) el.innerText = "System Response: " + text;
}
function showLoading() {
    const el = document.getElementById("loading");
    if (el) el.style.display = "block";
}

function hideLoading() {
    const el = document.getElementById("loading");
    if (el) el.style.display = "none";
}
/* ---------------- SPEAK ---------------- */

function speak(text, callback = null) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;

    lastSpokenMessage = text;

    speechSynthesis.cancel();

    utterance.onend = function () {
        if (callback) callback();
    };

    speechSynthesis.speak(utterance);
}

/* ---------------- RECOGNITION INIT ---------------- */

function initRecognition() {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = false;
    recognition.lang = "en-US";

    recognition.onresult = function (event) {
        const transcript = event.results[0][0].transcript.toLowerCase();
        console.log("Voice Input:", transcript);

        updateLastCommand(transcript);
        speechDetected = true;

        if (mode === "continue") {
            handleContinueDecision(transcript);
            return;
        }

        // Root commands reset logic
        if (rootCommands.some(cmd => transcript.includes(cmd))) {
            wasInterrupted = false;
            mode = "normal";
            lastCommand = transcript;
            showLoading();
            fetch("/voice/command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: "reset" })
            })
            .then(() => {

                if (/read inbox/i.test(transcript)) {
                    speak("Checking your inbox, please wait.", () => {
                        processCommand(transcript);
                    });
                } else {
                    processCommand(transcript);
                }

            }).finally(() => hideLoading());;

            return;
        }

        lastCommand = transcript;

        if (transcript.includes("next")) {
            speechSynthesis.cancel();
        }

        // Normal commands
        if (/read inbox/i.test(transcript)) {
            speak("Checking your inbox, please wait.", () => {
                processCommand(transcript);
            });
        } else {
            processCommand(transcript);
        }
    };

    recognition.onstart = function () {
        isListening = true;
        updateStatus("Listening...");
        const btn = document.getElementById("speakBtn");
         if (btn) {
        btn.classList.add("listening");
        btn.setAttribute("aria-pressed", "true");
    }
    };

    recognition.onend = function () {
        isListening = false;
        updateStatus("Idle");

        const btn = document.getElementById("speakBtn");
         if (btn) {
        btn.classList.remove("listening");
        btn.setAttribute("aria-pressed", "false");
    }
        if (mode === "continue") {
            speechDetected = false;
            return;
        }

        if (!speechDetected) {
            speak("No word detected. Stopping operation.");
            wasInterrupted = true;
        }

        speechDetected = false;
    };

    recognition.onerror = function () {
        isListening = false;
        updateStatus("Error occurred");
    };
}

/* ---------------- PROCESS COMMAND ---------------- */

function processCommand(transcript) {
    showLoading();

    fetch("/voice/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript })
    })
    .then(async res => {
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || "Server error");
        }
        return data;
    })
    .then(data => {
        handleVoiceResponse(data);
    })
    .catch((err) => {
    console.error(err);

    const message =
        err?.message ||
        "Could not process request. Please try again.";

    speak(message, startListening);

    updateResponse(message);
})
    .finally(() => {
        hideLoading();
    });
}
/* ---------------- LISTENING CONTROL ---------------- */

function startListening() {

    if (!recognition) {
        initRecognition();
    }

    if (isListening) return;

    if (wasInterrupted) {
        mode = "continue";
        speak("Should I continue the previous operation?", () => {
            safeStartRecognition();
        });
        return;
    }

    mode = "normal";
    safeStartRecognition();
}

function safeStartRecognition() {
    if (!isListening) {
        speechDetected = false;
        recognition.start();
    }
}

/* ---------------- CONTINUE DECISION ---------------- */

function handleContinueDecision(transcript) {

   if (/yes|continue|resume/.test(transcript)) {
        wasInterrupted = false;
        mode = "normal";

        speak("Continuing operation.", () => {

            if (lastCommand) {
                processCommand(lastCommand);
            } else {
                startListening();
            }
        });
   }
}

/* ---------------- HANDLE BACKEND RESPONSE ---------------- */

function handleVoiceResponse(data) {
    if (!data) {
        const msg = "No response from server.";
        updateResponse(msg);
        speak(msg, startListening);
        return;
    }

    if (data.message) {
        updateResponse(data.message);
        speak(data.message, () => {
            startListening();
        });
    }
    if (data.action === "CONFIRM_DELETE") {
    speak(data.message, () => {
        startListening();
    });
    }
}

/* ---------------- PAGE LOAD ---------------- */

window.onload = function () {
    updateStatus("Ready");
    speak("Voice email system ready. Say a command.", startListening);
};

/* ---------------- BUTTON ---------------- */

const speakBtn = document.getElementById("speakBtn");
if (speakBtn) {
    speakBtn.addEventListener("click", startListening);
}

/* ---------------- KEYBOARD CONTROLS ---------------- */

document.addEventListener("keydown", function (e) {

    if (e.code === "Space") {
        e.preventDefault();
        startListening();
    }

    if (e.code === "Escape") {
        speechSynthesis.cancel();
        updateStatus("Cancelled");
    }

    if (e.code === "KeyR") {
        if (lastSpokenMessage) {
            speak(lastSpokenMessage);
        }
    }
});

/* ---------------- EMAIL DISPLAY ---------------- */

function displayEmails(emails) {
    const container = document.getElementById("emails");
    if (!container) return;

    container.innerHTML = "";

    emails.forEach(email => {
        const div = document.createElement("div");
       div.innerHTML = `
  <div class="email-card">
    <div class="email-header">
      <strong>From:</strong> ${email.from}
    </div>
    <div class="email-subject">
      <strong>Subject:</strong> ${email.subject}
    </div>
    <div class="email-body">
      ${email.summary || "No preview available."}
    </div>
  </div>
`;
        container.appendChild(div);
    });
}