const express = require("express");
const router = express.Router();
const User = require("../models/user");
const wrapAsync = require("../utils/wrapAsync");
const { validate } = require("../middleware/validate");
const { registerSchema, loginSchema, verifyEmailSchema, forgotPasswordSchema, resetPasswordSchema } = require("../schema");
const { signToken } = require("../middleware/auth");
const { COOKIE_NAME } = require("../config/env");
const ExpressError = require("../utils/ExpressError");
const { sendOtpEmail } = require("../config/mailer");
const { setFlash } = require("../middleware/flash");

router.get("/register", (req, res) => {
  res.render("auth/register.ejs");
});

router.post(
  "/register",
  validate(registerSchema),
  wrapAsync(async (req, res) => {
    const { name, email, password, role } = req.body.user;
    const selectedRole = role || "user";

    // Check for existing user with same email AND role
    let user = await User.findOne({ email, role: selectedRole });
    if (user && user.isVerified) {
      const roleLabel = selectedRole === "host" ? "Host" : "Traveler";
      setFlash(res, "warning", `A ${roleLabel} account with this email already exists. Please login.`);
      return res.redirect("/login");
    }

    if (!user) {
      user = new User({ name, email, role: selectedRole });
    } else {
      user.name = name;
    }

    await user.setPassword(password);
    const code = user.setEmailVerificationCode();
    await user.save();

    await sendOtpEmail({ to: user.email, code });
    setFlash(res, "success", "Verification code sent to your email.");
    res.redirect(`/verify-email?email=${encodeURIComponent(user.email)}&role=${selectedRole}`);
  })
);

router.get("/login", (req, res) => {
  res.render("auth/login.ejs");
});

router.post(
  "/login",
  validate(loginSchema),
  wrapAsync(async (req, res) => {
    const { email, password, loginAs } = req.body.user;
    const selectedRole = loginAs || "user";
    
    // Find user by email AND role
    const user = await User.findOne({ email, role: selectedRole });
    if (!user) {
      const roleLabel = selectedRole === "host" ? "Host" : "Traveler";
      setFlash(res, "danger", `No ${roleLabel} account found with this email. Please check your selection or register.`);
      return res.redirect("/login");
    }

    if (!user.isVerified) {
      setFlash(res, "warning", "Please verify your email first.");
      return res.redirect(`/verify-email?email=${encodeURIComponent(user.email)}&role=${selectedRole}`);
    }

    const ok = await user.validatePassword(password);
    if (!ok) {
      setFlash(res, "danger", "Invalid email or password.");
      return res.redirect("/login");
    }

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax" });
    setFlash(res, "success", "Logged in successfully.");
    res.redirect(user.role === "host" ? "/host/dashboard" : "/dashboard");
  })
);

router.get("/verify-email", (req, res) => {
  const email = req.query.email || "";
  const role = req.query.role || "user";
  res.render("auth/verify-email.ejs", { email, role });
});

router.post(
  "/verify-email",
  validate(verifyEmailSchema),
  wrapAsync(async (req, res) => {
    const { email, code, role } = req.body.verify;
    const selectedRole = role || "user";
    
    const user = await User.findOne({ email, role: selectedRole });
    if (!user) {
      setFlash(res, "danger", "Account not found. Please register again.");
      return res.redirect("/register");
    }
    if (user.isVerified) {
      setFlash(res, "info", "Email already verified. Please login.");
      return res.redirect("/login");
    }

    if (user.emailVerifyAttempts >= 5) {
      setFlash(res, "warning", "Too many attempts. Please resend the code.");
      return res.redirect(`/verify-email?email=${encodeURIComponent(user.email)}&role=${selectedRole}`);
    }

    const ok = user.verifyEmailCode(code);
    await user.save();

    if (!ok) {
      setFlash(res, "danger", "Invalid or expired code.");
      return res.redirect(`/verify-email?email=${encodeURIComponent(user.email)}&role=${selectedRole}`);
    }

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax" });
    setFlash(res, "success", "Email verified. Welcome to Homio!");
    res.redirect(user.role === "host" ? "/host/dashboard" : "/dashboard");
  })
);

