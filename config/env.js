const dotenv = require("dotenv");

// Loads .env if present. Safe to call even if .env is missing.
dotenv.config();

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 8080),
  MONGO_URL: process.env.MONGO_URL || "mongodb://localhost:27017/HomioDatabase",
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret-change-me",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  COOKIE_NAME: process.env.COOKIE_NAME || "token",
};
