/**
 * Application model: a job seeker's application to a job.
 */
const { Schema, model } = require('mongoose');
const { APPLICATION_STATUSES } = require('../utils/constants');

// The resume as submitted with this application. Each application keeps its
// own copy, so later profile changes never alter what the recruiter received.
const resumeSchema = new Schema(
  {
    fileId: { type: Schema.Types.ObjectId, required: true }, // id in GridFS (see services/fileStorage.js)
    filename: { type: String, required: true },
    size: { type: Number, required: true }, // bytes
  },
  { _id: false }
);

const applicationSchema = new Schema(
  {
    job: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    applicant: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resume: { type: resumeSchema, required: true },
    coverNote: { type: String, trim: true, maxlength: 2000, default: '' },
    status: {
      type: String,
      enum: Object.values(APPLICATION_STATUSES),
      default: APPLICATION_STATUSES.APPLIED,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false, // don't add a duplicate "id" virtual next to _id
    toJSON: {
      virtuals: true, // include resumeUrl (below) in API responses
      transform(doc, ret) {
        // The storage id is an internal detail; clients use resumeUrl.
        if (ret.resume) delete ret.resume.fileId;
        return ret;
      },
    },
  }
);

// One application per job seeker per job. A unique compound index enforces
// this in the database itself, even if two requests arrive at the same moment.
applicationSchema.index({ job: 1, applicant: 1 }, { unique: true });
// "My applications", newest first
applicationSchema.index({ applicant: 1, createdAt: -1 });

// A virtual is a computed property that isn't stored in MongoDB.
// The resume is only reachable through this access-checked endpoint.
applicationSchema.virtual('resumeUrl').get(function resumeUrl() {
  return `/api/applications/${this._id}/resume`;
});

module.exports = model('Application', applicationSchema);
