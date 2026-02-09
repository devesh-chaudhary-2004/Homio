const jwt = require("jsonwebtoken");
const ExpressError = require("../utils/ExpressError");
const User = require("../models/user");
const { JWT_SECRET, JWT_EXPIRES_IN, COOKIE_NAME } = require("../config/env");

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function attachUser(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.locals.currentUser = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);
    res.locals.currentUser = user || null;
    req.user = user || null;
    return next();
  } catch (err) {
    // invalid/expired token -> treat as logged out
    res.clearCookie(COOKIE_NAME);
    res.locals.currentUser = null;
    req.user = null;
    return next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return next(new ExpressError(401, "Please login to continue."));
  }
  return next();
}

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return next(new ExpressError(401, "Please login to continue."));
    }
    if (!allowed.includes(req.user.role)) {
      return next(new ExpressError(403, "You are not allowed to do that."));
    }
    return next();
  };
}

module.exports = {
  signToken,
  attachUser,
  requireAuth,
  requireRole,
};
