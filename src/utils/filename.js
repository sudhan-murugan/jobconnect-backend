/**
 * Keeps only a safe, readable file name from an uploaded file: no folders,
 * control characters or quotes, and at most 100 characters.
 */
const path = require('node:path');

function cleanFilename(originalName, fallback = 'resume.pdf') {
  const name = path.basename(originalName).replace(/[\u0000-\u001f\u007f"\\]/g, '').trim();
  return (name || fallback).slice(-100);
}

module.exports = { cleanFilename };
