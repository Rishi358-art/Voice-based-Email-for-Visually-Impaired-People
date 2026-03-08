const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema({
    googleId: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true
    },
    accessToken: {
        type: String,
        required: true
    },
    refreshToken: {
        type: String,
        required: true
    },
    expiryDate: {
        type: Number,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model("Token", tokenSchema);