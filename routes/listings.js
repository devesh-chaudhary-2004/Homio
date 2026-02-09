const express = require("express");
const router = express.Router();

const Listing = require("../models/listing");
const Review = require("../models/review");
const Booking = require("../models/booking");
const User = require("../models/user");

const wrapAsync = require("../utils/wrapAsync");
const { validate } = require("../middleware/validate");
const { listingSchema } = require("../schema");
const { requireRole } = require("../middleware/auth");
const ExpressError = require("../utils/ExpressError");
const { upload } = require("../middleware/upload");
const { uploadImageBuffer, deleteByPublicId } = require("../config/cloudinary");
const { setFlash } = require("../middleware/flash");

// Generate search patterns - matches if at least 4 consecutive characters match
function generateSearchPatterns(searchTerm) {
  const term = searchTerm.trim().toLowerCase();
  if (term.length < 4) return [term]; // If less than 4 chars, use exact match
  
  const patterns = new Set();
  
  // Add the full search term
  patterns.add(term);
  
  // Generate all possible 4+ character consecutive substrings
  // This way "ndia" will match "india", "amrica" will match via "mric" or "rica"
  for (let len = 4; len <= term.length; len++) {
    for (let i = 0; i <= term.length - len; i++) {
      patterns.add(term.slice(i, i + len));
    }
  }
  
  return [...patterns];
}

function buildListingsQuery(query) {
  const filter = {};

  if (query.location) {
    const searchTerm = query.location.trim();
    const patterns = generateSearchPatterns(searchTerm);
    
    // Create OR conditions - match if ANY 4+ char substring matches
    const locationConditions = [];
    for (const pattern of patterns) {
      locationConditions.push(
        { location: { $regex: pattern, $options: "i" } },
        { country: { $regex: pattern, $options: "i" } },
        { title: { $regex: pattern, $options: "i" } }
      );
    }
    
    filter.$or = locationConditions;
  }

  const minPrice = query.minPrice ? Number(query.minPrice) : null;
  const maxPrice = query.maxPrice ? Number(query.maxPrice) : null;
  if (minPrice != null || maxPrice != null) {
    filter.price = {};
    if (minPrice != null && !Number.isNaN(minPrice)) filter.price.$gte = minPrice;
    if (maxPrice != null && !Number.isNaN(maxPrice)) filter.price.$lte = maxPrice;
  }

  if (query.minRating) {
    const minRating = Number(query.minRating);
    if (!Number.isNaN(minRating)) filter.ratingAverage = { $gte: minRating };
  }

  if (query.amenities) {
    const amenities = Array.isArray(query.amenities)
      ? query.amenities
      : String(query.amenities)
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean);
    if (amenities.length) filter.amenities = { $all: amenities };
  }

  return filter;
}

function buildSort(sortKey) {
  switch (sortKey) {
    case "price_asc":
      return { price: 1 };
    case "price_desc":
      return { price: -1 };
    case "rating_desc":
      return { ratingAverage: -1, ratingCount: -1 };
    case "newest":
    default:
      return { createdAt: -1 };
  }
}

// Index + search/filter/sort
router.get(
  "/",
  wrapAsync(async (req, res) => {
    const filter = buildListingsQuery(req.query);
    const sort = buildSort(req.query.sort);

    const allListings = await Listing.find(filter).sort(sort);
    res.render("listings/index.ejs", { allListings, q: req.query });
  })
);

// New (Host)
router.get("/new", requireRole(["host"]), (req, res) => {
  res.render("listings/new.ejs");
});

// Create (Host)
router.post(
  "/create",
  requireRole(["host"]),
  upload.single("listingImage"),
  validate(listingSchema),
  wrapAsync(async (req, res) => {
    const listing = new Listing(req.body.listing);
    listing.host = req.user._id;

    // amenities may come as comma string
    if (typeof req.body.listing.amenities === "string") {
      listing.amenities = req.body.listing.amenities
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
    }

    // If file uploaded, use Cloudinary URL
    if (req.file) {
      const uploaded = await uploadImageBuffer(req.file);
      if (uploaded?.url) {
        listing.image = uploaded.url;
        listing.imagePublicId = uploaded.publicId;
      }
    }

    await listing.save();
    setFlash(res, "success", "Property listed successfully.");
    res.redirect("/listings");
  })
);

