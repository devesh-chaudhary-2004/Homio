const express = require("express");
const router = express.Router();

const Listing = require("../models/listing");
const wrapAsync = require("../utils/wrapAsync");

router.get(
  "/",
  wrapAsync(async (req, res) => {
    const featured = await Listing.find({}).sort({ ratingAverage: -1, ratingCount: -1, createdAt: -1 }).limit(6);
    res.render("home.ejs", { featured });
  })
);

module.exports = router;
