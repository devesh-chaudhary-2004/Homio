const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/HomioDatabase";

const initDB = async () => {
    await Listing.deleteMany({});
    await Listing.insertMany(initData.data);
    console.log("data was initialized");
}

mongoose.connect(MONGO_URL)
  .then(() => {
    console.log("connected to DB");
    return initDB();
  })
  .then(() => {
    console.log("Database seeded successfully!");
    mongoose.connection.close();
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });