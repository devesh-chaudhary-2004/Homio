const express = require("express");
const router = express.Router();

const Listing = require("../models/listing");
const wrapAsync = require("../utils/wrapAsync");

router.get(
  "/",
  wrapAsync(async (req, res) => {
    const featured = await Listing.find({}).sort({ ratingAverage: -1, ratingCount: -1, createdAt: -1 }).limit(9);
    res.render("home.ejs", { featured });
  })
);

// Coming Soon pages
router.get("/privacy", (req, res) => {
  res.render("coming-soon.ejs", { title: "Privacy Policy" });
});

router.get("/terms", (req, res) => {
  res.render("coming-soon.ejs", { title: "Terms of Service" });
});

router.get("/help", (req, res) => {
  res.render("coming-soon.ejs", { title: "Help Center" });
});

module.exports = router;
