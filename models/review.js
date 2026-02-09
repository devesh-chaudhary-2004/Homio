const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, required: true },
  },
  { timestamps: true }
);

// One review per user per listing
reviewSchema.index({ listing: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
