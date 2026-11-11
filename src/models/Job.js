/**
 * Job model: a job posted by a recruiter.
 */
const { Schema, model } = require('mongoose');
const { JOB_TYPES } = require('../utils/constants');

// A sub-schema for a nested object. `_id: false` because it is part of the job,
// not a separate document that needs its own id.
const salaryRangeSchema = new Schema(
  {
    min: { type: Number, required: true, min: 0 },
    max: {
      type: Number,
      required: true,
      min: 0,
      // Custom validator; `this` is the salaryRange object being validated.
      validate: {
        validator(value) {
          return value >= this.min;
        },
        message: 'Maximum salary must be greater than or equal to the minimum',
      },
    },
    // ISO 4217 code, e.g. SGD, USD
    currency: { type: String, trim: true, uppercase: true, default: 'SGD', match: /^[A-Z]{3}$/ },
  },
  { _id: false }
);

const jobSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    company: { type: String, required: true, trim: true, maxlength: 100 },
    location: { type: String, required: true, trim: true, maxlength: 100 },
    jobType: { type: String, required: true, enum: Object.values(JOB_TYPES) },
    // Monthly salary range. Optional: not every job advertises pay.
    salaryRange: { type: salaryRangeSchema, default: undefined },
    skills: { type: [{ type: String, trim: true, maxlength: 40 }], default: [] },
    // A reference to the recruiter who posted the job. `ref` lets us call
    // .populate('postedBy') to swap the id for the user's data in queries.
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true, // createdAt / updatedAt
    versionKey: false, // don't add the internal __v field
  }
);

// ---- Indexes ----
// Indexes are like a book's index: they let MongoDB find matching documents
// without scanning the whole collection.

// Full-text search index for keyword search. Weights rank a match in the
// title higher than one buried in the description.
jobSchema.index(
  { title: 'text', skills: 'text', company: 'text', description: 'text' },
  { name: 'job_text_search', weights: { title: 10, skills: 5, company: 3, description: 1 } }
);
// Default listing order (newest first), optionally filtered by job type or recruiter.
jobSchema.index({ createdAt: -1 });
jobSchema.index({ jobType: 1, createdAt: -1 });
jobSchema.index({ postedBy: 1, createdAt: -1 });

// ---- Instance methods ----
jobSchema.methods.isOwnedBy = function isOwnedBy(user) {
  // ObjectIds are objects, so compare them with .equals() rather than ===.
  return Boolean(user) && this.postedBy.equals(user._id);
};

module.exports = model('Job', jobSchema);
