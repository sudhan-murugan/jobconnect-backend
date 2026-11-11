# JobConnect API

REST API for **JobConnect**, a job portal where recruiters post jobs and job seekers search and apply.

> **Status:** Phase 3 (jobs). Authentication with role-based access, plus job posting, search, filters, pagination and Swagger docs; features are added phase by phase (see [Roadmap](#roadmap)).

Frontend repo: [jobconnect-frontend](https://github.com/sudhan-murugan/jobconnect-frontend)

## Tech stack

- **Runtime:** Node.js 22+
- **Framework:** Express 5
- **Database:** MongoDB with Mongoose (text index for keyword search)
- **Auth:** JWT (jsonwebtoken), bcrypt password hashing, role-based access control
- **Validation:** express-validator
- **API docs:** OpenAPI 3 + Swagger UI
- **Security:** Helmet (HTTP headers), CORS allow-list, rate limiting on login/register
- **Planned:** Multer uploads, Jest + Supertest, Docker

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
npm run seed           # optional: demo accounts + 12 sample jobs
npm run dev            # starts on http://localhost:5000 and restarts on file changes
```

Then open the interactive API docs at **http://localhost:5000/api/docs**.

### Scripts

| Script         | What it does                                          |
| -------------- | ----------------------------------------------------- |
| `npm run dev`  | Start with auto-restart on changes (`node --watch`)   |
| `npm start`    | Start for production                                  |
| `npm run seed` | Create demo accounts and sample jobs (safe to re-run) |

### Demo accounts

`npm run seed` creates these accounts (password `Demo1234`) and 12 sample jobs at fictional companies. Re-running it resets only this demo data.

| Role       | Email                        |
| ---------- | ---------------------------- |
| Recruiter  | `demo.recruiter@example.com` |
| Job seeker | `demo.seeker@example.com`    |

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
| PUT    | `/api/jobs/:id`      | Recruiter, owner | Replace a job (full update)                        |
| DELETE | `/api/jobs/:id`      | Recruiter, owner | Delete a job                                       |

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
| 409    | Conflict, e.g. email already registered                          |
| 429    | Too many login/register attempts (20 per 15 minutes per IP)      |

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

## Project structure

```
src/
  config/       env.js (config from .env), db.js (MongoDB connection)
  controllers/  request handlers (auth, jobs)
  docs/         openapi.js: the OpenAPI spec served by Swagger UI
  middleware/   auth.js (JWT), role.js (RBAC), validate.js, rateLimit.js, upload.js, error.js
  models/       Mongoose schemas (User, Job)
  routes/       Express routers, mounted in app.js
  utils/        shared helpers (ApiError, JWT helpers, constants, escapeRegex)
  validators/   express-validator rules for request bodies, params and queries
  app.js        builds the Express app (no network port; easy to test)
  server.js     connects to MongoDB, then starts listening
scripts/
  seed.js       demo data
tests/          Jest + Supertest tests
```

## Roadmap

1. ✅ Scaffold: Express app, MongoDB connection, health check
2. ✅ Authentication: register/login, JWT, role-based access
3. ✅ Jobs: CRUD, search, filters, pagination, Swagger
4. Jobs frontend
5. Applications: apply with resume, recruiter review
6. Profile and UI polish
7. Testing
8. Deployment: Docker, Render, MongoDB Atlas
9. Documentation
