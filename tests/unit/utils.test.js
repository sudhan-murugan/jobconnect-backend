/**
 * Unit tests for small helpers and middleware, without HTTP requests.
 */
const escapeRegex = require('../../src/utils/escapeRegex');
const { cleanFilename } = require('../../src/utils/filename');
const { authorize } = require('../../src/middleware/role');
const ApiError = require('../../src/utils/ApiError');
const { createSimplePdf } = require('../../scripts/samplePdf');

describe('escapeRegex', () => {
  it('makes special characters match literally', () => {
    const pattern = new RegExp(escapeRegex('C++ (senior).*'));

    expect(pattern.test('C++ (senior).*')).toBe(true);
    expect(pattern.test('C (senior) anything')).toBe(false);
  });
});

describe('cleanFilename', () => {
  it('removes folders, quotes and control characters', () => {
    expect(cleanFilename('../../etc/"my"\u0007resume.pdf')).toBe('myresume.pdf');
  });

  it('keeps non-English characters', () => {
    expect(cleanFilename('Résumé Ana.pdf')).toBe('Résumé Ana.pdf');
  });

  it('falls back to a default name when nothing usable is left', () => {
    expect(cleanFilename('""')).toBe('resume.pdf');
  });

  it('limits the length to 100 characters, keeping the extension', () => {
    const cleaned = cleanFilename(`${'a'.repeat(200)}.pdf`);

    expect(cleaned).toHaveLength(100);
    expect(cleaned.endsWith('.pdf')).toBe(true);
  });
});

describe('authorize (role middleware)', () => {
  const run = (user, ...roles) => {
    const next = jest.fn();
    authorize(...roles)({ user }, {}, next);
    return next;
  };

  it('calls next() when the role is allowed', () => {
    expect(run({ role: 'recruiter' }, 'recruiter')).toHaveBeenCalledTimes(1);
  });

  it('throws 403 when the role is not allowed', () => {
    expect(() => run({ role: 'job_seeker' }, 'recruiter')).toThrow(
      expect.objectContaining({ statusCode: 403 })
    );
  });

  it('throws 401 when there is no logged-in user', () => {
    expect(() => run(undefined, 'recruiter')).toThrow(ApiError);
    expect(() => run(undefined, 'recruiter')).toThrow(expect.objectContaining({ statusCode: 401 }));
  });
});

describe('createSimplePdf (seed helper)', () => {
  it('produces a PDF with a valid cross-reference table offset', () => {
    const pdf = createSimplePdf(['Hello (world)']);
    const text = pdf.toString('ascii');
    const xrefOffset = Number(text.match(/startxref\n(\d+)/)[1]);

    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.slice(xrefOffset, xrefOffset + 4)).toBe('xref');
  });
});
