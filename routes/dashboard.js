const express = require("express");
const router = express.Router();

const Booking = require("../models/booking");
const Listing = require("../models/listing");
const User = require("../models/user");

const wrapAsync = require("../utils/wrapAsync");
const { requireRole, requireAuth } = require("../middleware/auth");

// User dashboard
router.get(
  "/dashboard",
  requireRole(["user"]),
  wrapAsync(async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate("listing");

    const user = await User.findById(req.user._id).populate("wishlist");

    // Calculate user stats
    const confirmedBookings = bookings.filter(b => b.status === "confirmed" && b.paymentStatus === "paid");
    const pendingBookings = bookings.filter(b => b.status === "pending");
    const cancelledBookings = bookings.filter(b => b.status === "cancelled");
    const totalSpent = confirmedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    res.render("dashboard/user.ejs", {
      bookings,
      wishlist: user?.wishlist || [],
      profile: user,
      stats: {
        confirmed: confirmedBookings.length,
        pending: pendingBookings.length,
        cancelled: cancelledBookings.length,
        totalSpent
      }
    });
  })
);

// Wishlist toggle
router.post(
  "/wishlist/:listingId/toggle",
  requireAuth,
  wrapAsync(async (req, res) => {
    const listingId = req.params.listingId;
    const user = await User.findById(req.user._id);

    const exists = user.wishlist.some((id) => id.toString() === listingId);
    if (exists) {
      user.wishlist = user.wishlist.filter((id) => id.toString() !== listingId);
    } else {
      user.wishlist.push(listingId);
    }

    await user.save();
    
    // Return JSON for AJAX requests
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, inWishlist: !exists });
    }
    res.redirect("back");
  })
);

// Host dashboard
router.get(
  "/host/dashboard",
  requireRole(["host"]),
  wrapAsync(async (req, res) => {
    const myListings = await Listing.find({ host: req.user._id }).sort({ createdAt: -1 });

    // bookings on host listings
    const listingIds = myListings.map((l) => l._id);
    const allBookings = await Booking.find({ listing: { $in: listingIds } })
      .sort({ createdAt: -1 })
      .populate("listing")
      .populate("user");

    // Filter bookings by status
    const confirmedBookings = allBookings.filter(b => b.status === "confirmed" && b.paymentStatus === "paid");
    const pendingBookings = allBookings.filter(b => b.status === "pending");
    
    // Calculate earnings from paid bookings
    let totalEarnings = 0;
    let thisMonthEarnings = 0;
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    for (const b of confirmedBookings) {
      const amount = b.totalAmount || 0;
      totalEarnings += amount;
      
      if (b.paidAt && new Date(b.paidAt) >= thisMonth) {
        thisMonthEarnings += amount;
      }
    }

    res.render("host/dashboard.ejs", { 
      myListings, 
      bookingRequests: allBookings.filter(b => b.status !== "cancelled"),
      confirmedBookings,
      pendingBookings,
      stats: {
        totalListings: myListings.length,
        totalBookings: confirmedBookings.length,
        pendingBookings: pendingBookings.length,
        totalEarnings,
        thisMonthEarnings
      }
    });
  })
);

module.exports = router;
