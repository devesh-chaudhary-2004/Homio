const joi = require('joi');

module.exports.listingSchema = joi.object({
    listing : joi.object({
        title : joi.string().required(),
        description : joi.string().required(),
        location : joi.string().required(),
        country : joi.string().required(),
        price : joi.number().required().min(0),
        image: joi.string().allow("",null),
        amenities: joi.alternatives().try(
            joi.array().items(joi.string().trim()).default([]),
            joi.string().allow("", null)
        )
    }).required()
});

module.exports.registerSchema = joi.object({
    user: joi.object({
        name: joi.string().trim().min(2).max(60).required(),
        email: joi.string().email().required(),
        password: joi.string().min(6).max(100).required(),
        role: joi.string().valid("user", "host").default("user")
    }).required()
});

module.exports.loginSchema = joi.object({
    user: joi.object({
        email: joi.string().email().required(),
        password: joi.string().required(),
        loginAs: joi.string().valid("user", "host").optional()
    }).required()
});

module.exports.verifyEmailSchema = joi.object({
    verify: joi.object({
        email: joi.string().email().required(),
        code: joi.string().pattern(/^\d{6}$/).required(),
        role: joi.string().valid("user", "host").default("user")
    }).required()
});

module.exports.forgotPasswordSchema = joi.object({
    email: joi.string().email().required(),
    role: joi.string().valid("user", "host").default("user")
});

module.exports.resetPasswordSchema = joi.object({
    reset: joi.object({
        email: joi.string().email().required(),
        code: joi.string().pattern(/^\d{6}$/).required(),
        password: joi.string().min(6).max(100).required(),
        role: joi.string().valid("user", "host").default("user")
    }).required()
});

module.exports.bookingSchema = joi.object({
    booking: joi.object({
        startDate: joi.date().required(),
        endDate: joi.date().greater(joi.ref("startDate")).required()
    }).required()
});

module.exports.reviewSchema = joi.object({
    review: joi.object({
        rating: joi.number().min(1).max(5).required(),
        comment: joi.string().trim().min(5).max(500).required()
    }).required()
});