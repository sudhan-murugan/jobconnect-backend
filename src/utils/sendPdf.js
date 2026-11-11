/**
 * Streams a stored PDF to the client as a download.
 * Used for both application resumes and profile resumes.
 */
const { pipeline } = require('node:stream/promises');
const ApiError = require('./ApiError');
const fileStorage = require('../services/fileStorage');

async function sendPdf(res, fileId, filename) {
  const file = await fileStorage.getFileInfo(fileId);
  if (!file) throw new ApiError(404, 'Resume file not found');

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': file.length,
    // Personal documents: browsers and proxies must not keep copies.
    'Cache-Control': 'private, no-store',
  });
  // Sets Content-Disposition with the file name, safely encoded.
  res.attachment(filename);
  await pipeline(fileStorage.openDownloadStream(file._id), res);
}

module.exports = sendPdf;
