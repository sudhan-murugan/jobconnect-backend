/**
 * Validation rules shared by several resources.
 */
const { body } = require('express-validator');

// Removes duplicate skills, ignoring case ("React" and "react" count as one).
function uniqueSkills(skills) {
  if (!Array.isArray(skills)) return skills;
  const seen = new Set();
  return skills.filter((skill) => {
    if (typeof skill !== 'string') return true; // left for the validator to reject
    const key = skill.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Optional "skills" array: up to 20 non-empty strings of at most 40 characters.
// "skills.*" applies the rule to every item in the array.
const skillsRules = [
  body('skills.*')
    .isString()
    .withMessage('Each skill must be text')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Skills cannot be empty')
    .isLength({ max: 40 })
    .withMessage('Each skill must be at most 40 characters'),
  body('skills')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Skills must be a list of at most 20 items')
    .customSanitizer(uniqueSkills),
];

module.exports = { skillsRules };
