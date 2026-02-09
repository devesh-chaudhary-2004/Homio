const express = require("express");
const app = express();
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const cookieParser = require("cookie-parser");

require("./config/env");
const { connectDB } = require("./config/db");
const { PORT } = require("./config/env");


const ExpressError = require("./utils/ExpressError.js");
const { attachUser } = require("./middleware/auth");
const { errorHandler } = require("./middleware/errorHandler");
const { flashMiddleware } = require("./middleware/flash");

const authRoutes = require("./routes/auth");
const homeRoutes = require("./routes/home");
const listingRoutes = require("./routes/listings");
const bookingRoutes = require("./routes/bookings");
const reviewRoutes = require("./routes/reviews");
const dashboardRoutes = require("./routes/dashboard");

connectDB()
  .then(() => console.log("connected to DB"))
  .catch((err) => console.log(err));

app.set("view engine", "ejs");
app.set("views",path.join(__dirname,"views"));
app.use(express.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.use(cookieParser());
app.engine('ejs',ejsMate);
app.use(express.static(path.join(__dirname,"/public")));
app.use(attachUser);
app.use(flashMiddleware);

app.use(homeRoutes);

app.use(authRoutes);
app.use(dashboardRoutes);

app.use("/listings", listingRoutes);
app.use("/listings/:id/bookings", bookingRoutes);
app.use("/listings/:id/reviews", reviewRoutes);

app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found!"));
});

app.use(errorHandler);

app.listen(PORT,() => {
    console.log(`server is listening at port ${PORT}`);
});