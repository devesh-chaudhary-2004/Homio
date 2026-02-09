const mongoose = require("mongoose");
const { MONGO_URL } = require("./env");

async function connectDB() {
  await mongoose.connect(MONGO_URL);
  return mongoose.connection;
}

module.exports = { connectDB };
