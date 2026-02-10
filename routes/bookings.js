const express = require("express");
const router = express.Router({ mergeParams: true });
const crypto = require("crypto");

const Booking = require("../models/booking");
const Listing = require("../models/listing");

const wrapAsync = require("../utils/wrapAsync");
const { validate } = require("../middleware/validate");
const { bookingSchema } = require("../schema");
const { requireRole } = require("../middleware/auth");
const ExpressError = require("../utils/ExpressError");
const { setFlash } = require("../middleware/flash");
const { razorpay, RAZORPAY_KEY_ID } = require("../config/razorpay");

function normalizeDate(value) {
  // value might be string yyyy-mm-dd
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // Normalize to midday to avoid timezone edge cases
  d.setHours(12, 0, 0, 0);
  return d;
}

// Calculate nights between two dates
function calculateNights(startDate, endDate) {
  const diffTime = Math.abs(endDate - startDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Create booking and initiate payment (User)
router.post(
  "/",
  requireRole(["user"]),
  validate(bookingSchema),
  wrapAsync(async (req, res) => {
    const listingId = req.params.id;
    const listing = await Listing.findById(listingId);
    if (!listing) {
      setFlash(res, "danger", "Listing not found.");
      return res.redirect("/listings");
    }

    const startDate = normalizeDate(req.body.booking.startDate);
    const endDate = normalizeDate(req.body.booking.endDate);
    if (!startDate || !endDate) {
      setFlash(res, "danger", "Invalid dates. Please try again.");
      return res.redirect(`/listings/${listingId}`);
    }
    if (endDate <= startDate) {
      setFlash(res, "warning", "End date must be after start date.");
      return res.redirect(`/listings/${listingId}`);
    }

    // Overlap check: existing.start <= newEnd AND existing.end >= newStart
    const overlapping = await Booking.findOne({
      listing: listingId,
      status: { $in: ["pending", "confirmed"] },
      paymentStatus: { $in: ["pending", "paid"] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    });

    if (overlapping) {
      setFlash(res, "warning", "These dates are already booked. Try different dates.");
      return res.redirect(`/listings/${listingId}`);
    }

    // Calculate total amount
    const nights = calculateNights(startDate, endDate);
    const totalAmount = nights * listing.price;

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: totalAmount * 100, // Razorpay expects amount in paise
      currency: "INR",
      receipt: `booking_${Date.now()}`,
      notes: {
        listingId: listingId.toString(),
        userId: req.user._id.toString(),
      },
    });

    // Create pending booking
    const booking = new Booking({
      listing: listingId,
      user: req.user._id,
      startDate,
      endDate,
      status: "pending",
      totalAmount,
      paymentStatus: "pending",
      razorpayOrderId: razorpayOrder.id,
    });

    await booking.save();

    // Render payment page
    res.render("bookings/payment.ejs", {
      booking,
      listing,
      nights,
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId: RAZORPAY_KEY_ID,
      user: req.user,
    });
  })
);

// Verify payment callback
router.post(
  "/verify-payment",
  requireRole(["user"]),
  wrapAsync(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, booking_id } = req.body;

    // Find booking
    const booking = await Booking.findById(booking_id).populate("listing");
    if (!booking) {
      setFlash(res, "danger", "Booking not found.");
      return res.redirect("/dashboard");
    }

    // Verify the booking belongs to the user
    if (booking.user.toString() !== req.user._id.toString()) {
      setFlash(res, "danger", "Unauthorized action.");
      return res.redirect("/dashboard");
    }

    // Verify Razorpay signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "your_key_secret")
      .update(body.toString())
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    if (isValid) {
      // Payment successful
      booking.paymentStatus = "paid";
      booking.status = "confirmed";
      booking.razorpayPaymentId = razorpay_payment_id;
      booking.razorpaySignature = razorpay_signature;
      booking.paidAt = new Date();
      await booking.save();

      setFlash(res, "success", "Payment successful! Your booking is confirmed.");
      res.redirect("/dashboard");
    } else {
      // Payment failed
      booking.paymentStatus = "failed";
      booking.status = "cancelled";
      await booking.save();

      setFlash(res, "danger", "Payment verification failed. Please try again.");
      res.redirect(`/listings/${booking.listing._id}`);
    }
  })
);

// Payment failure handler
router.post(
  "/payment-failed",
  requireRole(["user"]),
  wrapAsync(async (req, res) => {
    const { booking_id } = req.body;
    
    const booking = await Booking.findById(booking_id);
    if (booking && booking.user.toString() === req.user._id.toString()) {
      booking.paymentStatus = "failed";
      booking.status = "cancelled";
      await booking.save();
    }

    setFlash(res, "danger", "Payment was cancelled or failed. Please try again.");
    res.redirect(`/listings/${booking ? booking.listing : ""}`);
  })
);

// Resume payment for pending booking (User)
router.get(
  "/:bookingId/pay",
  requireRole(["user"]),
  wrapAsync(async (req, res) => {
    const booking = await Booking.findById(req.params.bookingId).populate("listing");
    if (!booking) {
      setFlash(res, "danger", "Booking not found.");
      return res.redirect("/dashboard");
    }
    if (booking.user.toString() !== req.user._id.toString()) {
      setFlash(res, "danger", "Unauthorized action.");
      return res.redirect("/dashboard");
    }
    if (booking.status !== "pending" || booking.paymentStatus !== "pending") {
      setFlash(res, "warning", "This booking cannot be paid for.");
      return res.redirect("/dashboard");
    }

    const listing = booking.listing;
    const nights = booking.getNights();

    // Create new Razorpay order (old one may have expired)
    const razorpayOrder = await razorpay.orders.create({
      amount: booking.totalAmount * 100,
      currency: "INR",
      receipt: `booking_${Date.now()}`,
      notes: {
        listingId: listing._id.toString(),
        userId: req.user._id.toString(),
      },
    });

    // Update booking with new order ID
    booking.razorpayOrderId = razorpayOrder.id;
    await booking.save();

    res.render("bookings/payment.ejs", {
      booking,
      listing,
      nights,
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId: RAZORPAY_KEY_ID,
      user: req.user,
    });
  })
);

// Cancel booking (User)
router.post(
  "/:bookingId/cancel",
  requireRole(["user"]),
  wrapAsync(async (req, res) => {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      setFlash(res, "danger", "Booking not found.");
      return res.redirect("/dashboard");
    }
    if (booking.user.toString() !== req.user._id.toString()) {
      setFlash(res, "danger", "You can only cancel your own bookings.");
      return res.redirect("/dashboard");
    }

    booking.status = "cancelled";
    // For real refunds, you'd integrate Razorpay refund API here
    if (booking.paymentStatus === "paid") {
      booking.paymentStatus = "refunded";
    }
    await booking.save();
    
    setFlash(res, "info", "Booking cancelled." + (booking.paymentStatus === "refunded" ? " Refund will be processed within 5-7 business days." : ""));
    res.redirect("/dashboard");
  })
);

module.exports = router;
