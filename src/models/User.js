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

// The resume saved on a job seeker's profile (stored in GridFS, see services/fileStorage.js).
const profileResumeSchema = new Schema(
  {
    fileId: { type: Schema.Types.ObjectId, required: true },
    filename: { type: String, required: true },
    size: { type: Number, required: true }, // bytes
    uploadedAt: { type: Date, required: true },
  },
  { _id: false }
);

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

    // Profile fields (edited with PUT /api/users/me)
    headline: { type: String, trim: true, maxlength: 150, default: '' },
    skills: { type: [{ type: String, trim: true, maxlength: 40 }], default: [] },
    location: { type: String, trim: true, maxlength: 100, default: '' },
    // Job seekers only (POST /api/users/me/resume). Absent until uploaded.
    resume: { type: profileResumeSchema, default: undefined },
  },
  {
    // Adds and maintains createdAt / updatedAt automatically.
    timestamps: true,
    id: false, // don't add a duplicate "id" virtual next to _id
    // Controls what res.json(user) sends.
    toJSON: {
      virtuals: true, // include resumeUrl (below)
      transform(doc, ret) {
        // Never leak the password hash, the internal __v field or storage ids.
        delete ret.passwordHash;
        delete ret.__v;
        if (ret.resume) delete ret.resume.fileId;
        return ret;
      },
    },
  }
);

// Where the logged-in user can download their own profile resume, or null.
// A virtual is computed when read, not stored in MongoDB.
userSchema.virtual('resumeUrl').get(function resumeUrl() {
  return this.resume ? '/api/users/me/resume' : null;
});

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
