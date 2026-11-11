/**
 * User model.
 *
 * A Mongoose schema describes the shape of documents in a MongoDB collection
 * (fields, types, defaults, validation). The model built from it ("User") is
 * what we use to query the `users` collection: User.findOne(), user.save()...
 */
const { Schema, model } = require('mongoose');
const bcrypt = require('bcrypt');
const config = require('../config/env');
const { ROLES } = require('../utils/constants');

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // `unique` creates a unique index in MongoDB, so two users can never share
    // an email, even if two sign-ups for the same email arrive at the same moment.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // We never store the plain password, only its bcrypt hash.
    // `select: false` keeps it out of query results unless explicitly requested.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true },

    // Profile fields (edited in Phase 6)
    headline: { type: String, trim: true, maxlength: 150, default: '' },
    skills: { type: [String], default: [] },
    location: { type: String, trim: true, maxlength: 100, default: '' },
    resumeUrl: { type: String, default: null },
  },
  {
    // Adds and maintains createdAt / updatedAt automatically.
    timestamps: true,
    // Controls what res.json(user) sends: never leak the hash or the internal __v field.
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Instance methods are available on every user document. They use a regular
// `function` (not an arrow function) so that `this` refers to the document.

userSchema.methods.setPassword = async function setPassword(plainPassword) {
  // bcrypt adds a random salt, so two users with the same password still get different hashes.
  this.passwordHash = await bcrypt.hash(plainPassword, config.bcryptSaltRounds);
};

userSchema.methods.comparePassword = function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

module.exports = model('User', userSchema);
