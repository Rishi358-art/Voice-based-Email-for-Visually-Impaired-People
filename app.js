process.on("unhandledRejection", (err) => {
    console.error("UNHANDLED REJECTION 💥", err);
    process.exit(1);
});

process.on("uncaughtException", (err) => {
    console.error("UNCAUGHT EXCEPTION 💥", err);
    process.exit(1);
});
require("dotenv").config();
const express = require("express");

const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/auth.routes");
const mailRoutes = require("./routes/mail.routes");
const AppError = require("./utils/AppError");


const app = express();

/* ==============================
   DATABASE CONNECTION
============================== */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Atlas Connected"))
  .catch(err => console.log("DB Error:", err));

/* ==============================
   SECURITY MIDDLEWARES
============================== */
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser());

/* ==============================
   RATE LIMITING
============================== */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  handler: (req, res, next) => {
    next(new AppError("Too many requests. Please try again later.", 429));
  }
});
app.use(limiter);

/* ==============================
   LOGGING
============================== */
app.use(morgan("dev"));

/* ==============================
   SESSION CONFIG (connect-mongo v4+)
============================== */

app.set("trust proxy", 1);
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,   // <--- IMPORTANT CHANGE
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "sessions"
  }),
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 1000 * 60 * 60
  }
}));



/* ==============================
   VIEW ENGINE
============================== */
const path = require("path");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
/* ==============================
   BASIC ROUTE
============================== */
app.use("/auth", authRoutes);
app.use("/mail", mailRoutes);
app.use("/voice", require("./routes/voice.routes"));
function ensureAuth(req, res, next) {
    if (!req.session.googleId) {
        return res.redirect("/auth/login");
    }
    next();
}
app.get("/",ensureAuth, (req, res) => {
  res.render("index", { message: "Voice Email System Running" });
});
app.get("/dashboard", (req, res) => {
     if (!req.session.googleId) {
        return res.redirect("/auth/login");
    }

    res.send("Logged in Successfully!");
});



app.use((req, res, next) => {
    next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

app.use((err, req, res, next) => {

    console.error("🔥 ERROR:", err);

    err.statusCode = err.statusCode || 500;
    err.status = err.status || "error";

    // Development Mode
    if (process.env.NODE_ENV === "development") {
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
            stack: err.stack
        });
    }

    // Production Mode
    if (process.env.NODE_ENV === "production") {

        // Operational error (trusted)
        if (err.isOperational) {
            return res.status(err.statusCode).json({
                status: err.status,
                message: err.message
            });
        }

        // Programming / unknown error
        return res.status(err.statusCode).json({
    status: err.status,
    message: err.message
});
    }

});
module.exports = app;


