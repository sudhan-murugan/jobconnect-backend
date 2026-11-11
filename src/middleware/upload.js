/**
 * Resume upload middleware (Multer).
 *
 * Multer parses multipart/form-data requests (the format browsers use to send
 * files). It puts the uploaded file on req.file and the text fields on req.body.
 * Files are kept in memory (they're small) and then saved to GridFS by the
 * controller, only once the request has passed every other check.
 */
const multer = require('multer');
const ApiError = require('../utils/ApiError');
const { MAX_RESUME_SIZE_MB } = require('../utils/constants');

const PDF_SIGNATURE = Buffer.from('%PDF-'); // every PDF file starts with these bytes

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_SIZE_MB * 1024 * 1024, files: 1, fields: 5 },
  // Browsers send file names as UTF-8; without this, names like "Résumé.pdf" get garbled.
  defParamCharset: 'utf8',
  // First check: the type and extension the browser reports. These come from
  // the client and can be faked, so the file's content is checked below too.
  fileFilter(req, file, callback) {
    const looksLikePdf = file.mimetype === 'application/pdf' && /\.pdf$/i.test(file.originalname);
    if (!looksLikePdf) {
      return callback(
        new ApiError(400, 'Validation failed', [{ field: 'resume', message: 'Resume must be a PDF file' }])
      );
    }
    callback(null, true);
  },
}).single('resume'); // expect at most one file, in the form field named "resume"

// Wraps Multer so its errors become our usual JSON error responses.
function uploadResume(req, res, next) {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ApiError(413, `Resume must be ${MAX_RESUME_SIZE_MB} MB or smaller`, [
          { field: 'resume', message: `Resume must be ${MAX_RESUME_SIZE_MB} MB or smaller` },
        ]));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
        return next(new ApiError(400, 'Upload a single file in the "resume" field'));
      }
      return next(new ApiError(400, err.message));
    }
    if (err) return next(err);

    // Second check: the content really is a PDF (magic bytes), whatever the name says.
    if (req.file && !req.file.buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
      return next(
        new ApiError(400, 'Validation failed', [{ field: 'resume', message: 'This file is not a valid PDF' }])
      );
    }
    next();
  });
}

module.exports = { uploadResume };
