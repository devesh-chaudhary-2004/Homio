const express = require("express");
const router = express.Router({ mergeParams: true });

const Review = require("../models/review");
const Booking = require("../models/booking");
const Listing = require("../models/listing");

const wrapAsync = require("../utils/wrapAsync");
const { validate } = require("../middleware/validate");
const { reviewSchema } = require("../schema");
const { requireRole } = require("../middleware/auth");
const ExpressError = require("../utils/ExpressError");
const { setFlash } = require("../middleware/flash");

async function recomputeListingRating(listingId) {
  const agg = await Review.aggregate([
    { $match: { listing: listingId } },
    {
      $group: {
        _id: "$listing",
        avg: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const ratingAverage = agg.length ? agg[0].avg : 0;
  const ratingCount = agg.length ? agg[0].count : 0;

  await Listing.findByIdAndUpdate(listingId, { ratingAverage, ratingCount });
}

// Create review (User who booked)
router.post(
  "/",
  requireRole(["user"]),
  validate(reviewSchema),
  wrapAsync(async (req, res) => {
    const listingId = req.params.id;

    const booking = await Booking.findOne({
      listing: listingId,
      user: req.user._id,
      status: "confirmed",
    });

    if (!booking) {
      setFlash(res, "warning", "You can only review properties you have booked.");
      return res.redirect(`/listings/${listingId}`);
    }

    const review = new Review({
      listing: listingId,
      user: req.user._id,
      rating: req.body.review.rating,
      comment: req.body.review.comment,
    });

    try {
      await review.save();
    } catch (err) {
      // Unique index violation: one review per user per listing
      if (err && err.code === 11000) {
        setFlash(res, "info", "You already reviewed this property.");
        return res.redirect(`/listings/${listingId}`);
      }
      throw err;
    }
    await recomputeListingRating(review.listing);
    setFlash(res, "success", "Review submitted. Thanks!");
    res.redirect(`/listings/${listingId}`);
  })
);

module.exports = router;
