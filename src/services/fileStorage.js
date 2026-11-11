/**
 * File storage for uploaded resumes, using MongoDB GridFS.
 *
 * GridFS stores files inside MongoDB (split into chunks), so:
 * - uploads survive server restarts and redeploys (unlike the local disk on
 *   hosts such as Render, whose filesystem is wiped on every deploy);
 * - no extra cloud account is needed: it works with MongoDB Atlas;
 * - files are never public: every download goes through an API endpoint that
 *   checks who is asking.
 *
 * The rest of the app only calls the functions below, so switching to S3 or
 * Cloudinary later would only mean rewriting this file.
 */
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const mongoose = require('mongoose');

const BUCKET_NAME = 'resumes'; // collections: resumes.files and resumes.chunks

// Created on demand, because the database connection must be open first.
function getBucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
}

/**
 * Saves a file from memory and returns its id.
 * @param {{ buffer: Buffer, filename: string, contentType: string, metadata?: object }} file
 */
async function saveFile({ buffer, filename, contentType, metadata = {} }) {
  const uploadStream = getBucket().openUploadStream(filename, {
    metadata: { contentType, ...metadata },
  });
  // Streams move data in pieces instead of all at once; pipeline() connects
  // them and waits until the upload has finished (or failed).
  await pipeline(Readable.from(buffer), uploadStream);
  return uploadStream.id;
}

// Returns { _id, filename, length, uploadDate, metadata } or null.
async function getFileInfo(fileId) {
  const [file] = await getBucket().find({ _id: fileId }).limit(1).toArray();
  return file ?? null;
}

function openDownloadStream(fileId) {
  return getBucket().openDownloadStream(fileId);
}

// Deletes a file. A file that is already gone is not an error.
async function deleteFile(fileId) {
  try {
    await getBucket().delete(fileId);
  } catch (err) {
    if (!/File not found/i.test(err.message)) throw err;
  }
}

module.exports = { saveFile, getFileInfo, openDownloadStream, deleteFile };