// Show (with reviews and booked dates)
router.get(
  "/:id",
  wrapAsync(async (req, res) => {
    const listing = await Listing.findById(req.params.id).populate("host");
    if (!listing) {
      setFlash(res, "danger", "Listing not found.");
      return res.redirect("/listings");
    }

    const reviews = await Review.find({ listing: listing._id })
      .sort({ createdAt: -1 })
      .populate("user");

    // Fetch booked dates for this listing (confirmed and pending bookings)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const bookings = await Booking.find({
      listing: listing._id,
      status: { $in: ["pending", "confirmed"] },
      paymentStatus: { $in: ["pending", "paid"] },
      endDate: { $gte: today }
    }).select("startDate endDate");

    // Convert bookings to array of date ranges for client-side
    const bookedDates = bookings.map(b => ({
      start: b.startDate.toISOString().split('T')[0],
      end: b.endDate.toISOString().split('T')[0]
    }));

    // Check if current user has an existing booking
    let userBooking = null;
    let isInWishlist = false;
    if (req.user) {
      userBooking = await Booking.findOne({
        listing: listing._id,
        user: req.user._id,
        status: { $in: ["pending", "confirmed"] },
        endDate: { $gte: today }
      });
      
      // Check if listing is in user's wishlist
      const user = await User.findById(req.user._id).select("wishlist");
      isInWishlist = user?.wishlist?.some(id => id.toString() === listing._id.toString()) || false;
    }

    res.render("listings/show.ejs", { listing, reviews, bookedDates, userBooking, isInWishlist });
  })
);

// Edit (Host owner)
router.get(
  "/:id/edit",
  requireRole(["host"]),
  wrapAsync(async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      setFlash(res, "danger", "Listing not found.");
      return res.redirect("/listings");
    }
    if (listing.host && listing.host.toString() !== req.user._id.toString()) {
      setFlash(res, "danger", "You can only edit your own listings.");
      return res.redirect(`/listings/${listing._id}`);
    }
    res.render("listings/edit.ejs", { listing });
  })
);

// Update (Host owner)
router.put(
  "/:id",
  requireRole(["host"]),
  upload.single("listingImage"),
  validate(listingSchema),
  wrapAsync(async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      setFlash(res, "danger", "Listing not found.");
      return res.redirect("/listings");
    }
    if (listing.host && listing.host.toString() !== req.user._id.toString()) {
      setFlash(res, "danger", "You can only update your own listings.");
      return res.redirect(`/listings/${listing._id}`);
    }

    const update = { ...req.body.listing };
    if (typeof update.amenities === "string") {
      update.amenities = update.amenities
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
    }

    // If file uploaded, replace Cloudinary image
    if (req.file) {
      const uploaded = await uploadImageBuffer(req.file);
      if (uploaded?.url) {
        await deleteByPublicId(listing.imagePublicId);
        update.image = uploaded.url;
        update.imagePublicId = uploaded.publicId;
      }
    }

    await Listing.findByIdAndUpdate(req.params.id, update);
    setFlash(res, "success", "Listing updated successfully.");
    res.redirect(`/listings/${req.params.id}`);
  })
);

// Delete (Host owner)
router.delete(
  "/:id",
  requireRole(["host"]),
  wrapAsync(async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      setFlash(res, "danger", "Listing not found.");
      return res.redirect("/listings");
    }
    if (listing.host && listing.host.toString() !== req.user._id.toString()) {
      setFlash(res, "danger", "You can only delete your own listings.");
      return res.redirect(`/listings/${listing._id}`);
    }

    await deleteByPublicId(listing.imagePublicId);
    await Listing.findByIdAndDelete(req.params.id);
    setFlash(res, "info", "Listing deleted.");
    res.redirect("/listings");
  })
);

module.exports = router;
