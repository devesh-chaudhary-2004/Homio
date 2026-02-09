const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    email: { type: String, trim: true, lowercase: true, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "host"], default: "user" },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Listing" }],

    isVerified: { type: Boolean, default: false },
    emailVerifyCodeHash: { type: String, default: null },
    emailVerifyExpires: { type: Date, default: null },
    emailVerifyAttempts: { type: Number, default: 0 },

    // Password Reset Fields
    passwordResetCodeHash: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },
    passwordResetAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound unique index - same email can have different roles
userSchema.index({ email: 1, role: 1 }, { unique: true });

userSchema.methods.setPassword = async function (plainPassword) {
  const saltRounds = 10;
  this.passwordHash = await bcrypt.hash(plainPassword, saltRounds);
};

userSchema.methods.validatePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

userSchema.methods.setEmailVerificationCode = function () {
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
  const hash = crypto.createHash("sha256").update(code).digest("hex");
  this.emailVerifyCodeHash = hash;
  this.emailVerifyExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  this.emailVerifyAttempts = 0;
  return code;
};

userSchema.methods.verifyEmailCode = function (code) {
  if (!this.emailVerifyCodeHash || !this.emailVerifyExpires) return false;
  if (new Date() > this.emailVerifyExpires) return false;

  const hash = crypto.createHash("sha256").update(String(code).trim()).digest("hex");
  const ok = hash === this.emailVerifyCodeHash;
  this.emailVerifyAttempts += 1;
  if (ok) {
    this.isVerified = true;
    this.emailVerifyCodeHash = null;
    this.emailVerifyExpires = null;
    this.emailVerifyAttempts = 0;
  }
  return ok;
};

// Password Reset Methods
userSchema.methods.setPasswordResetCode = function () {
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
  const hash = crypto.createHash("sha256").update(code).digest("hex");
  this.passwordResetCodeHash = hash;
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  this.passwordResetAttempts = 0;
  return code;
};

userSchema.methods.verifyPasswordResetCode = function (code) {
  if (!this.passwordResetCodeHash || !this.passwordResetExpires) return false;
  if (new Date() > this.passwordResetExpires) return false;

  const hash = crypto.createHash("sha256").update(String(code).trim()).digest("hex");
  const ok = hash === this.passwordResetCodeHash;
  this.passwordResetAttempts += 1;
  return ok;
};

userSchema.methods.clearPasswordReset = function () {
  this.passwordResetCodeHash = null;
  this.passwordResetExpires = null;
  this.passwordResetAttempts = 0;
};

module.exports = mongoose.model("User", userSchema);
