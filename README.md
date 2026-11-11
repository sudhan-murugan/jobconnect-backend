# JobConnect API

[![CI](https://github.com/sudhan-murugan/jobconnect-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/sudhan-murugan/jobconnect-backend/actions/workflows/ci.yml)

REST API for **JobConnect**, a job portal where recruiters post jobs and job seekers search and apply.

> **Status:** Phase 7 (testing). Authentication with role-based access, job posting and search, applications with PDF resumes, recruiter applicant review and user profiles, documented in Swagger and covered by 108 automated tests; features are added phase by phase (see [Roadmap](#roadmap)).

Frontend repo: [jobconnect-frontend](https://github.com/sudhan-murugan/jobconnect-frontend)

## Tech stack

- **Runtime:** Node.js 22+
- **Framework:** Express 5
- **Database:** MongoDB with Mongoose (text index for keyword search)
- **Auth:** JWT (jsonwebtoken), bcrypt password hashing, role-based access control
- **Validation:** express-validator
- **File uploads:** Multer (PDF resumes), stored in MongoDB GridFS
- **API docs:** OpenAPI 3 + Swagger UI
- **Security:** Helmet (HTTP headers), CORS allow-list, rate limiting on login/register
- **Testing:** Jest + Supertest, with an in-memory MongoDB (mongodb-memory-server); GitHub Actions CI
- **Planned:** Docker

## Getting started

### Prerequisites

- Node.js 22 or newer
- MongoDB running locally, or a MongoDB Atlas connection string

### Setup

```bash
git clone https://github.com/sudhan-murugan/jobconnect-backend.git
cd jobconnect-backend
npm install
cp .env.example .env   # then set JWT_SECRET (see below)
npm run seed           # optional: demo accounts, sample jobs and applications
npm run dev            # starts on http://localhost:5000 and restarts on file changes
```

Then open the interactive API docs at **http://localhost:5000/api/docs**.

### Scripts

| Script         | What it does                                          |
| -------------- | ----------------------------------------------------- |
| `npm run dev`  | Start with auto-restart on changes (`node --watch`)   |
| `npm start`    | Start for production                                  |
| `npm run seed` | Create demo accounts, jobs and applications (safe to re-run) |
| `npm test`     | Run the test suite (no database setup needed)         |
| `npm run test:coverage` | Tests plus a coverage report (fails below the thresholds) |
| `npm run test:watch` | Re-run tests on file changes                    |

### Demo accounts

`npm run seed` creates these accounts (password `Demo1234`), 12 sample jobs at fictional companies, and 7 applications with generated PDF resumes in different statuses. The first two job seekers also have a resume saved on their profile; the third has none, to try the upload flow. Re-running it resets only this demo data.

| Role       | Email                        |
| ---------- | ---------------------------- |
| Recruiter  | `demo.recruiter@example.com` |
| Job seeker | `demo.seeker@example.com`    |
| Job seeker | `demo.seeker2@example.com`   |
| Job seeker | `demo.seeker3@example.com`   |

## Environment variables

| Variable             | Required | Default                 | Description                                               |
| -------------------- | -------- | ----------------------- | --------------------------------------------------------- |
| `NODE_ENV`           | no       | `development`           | `development`, `production` or `test`                     |
| `PORT`               | no       | `5000`                  | Port the API listens on                                   |
| `MONGODB_URI`        | **yes**  | none                    | MongoDB connection string                                 |
| `CORS_ORIGIN`        | no       | `http://localhost:5173` | Allowed frontend origin(s), comma-separated               |
| `JWT_SECRET`         | **yes**  | none                    | Secret for signing login tokens (32+ chars in production) |
| `JWT_EXPIRES_IN`     | no       | `1d`                    | Token lifetime, e.g. `15m`, `1d`, `7d`                    |
| `BCRYPT_SALT_ROUNDS` | no       | `12`                    | bcrypt cost factor for password hashing                   |

The server refuses to start if a required variable is missing. Generate a JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## API

Full, interactive documentation: **`GET /api/docs`** (Swagger UI). Raw OpenAPI spec: `GET /api/docs.json`.

| Method | Path                 | Access          | Description                                         |
| ------ | -------------------- | --------------- | --------------------------------------------------- |
| GET    | `/health`            | Public          | Health check                                        |
| POST   | `/api/auth/register` | Public          | Create an account (`job_seeker` or `recruiter`)     |
| POST   | `/api/auth/login`    | Public          | Log in, returns `{ token, user }`                   |
| GET    | `/api/auth/me`       | Logged in       | The current user                                    |
| GET    | `/api/jobs`          | Public          | List and search jobs (see query parameters below)   |
| GET    | `/api/jobs/:id`      | Public          | One job                                             |
| POST   | `/api/jobs`          | Recruiter       | Post a job                                          |
| GET    | `/api/jobs/mine`     | Recruiter       | Your own jobs, with applicant counts per status     |
| PUT    | `/api/jobs/:id`      | Recruiter, owner | Replace a job (full update)                        |
| DELETE | `/api/jobs/:id`      | Recruiter, owner | Delete a job and its applications                  |
| POST   | `/api/jobs/:id/apply` | Job seeker     | Apply: `multipart/form-data` with `resume` (PDF, max 5 MB) or `useProfileResume=true`, plus optional `coverNote` |
| GET    | `/api/jobs/:id/applications` | Recruiter, owner | The job's applicants, with counts per status |
| GET    | `/api/applications/me` | Job seeker    | Your applications (`?job=<id>` to check one job)    |
| PATCH  | `/api/applications/:id/status` | Recruiter, job owner | Set status: `applied`, `shortlisted` or `rejected` |
| GET    | `/api/applications/:id/resume` | Applicant or job owner | Download the submitted resume (PDF) |
| PUT    | `/api/users/me`      | Logged in       | Update your profile: `name`, `headline`, `location`, `skills` |
| POST   | `/api/users/me/resume` | Job seeker    | Upload or replace your profile resume (PDF, max 5 MB) |
| GET    | `/api/users/me/resume` | Job seeker    | Download your profile resume                        |
| DELETE | `/api/users/me/resume` | Job seeker    | Remove your profile resume                          |

**Authentication:** send the token from register/login in the header `Authorization: Bearer <token>`.

### Searching jobs

`GET /api/jobs` returns `{ jobs, pagination: { page, limit, total, totalPages } }`. All query parameters are optional and can be combined:

| Parameter  | Example         | Behaviour                                                                  |
| ---------- | --------------- | -------------------------------------------------------------------------- |
| `keyword`  | `react`         | Full-text search over title, skills, company and description; results sorted by relevance |
| `location` | `singapore`     | Case-insensitive partial match                                             |
| `jobType`  | `remote`        | `full-time`, `part-time` or `remote`                                       |
| `postedBy` | a user id       | Only jobs posted by that recruiter                                         |
| `page`     | `2`             | Page number (default 1)                                                    |
| `limit`    | `20`            | Jobs per page (default 10, max 50)                                         |

```bash
curl "http://localhost:5000/api/jobs?keyword=react&location=singapore&jobType=full-time&page=1"
```

Without a keyword, jobs are sorted newest first.

### Errors

Errors are returned as JSON: `{ "message": "...", "details": [{ "field", "message" }] }` (`details` only for validation errors).

| Status | Meaning                                                          |
| ------ | ---------------------------------------------------------------- |
| 400    | Validation failed (see `details`), or an invalid id              |
| 401    | Not logged in, or token invalid/expired, or wrong email/password |
| 403    | Logged in, but not allowed: wrong role, or not the job's owner   |
| 404    | Route or resource not found                                      |
| 409    | Conflict, e.g. email already registered or already applied       |
| 413    | Resume file larger than 5 MB                                     |
| 429    | Too many login/register attempts (per IP per 15 minutes: 20 in production, 100 in development) |

## How it works

### Auth

1. On register, the password is hashed with bcrypt (salted, cost 12) and only the hash is stored.
2. Register and login return a signed JWT whose `sub` claim is the user's id.
3. The `authenticate` middleware verifies the token on protected routes, loads the user from MongoDB and sets `req.user`.
4. The `authorize(...roles)` middleware then returns 403 if `req.user.role` isn't allowed.
5. For edit/delete, the controller also checks that the job's `postedBy` matches the logged-in user (403 otherwise).
6. Request data passes through express-validator; only validated fields reach controllers, so clients can't set fields like `passwordHash` or `postedBy` (mass assignment).

### Search

- **Keyword** uses a MongoDB text index with weights (title 10, skills 5, company 3, description 1), so a match in the title ranks above one in the description. Text search matches whole words with stemming ("developers" finds "developer").
- **Location** is a case-insensitive "contains" match; user input is escaped before being used in the regular expression.
- Extra indexes on `createdAt`, `jobType` and `postedBy` keep the default "newest first" listing and filters fast.

### Applications and resume files

- **One application per job seeker per job**, enforced by a unique compound index on `{ job, applicant }`. Even two simultaneous requests can't create a duplicate; the second gets 409.
- **Uploads are checked three times:** Multer accepts only one file, at most 5 MB, named `*.pdf` with type `application/pdf`; then the file's first bytes must be the PDF signature `%PDF-`, so a renamed text file is rejected.
- **Storage:** resumes are stored in MongoDB **GridFS** (`src/services/fileStorage.js`), not on the server's disk. Files survive restarts and redeploys (hosting platforms like Render wipe the local disk on every deploy), and no extra cloud account is needed. Swapping in S3 or Cloudinary would only change that one file.
- **Private by default:** there are no public file URLs. `GET /api/applications/:id/resume` streams the PDF only to the applicant or the job's recruiter, with `Cache-Control: private, no-store`.
- **No orphaned data:** a file is stored only after every check passes and is removed again if saving the application fails. Deleting a job also deletes its applications and their files.
- Each application keeps **its own copy** of the resume as submitted, so later changes never alter what a recruiter received.

### Profiles

- `PUT /api/users/me` replaces the editable fields (name, headline, location, skills). Email, password and role can't be changed there; any extra fields in the body are ignored.
- Job seekers can save **one resume on their profile** (`POST /api/users/me/resume`). Uploading again replaces it; the old file is deleted only after the new one is saved.
- When applying, `useProfileResume=true` **copies** the profile resume into the application, so applying is one click and later profile changes don't affect sent applications.
- `GET /api/auth/me` and the users endpoints return `resume: { filename, size, uploadedAt }` and `resumeUrl` for downloading it; the internal storage id is never exposed.

## Testing

```bash
npm test                # 108 tests, about 10 seconds
npm run test:coverage   # plus a coverage report
```

- **Integration tests** (`tests/*.test.js`) call the real Express app through Supertest: routing, middleware, validation, controllers and MongoDB, just like a client would. They cover auth, job CRUD with ownership rules, search/filters/pagination, the whole apply flow (uploads, duplicates, concurrent requests, status changes, resume downloads, no leftover files), and profiles.
- **Unit tests** (`tests/unit/`) cover helpers, the role middleware, the error handler and config validation in isolation.
- **Isolated database:** `mongodb-memory-server` starts a throwaway MongoDB for the test run (the binary is downloaded once, then cached). Each Jest worker gets its own database and every test starts empty, so tests can't affect each other or any real data. No `.env` file or local MongoDB is needed.
- **Fast:** tests use bcrypt cost 4 instead of 12, and rate limiting is off in the test environment.
- **Coverage:** about 98% of statements and 90% of branches in `src/`. `test:coverage` fails if coverage drops below 90% (statements, lines, functions) or 80% (branches).
- **CI:** GitHub Actions runs `npm run test:coverage` on every push and pull request (`.github/workflows/ci.yml`).

The test script runs Jest with `node --experimental-vm-modules`. The MongoDB driver loads Node's `os` module with a dynamic `import()`, which Jest only supports with that flag; without it, the driver can't connect inside tests.

## Project structure

```
src/
  config/       env.js (config from .env), db.js (MongoDB connection)
  controllers/  request handlers (auth, jobs, applications, users)
  docs/         openapi.js: the OpenAPI spec served by Swagger UI
  middleware/   auth.js (JWT), role.js (RBAC), validate.js, rateLimit.js, upload.js, error.js
  models/       Mongoose schemas (User, Job, Application)
  routes/       Express routers, mounted in app.js
  services/     fileStorage.js: save/read/delete files in GridFS
  utils/        shared helpers (ApiError, JWT helpers, constants, escapeRegex, filename, sendPdf)
  validators/   express-validator rules for request bodies, params and queries (common.js: shared rules)
  app.js        builds the Express app (no network port; easy to test)
  server.js     connects to MongoDB, then starts listening
scripts/
  seed.js       demo data
  samplePdf.js  builds small PDF resumes for the demo data
tests/
  *.test.js     API integration tests (Supertest)
  unit/         unit tests
  setup/        in-memory MongoDB and per-test cleanup
  helpers.js    factories for users, jobs and PDF files
```

## Roadmap

1. ✅ Scaffold: Express app, MongoDB connection, health check
2. ✅ Authentication: register/login, JWT, role-based access
3. ✅ Jobs: CRUD, search, filters, pagination, Swagger
4. ✅ Jobs frontend (in the frontend repo)
5. ✅ Applications: apply with resume, recruiter review
6. ✅ Profile and UI polish
7. ✅ Testing: Jest + Supertest, in-memory MongoDB, CI
8. Deployment: Docker, Render, MongoDB Atlas
9. Documentation
