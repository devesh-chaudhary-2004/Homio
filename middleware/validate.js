const ExpressError = require("../utils/ExpressError");

function validate(schema, property = "body") {
  return (req, res, next) => {
    const { error } = schema.validate(req[property], { abortEarly: false });
    if (!error) return next();

    const message = error.details.map((d) => d.message).join(", ");
    return next(new ExpressError(400, message));
  };
}

module.exports = { validate };
