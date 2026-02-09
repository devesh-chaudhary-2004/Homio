const Razorpay = require("razorpay");

// Initialize Razorpay instance
// In development, we'll use test keys. In production, use real keys from env.
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_your_key_id",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "your_key_secret",
});

module.exports = {
  razorpay,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "rzp_test_your_key_id",
};