router.post(
  "/verify-email/resend",
  wrapAsync(async (req, res) => {
    const email = String(req.body.email || "").toLowerCase().trim();
    const role = req.body.role || "user";
    
    if (!email) {
      setFlash(res, "danger", "Email is required.");
      return res.redirect("/register");
    }

    const user = await User.findOne({ email, role });
    if (!user) {
      setFlash(res, "danger", "Account not found. Please register again.");
      return res.redirect("/register");
    }
    if (user.isVerified) {
      setFlash(res, "info", "Email already verified. Please login.");
      return res.redirect("/login");
    }

    const code = user.setEmailVerificationCode();
    await user.save();
    await sendOtpEmail({ to: user.email, code });
    setFlash(res, "success", "New code sent. Check your email.");
    res.redirect(`/verify-email?email=${encodeURIComponent(user.email)}&role=${role}`);
  })
);

// Forgot Password - Show form
router.get("/forgot-password", (req, res) => {
  res.render("auth/forgot-password.ejs");
});

// Forgot Password - Send OTP
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  wrapAsync(async (req, res) => {
    const email = String(req.body.email || "").toLowerCase().trim();
    const role = req.body.role || "user";
    
    const user = await User.findOne({ email, role });

    if (!user) {
      const roleLabel = role === "host" ? "Host" : "Traveler";
      setFlash(res, "danger", `No ${roleLabel} account found with this email.`);
      return res.redirect("/forgot-password");
    }

    if (!user.isVerified) {
      setFlash(res, "warning", "Please verify your email first.");
      return res.redirect(`/verify-email?email=${encodeURIComponent(user.email)}&role=${role}`);
    }

    const code = user.setPasswordResetCode();
    await user.save();

    await sendOtpEmail({ to: user.email, code, subject: "Password Reset Code - Homio" });
    setFlash(res, "success", "Password reset code sent to your email.");
    res.redirect(`/reset-password?email=${encodeURIComponent(user.email)}&role=${role}`);
  })
);

// Reset Password - Show form
router.get("/reset-password", (req, res) => {
  const email = req.query.email || "";
  const role = req.query.role || "user";
  res.render("auth/reset-password.ejs", { email, role });
});

// Reset Password - Verify OTP and update password
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  wrapAsync(async (req, res) => {
    const { email, code, password, role } = req.body.reset;
    const selectedRole = role || "user";
    
    const user = await User.findOne({ email, role: selectedRole });

    if (!user) {
      setFlash(res, "danger", "Account not found.");
      return res.redirect("/forgot-password");
    }

    if (user.passwordResetAttempts >= 5) {
      user.clearPasswordReset();
      await user.save();
      setFlash(res, "warning", "Too many attempts. Please request a new code.");
      return res.redirect("/forgot-password");
    }

    const ok = user.verifyPasswordResetCode(code);
    
    if (!ok) {
      await user.save();
      setFlash(res, "danger", "Invalid or expired code.");
      return res.redirect(`/reset-password?email=${encodeURIComponent(user.email)}&role=${selectedRole}`);
    }

    // Reset successful - update password
    await user.setPassword(password);
    user.clearPasswordReset();
    await user.save();

    setFlash(res, "success", "Password reset successful. Please login with your new password.");
    res.redirect("/login");
  })
);

// Resend Password Reset Code
router.post(
  "/reset-password/resend",
  wrapAsync(async (req, res) => {
    const email = String(req.body.email || "").toLowerCase().trim();
    const role = req.body.role || "user";
    
    if (!email) {
      setFlash(res, "danger", "Email is required.");
      return res.redirect("/forgot-password");
    }

    const user = await User.findOne({ email, role });
    if (!user) {
      setFlash(res, "danger", "Account not found.");
      return res.redirect("/forgot-password");
    }

    const code = user.setPasswordResetCode();
    await user.save();
    await sendOtpEmail({ to: user.email, code, subject: "Password Reset Code - Homio" });
    setFlash(res, "success", "New code sent. Check your email.");
    res.redirect(`/reset-password?email=${encodeURIComponent(user.email)}&role=${role}`);
  })
);

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  setFlash(res, "success", "Logged out successfully.");
  res.redirect("/login");
});

module.exports = router;
