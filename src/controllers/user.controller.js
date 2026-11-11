/**
 * User profile controllers: /api/users/me
 *
 * `authenticate` has already loaded the logged-in user into req.user, so these
 * handlers update that document directly.
 */
const ApiError = require('../utils/ApiError');
const { cleanFilename } = require('../utils/filename');
const sendPdf = require('../utils/sendPdf');
const fileStorage = require('../services/fileStorage');

const noResumeError = () => new ApiError(404, "You haven't uploaded a resume yet");

// PUT /api/users/me: replace the editable profile fields.
async function updateProfile(req, res) {
  const { name, headline, location, skills } = req.body;
  // PUT replaces: optional fields left out are cleared.
  req.user.set({ name, headline: headline ?? '', location: location ?? '', skills: skills ?? [] });
  await req.user.save();
  res.status(200).json({ user: req.user });
}

// POST /api/users/me/resume (job seekers): upload or replace the profile resume.
async function uploadProfileResume(req, res) {
  if (!req.file) {
    throw new ApiError(400, 'Validation failed', [{ field: 'resume', message: 'Attach your resume as a PDF' }]);
  }

  const filename = cleanFilename(req.file.originalname);
  const fileId = await fileStorage.saveFile({
    buffer: req.file.buffer,
    filename,
    contentType: 'application/pdf',
    metadata: { owner: req.user._id, kind: 'profile-resume' },
  });

  const previousFileId = req.user.resume?.fileId;
  req.user.resume = { fileId, filename, size: req.file.size, uploadedAt: new Date() };
  try {
    await req.user.save();
  } catch (err) {
    await fileStorage.deleteFile(fileId); // don't leave an unused file behind
    throw err;
  }

  // Only delete the old file once the new one is safely saved.
  if (previousFileId) await fileStorage.deleteFile(previousFileId);

  res.status(200).json({ user: req.user });
}

// GET /api/users/me/resume (job seekers): download your own profile resume.
async function downloadProfileResume(req, res) {
  if (!req.user.resume) throw noResumeError();
  await sendPdf(res, req.user.resume.fileId, req.user.resume.filename);
}

// DELETE /api/users/me/resume (job seekers). Resumes already sent with
// applications are separate copies and are not affected.
async function deleteProfileResume(req, res) {
  if (!req.user.resume) throw noResumeError();
  const { fileId } = req.user.resume;
  req.user.resume = undefined;
  await req.user.save();
  await fileStorage.deleteFile(fileId);
  res.status(200).json({ user: req.user });
}

module.exports = { updateProfile, uploadProfileResume, downloadProfileResume, deleteProfileResume };
