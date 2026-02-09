const { COOKIE_NAME } = require("../config/env");

const FLASH_COOKIE = "flash";

function setFlash(res, type, message) {
  const payload = { type, message, ts: Date.now() };
  res.cookie(FLASH_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: "lax",
  });
}

function flashMiddleware(req, res, next) {
  const raw = req.cookies?.[FLASH_COOKIE];
  if (!raw) {
    res.locals.flash = null;
    res.locals.isAuthed = Boolean(req.user);
    return next();
  }

  try {
    res.locals.flash = JSON.parse(raw);
  } catch {
    res.locals.flash = null;
  }

  res.clearCookie(FLASH_COOKIE);
  res.locals.isAuthed = Boolean(req.user);
  res.locals.cookieName = COOKIE_NAME;
  return next();
}

module.exports = { setFlash, flashMiddleware };
