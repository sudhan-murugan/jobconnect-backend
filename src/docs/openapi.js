/**
 * OpenAPI (Swagger) specification for the JobConnect API.
 *
 * OpenAPI is a standard, machine-readable description of a REST API. Swagger
 * UI turns it into interactive docs at GET /api/docs, where you can try every
 * endpoint from the browser. Keep this file in sync when routes change.
 */
const {
  JOB_TYPES,
  ROLES,
  PAGINATION,
  APPLICATION_STATUSES,
  MAX_RESUME_SIZE_MB,
} = require('../utils/constants');

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const response = (name) => ({ $ref: `#/components/responses/${name}` });
const jsonContent = (schema, example) => ({
  'application/json': { schema, ...(example && { example }) },
});

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'JobConnect API',
    version: '1.0.0',
    description:
      'REST API for JobConnect, a job portal where recruiters post jobs and job seekers search and apply.\n\n' +
      '**Authentication:** call `POST /api/auth/login` (or register), copy the `token`, click **Authorize** and paste it. ' +
      'Demo accounts (after `npm run seed`): `demo.recruiter@example.com` / `Demo1234` and `demo.seeker@example.com` / `Demo1234`.',
  },
  tags: [
    { name: 'Health', description: 'Service status' },
    { name: 'Auth', description: 'Register, log in and get the current user' },
    { name: 'Jobs', description: 'Browse, search and manage job posts' },
    { name: 'Applications', description: 'Apply to jobs, track applications and review applicants' },
    { name: 'Users', description: "The logged-in user's profile and profile resume" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },

    schemas: {
      ObjectId: { type: 'string', pattern: '^[a-f0-9]{24}$', example: '6650f1c2a1b2c3d4e5f60718' },

      User: {
        type: 'object',
        properties: {
          _id: ref('ObjectId'),
          name: { type: 'string', example: 'Asha Tan' },
          email: { type: 'string', format: 'email', example: 'asha@example.com' },
          role: { type: 'string', enum: Object.values(ROLES) },
          headline: { type: 'string', example: 'Frontend developer' },
          skills: { type: 'array', items: { type: 'string' }, example: ['React', 'CSS'] },
          location: { type: 'string', example: 'Singapore' },
          resume: {
            type: 'object',
            description: 'Profile resume (job seekers only); absent until uploaded',
            properties: {
              filename: { type: 'string', example: 'Asha Tan - Resume.pdf' },
              size: { type: 'integer', description: 'Bytes', example: 84213 },
              uploadedAt: { type: 'string', format: 'date-time' },
            },
          },
          resumeUrl: {
            type: 'string',
            nullable: true,
            description: 'Download path for your own profile resume, or null',
            example: '/api/users/me/resume',
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      RegisterInput: {
        type: 'object',
        required: ['name', 'email', 'password', 'role'],
        properties: {
          name: { type: 'string', maxLength: 100, example: 'Asha Tan' },
          email: { type: 'string', format: 'email', example: 'asha@example.com' },
          password: {
            type: 'string',
            minLength: 8,
            maxLength: 72,
            description: 'At least 8 characters, including a letter and a number',
            example: 'secret123',
          },
          role: { type: 'string', enum: Object.values(ROLES), example: ROLES.JOB_SEEKER },
        },
      },

      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'demo.recruiter@example.com' },
          password: { type: 'string', example: 'Demo1234' },
        },
      },

      AuthResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'JWT; send as `Authorization: Bearer <token>`' },
          user: ref('User'),
        },
      },

      SalaryRange: {
        type: 'object',
        description: 'Monthly salary range. If given, both min and max are required.',
        required: ['min', 'max'],
        properties: {
          min: { type: 'integer', minimum: 0, example: 5000 },
          max: { type: 'integer', minimum: 0, description: 'Must be ≥ min', example: 7000 },
          currency: { type: 'string', description: 'ISO 4217 code', default: 'SGD', example: 'SGD' },
        },
      },

      JobInput: {
        type: 'object',
        required: ['title', 'description', 'company', 'location', 'jobType'],
        properties: {
          title: { type: 'string', maxLength: 120, example: 'Frontend Developer (React)' },
          description: {
            type: 'string',
            minLength: 30,
            maxLength: 5000,
            example:
              'Build fast, accessible web apps for retail clients with React and work closely with designers.',
          },
          company: { type: 'string', maxLength: 100, example: 'Marina Bay Digital' },
          location: { type: 'string', maxLength: 100, example: 'Singapore (Hybrid)' },
          jobType: { type: 'string', enum: Object.values(JOB_TYPES), example: JOB_TYPES.FULL_TIME },
          skills: {
            type: 'array',
            maxItems: 20,
            items: { type: 'string', maxLength: 40 },
            description: 'Duplicates (ignoring case) are removed',
            example: ['React', 'JavaScript', 'CSS'],
          },
          salaryRange: ref('SalaryRange'),
        },
      },

      Job: {
        allOf: [
          ref('JobInput'),
          {
            type: 'object',
            properties: {
              _id: ref('ObjectId'),
              postedBy: {
                type: 'object',
                description: 'The recruiter who posted the job (only public fields)',
                properties: { _id: ref('ObjectId'), name: { type: 'string', example: 'Rachel Lim' } },
              },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },

      ApplicationStatus: {
        type: 'string',
        enum: Object.values(APPLICATION_STATUSES),
        example: APPLICATION_STATUSES.APPLIED,
      },

      ApplicationCounts: {
        type: 'object',
        description: 'Number of applications in total and per status',
        properties: {
          total: { type: 'integer', example: 3 },
          applied: { type: 'integer', example: 1 },
          shortlisted: { type: 'integer', example: 1 },
          rejected: { type: 'integer', example: 1 },
        },
      },

      Application: {
        type: 'object',
        properties: {
          _id: ref('ObjectId'),
          job: {
            description: 'Job id, or a job summary when populated',
            oneOf: [
              ref('ObjectId'),
              {
                type: 'object',
                properties: {
                  _id: ref('ObjectId'),
                  title: { type: 'string' },
                  company: { type: 'string' },
                  location: { type: 'string' },
                  jobType: { type: 'string', enum: Object.values(JOB_TYPES) },
                  salaryRange: ref('SalaryRange'),
                },
              },
            ],
          },
          applicant: {
            description: 'User id, or (for recruiters) the applicant\'s public profile and email',
            oneOf: [
              ref('ObjectId'),
              {
                type: 'object',
                properties: {
                  _id: ref('ObjectId'),
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  headline: { type: 'string' },
                  skills: { type: 'array', items: { type: 'string' } },
                  location: { type: 'string' },
                },
              },
            ],
          },
          resume: {
            type: 'object',
            properties: {
              filename: { type: 'string', example: 'Daniel Ong - Resume.pdf' },
              size: { type: 'integer', description: 'Bytes', example: 84213 },
            },
          },
          resumeUrl: {
            type: 'string',
            description: 'Download path (requires the applicant or the job\'s recruiter to be logged in)',
            example: '/api/applications/6650f1c2a1b2c3d4e5f60718/resume',
          },
          coverNote: { type: 'string', example: 'I have three years of React experience...' },
          status: ref('ApplicationStatus'),
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 10 },
          total: { type: 'integer', description: 'Total matching jobs', example: 12 },
          totalPages: { type: 'integer', example: 2 },
        },
      },

      Error: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Job not found' },
        },
      },

      ValidationError: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Validation failed' },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'title' },
                message: { type: 'string', example: 'Title is required' },
              },
            },
          },
        },
      },
    },

    parameters: {
      JobId: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Job id',
        schema: ref('ObjectId'),
      },
    },

    responses: {
      BadRequest: { description: 'Validation failed', content: jsonContent(ref('ValidationError')) },
      Unauthorized: {
        description: 'Missing, invalid or expired token',
        content: jsonContent(ref('Error'), { message: 'Authentication required' }),
      },
      Forbidden: {
        description: 'Logged in, but not allowed (wrong role or not the owner)',
        content: jsonContent(ref('Error'), { message: 'You can only manage jobs you posted' }),
      },
      NotFound: {
        description: 'Not found',
        content: jsonContent(ref('Error'), { message: 'Job not found' }),
      },
      PayloadTooLarge: {
        description: `Resume larger than ${MAX_RESUME_SIZE_MB} MB`,
        content: jsonContent(ref('ValidationError')),
      },
      TooManyRequests: {
        description:
          'Rate limit exceeded (per IP per 15 minutes: 20 requests in production, 100 in development)',
        content: jsonContent(ref('Error'), {
          message: 'Too many attempts. Please try again in a few minutes.',
        }),
      },
    },
  },

  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'The API is running',
            content: jsonContent({ type: 'object', properties: { status: { type: 'string', example: 'ok' } } }),
          },
        },
      },
    },

    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account',
        requestBody: { required: true, content: jsonContent(ref('RegisterInput')) },
        responses: {
          201: { description: 'Account created and logged in', content: jsonContent(ref('AuthResponse')) },
          400: response('BadRequest'),
          409: {
            description: 'Email already registered',
            content: jsonContent(ref('Error'), { message: 'An account with this email already exists' }),
          },
          429: response('TooManyRequests'),
        },
      },
    },

    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in',
        requestBody: { required: true, content: jsonContent(ref('LoginInput')) },
        responses: {
          200: { description: 'Logged in', content: jsonContent(ref('AuthResponse')) },
          400: response('BadRequest'),
          401: {
            description: 'Wrong email or password',
            content: jsonContent(ref('Error'), { message: 'Invalid email or password' }),
          },
          429: response('TooManyRequests'),
        },
      },
    },

    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the logged-in user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'The current user',
            content: jsonContent({ type: 'object', properties: { user: ref('User') } }),
          },
          401: response('Unauthorized'),
        },
      },
    },

    '/api/jobs': {
      get: {
        tags: ['Jobs'],
        summary: 'List and search jobs',
        description:
          'Public. Newest first, or by relevance when `keyword` is given. All filters are optional and can be combined.',
        parameters: [
          {
            name: 'keyword',
            in: 'query',
            description: 'Full-text search over title, skills, company and description (whole words)',
            schema: { type: 'string', maxLength: 100 },
            example: 'react',
          },
          {
            name: 'location',
            in: 'query',
            description: 'Case-insensitive partial match on location',
            schema: { type: 'string', maxLength: 100 },
            example: 'singapore',
          },
          { name: 'jobType', in: 'query', schema: { type: 'string', enum: Object.values(JOB_TYPES) } },
          {
            name: 'postedBy',
            in: 'query',
            description: "Only jobs posted by this user id (e.g. a recruiter's own jobs)",
            schema: ref('ObjectId'),
          },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'limit',
            in: 'query',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: PAGINATION.MAX_LIMIT,
              default: PAGINATION.DEFAULT_LIMIT,
            },
          },
        ],
        responses: {
          200: {
            description: 'A page of jobs',
            content: jsonContent({
              type: 'object',
              properties: { jobs: { type: 'array', items: ref('Job') }, pagination: ref('Pagination') },
            }),
          },
          400: response('BadRequest'),
        },
      },
      post: {
        tags: ['Jobs'],
        summary: 'Post a job (recruiters only)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: jsonContent(ref('JobInput')) },
        responses: {
          201: {
            description: 'Job created',
            content: jsonContent({ type: 'object', properties: { job: ref('Job') } }),
          },
          400: response('BadRequest'),
          401: response('Unauthorized'),
          403: response('Forbidden'),
        },
      },
    },

    '/api/jobs/{id}': {
      parameters: [{ $ref: '#/components/parameters/JobId' }],
      get: {
        tags: ['Jobs'],
        summary: 'Get one job',
        responses: {
          200: {
            description: 'The job',
            content: jsonContent({ type: 'object', properties: { job: ref('Job') } }),
          },
          400: response('BadRequest'),
          404: response('NotFound'),
        },
      },
      put: {
        tags: ['Jobs'],
        summary: 'Replace a job (owner only)',
        description:
          'Full update: send every field. Optional fields that are left out (skills, salaryRange) are cleared.',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: jsonContent(ref('JobInput')) },
        responses: {
          200: {
            description: 'Job updated',
            content: jsonContent({ type: 'object', properties: { job: ref('Job') } }),
          },
          400: response('BadRequest'),
          401: response('Unauthorized'),
          403: response('Forbidden'),
          404: response('NotFound'),
        },
      },
      delete: {
        tags: ['Jobs'],
        summary: 'Delete a job (owner only)',
        description: "Also deletes the job's applications and their resume files.",
        security: [{ bearerAuth: [] }],
        responses: {
          204: { description: 'Job deleted' },
          400: response('BadRequest'),
          401: response('Unauthorized'),
          403: response('Forbidden'),
          404: response('NotFound'),
        },
      },
    },

    '/api/jobs/mine': {
      get: {
        tags: ['Jobs'],
        summary: "The logged-in recruiter's jobs, with applicant counts",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: PAGINATION.MAX_LIMIT, default: PAGINATION.DEFAULT_LIMIT },
          },
        ],
        responses: {
          200: {
            description: 'A page of jobs, newest first',
            content: jsonContent({
              type: 'object',
              properties: {
                jobs: {
                  type: 'array',
                  items: {
                    allOf: [
                      ref('JobInput'),
                      {
                        type: 'object',
                        properties: {
                          _id: ref('ObjectId'),
                          postedBy: ref('ObjectId'),
                          applicationCounts: ref('ApplicationCounts'),
                          createdAt: { type: 'string', format: 'date-time' },
                          updatedAt: { type: 'string', format: 'date-time' },
                        },
                      },
                    ],
                  },
                },
                pagination: ref('Pagination'),
              },
            }),
          },
          400: response('BadRequest'),
          401: response('Unauthorized'),
          403: response('Forbidden'),
        },
      },
    },

    '/api/jobs/{id}/apply': {
      parameters: [{ $ref: '#/components/parameters/JobId' }],
      post: {
        tags: ['Applications'],
        summary: 'Apply to a job (job seekers only)',
        description:
          `Send as \`multipart/form-data\`. Either upload \`resume\` (a PDF of at most ${MAX_RESUME_SIZE_MB} MB, ` +
          'checked by type, extension and file content) or set `useProfileResume=true` to send a copy of the ' +
          'resume saved on your profile. One application per job.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  resume: { type: 'string', format: 'binary', description: 'PDF file (takes priority if both are sent)' },
                  useProfileResume: {
                    type: 'boolean',
                    description: 'Send a copy of your profile resume instead of uploading a file',
                  },
                  coverNote: { type: 'string', maxLength: 2000 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Application submitted',
            content: jsonContent({ type: 'object', properties: { application: ref('Application') } }),
          },
          400: response('BadRequest'),
          401: response('Unauthorized'),
          403: response('Forbidden'),
          404: response('NotFound'),
          409: {
            description: 'Already applied',
            content: jsonContent(ref('Error'), { message: 'You have already applied to this job' }),
          },
          413: response('PayloadTooLarge'),
        },
      },
    },

    '/api/jobs/{id}/applications': {
      parameters: [{ $ref: '#/components/parameters/JobId' }],
      get: {
        tags: ['Applications'],
        summary: "List a job's applicants (the job's recruiter only)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Applicants, newest first',
            content: jsonContent({
              type: 'object',
              properties: {
                job: {
                  type: 'object',
                  properties: {
                    _id: ref('ObjectId'),
                    title: { type: 'string' },
                    company: { type: 'string' },
                    location: { type: 'string' },
                  },
                },
                applications: { type: 'array', items: ref('Application') },
                counts: ref('ApplicationCounts'),
              },
            }),
          },
          400: response('BadRequest'),
          401: response('Unauthorized'),
          403: response('Forbidden'),
          404: response('NotFound'),
        },
      },
    },

    '/api/applications/me': {
      get: {
        tags: ['Applications'],
        summary: "The logged-in job seeker's applications",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'job',
            in: 'query',
            description: 'Only the application to this job (to check whether you already applied)',
            schema: ref('ObjectId'),
          },
        ],
        responses: {
          200: {
            description: 'Applications, newest first',
            content: jsonContent({
              type: 'object',
              properties: {
                applications: { type: 'array', items: ref('Application') },
                counts: ref('ApplicationCounts'),
              },
            }),
          },
          400: response('BadRequest'),
          401: response('Unauthorized'),
          403: response('Forbidden'),
        },
      },
    },

    '/api/applications/{id}/status': {
      parameters: [
        { name: 'id', in: 'path', required: true, description: 'Application id', schema: ref('ObjectId') },
      ],
      patch: {
        tags: ['Applications'],
        summary: "Update an application's status (the job's recruiter only)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent(
            { type: 'object', required: ['status'], properties: { status: ref('ApplicationStatus') } },
            { status: APPLICATION_STATUSES.SHORTLISTED }
          ),
        },
        responses: {
          200: {
            description: 'Status updated',
            content: jsonContent({ type: 'object', properties: { application: ref('Application') } }),
          },
          400: response('BadRequest'),
          401: response('Unauthorized'),
          403: response('Forbidden'),
          404: response('NotFound'),
        },
      },
    },

    '/api/applications/{id}/resume': {
      parameters: [
        { name: 'id', in: 'path', required: true, description: 'Application id', schema: ref('ObjectId') },
      ],
      get: {
        tags: ['Applications'],
        summary: 'Download the resume submitted with an application',
        description: "Only the applicant and the job's recruiter can download it.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'The PDF file',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
          400: response('BadRequest'),
          401: response('Unauthorized'),
          403: response('Forbidden'),
          404: response('NotFound'),
        },
      },
    },
    '/api/users/me': {
      put: {
        tags: ['Users'],
        summary: 'Update your profile',
        description:
          'Replaces the editable profile fields; optional fields that are left out are cleared. Email, password and role cannot be changed here.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent(
            {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', maxLength: 100 },
                headline: { type: 'string', maxLength: 150 },
                location: { type: 'string', maxLength: 100 },
                skills: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 40 } },
              },
            },
            {
              name: 'Asha Tan',
              headline: 'Frontend developer',
              location: 'Singapore',
              skills: ['React', 'TypeScript'],
            }
          ),
        },
        responses: {
          200: { description: 'Profile updated', content: jsonContent({ type: 'object', properties: { user: ref('User') } }) },
          400: response('BadRequest'),
          401: response('Unauthorized'),
        },
      },
    },

    '/api/users/me/resume': {
      post: {
        tags: ['Users'],
        summary: 'Upload or replace your profile resume (job seekers only)',
        description: `\`multipart/form-data\` with a \`resume\` PDF of at most ${MAX_RESUME_SIZE_MB} MB.`,
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['resume'],
                properties: { resume: { type: 'string', format: 'binary', description: 'PDF file' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Resume saved', content: jsonContent({ type: 'object', properties: { user: ref('User') } }) },
          400: response('BadRequest'),
          401: response('Unauthorized'),
          403: response('Forbidden'),
          413: response('PayloadTooLarge'),
        },
      },
      get: {
        tags: ['Users'],
        summary: 'Download your profile resume (job seekers only)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'The PDF file', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
          401: response('Unauthorized'),
          403: response('Forbidden'),
          404: response('NotFound'),
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Remove your profile resume (job seekers only)',
        description: 'Resumes already sent with applications are separate copies and are not affected.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Resume removed', content: jsonContent({ type: 'object', properties: { user: ref('User') } }) },
          401: response('Unauthorized'),
          403: response('Forbidden'),
          404: response('NotFound'),
        },
      },
    },
  },
};

module.exports = openapi;
