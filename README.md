# JobConnect API

REST API for **JobConnect**, a job portal where recruiters post jobs and job seekers search and apply.

> **Status:** Phase 2 (authentication). Register, login and JWT-protected routes with role-based access work; features are added phase by phase (see [Roadmap](#roadmap)).

Frontend repo: [jobconnect-frontend](https://github.com/sudhan-murugan/jobconnect-frontend)

## Tech stack

- **Runtime:** Node.js 22+
- **Framework:** Express 5
- **Database:** MongoDB with Mongoose
- **Auth:** JWT (jsonwebtoken), bcrypt password hashing, role-based access control
- **Validation:** express-validator
- **Security:** Helmet (HTTP headers), CORS allow-list, rate limiting on login/register
- **Planned:** Multer uploads, Swagger docs, Jest + Supertest, Docker

## Getting started

### Prerequisites

- Node.js 22 or newer
- MongoDB running locally, or a MongoDB Atlas connection string

### Setup

```bash
git clone https://github.com/sudhan-murugan/jobconnect-backend.git
cd jobconnect-backend
npm install
cp .env.example .env   # then edit values if needed
npm run dev            # starts on http://localhost:5000 and restarts on file changes
```

Check it's running:

```bash
curl http://localhost:5000/health
# {"status":"ok"}
```

### Scripts

| Script        | What it does                                      |
| ------------- | ------------------------------------------------- |
| `npm run dev` | Start with auto-restart on changes (`node --watch`) |
| `npm start`   | Start for production                              |

## Environment variables

| Variable      | Required | Default                 | Description                                         |
| ------------- | -------- | ----------------------- | --------------------------------------------------- |
| `NODE_ENV`    | no       | `development`           | `development`, `production` or `test`               |
| `PORT`        | no       | `5000`                  | Port the API listens on                             |
| `MONGODB_URI` | **yes**  | none                    | MongoDB connection string                           |
| `CORS_ORIGIN` | no       | `http://localhost:5173` | Allowed frontend origin(s), comma-separated         |
| `JWT_SECRET`  | **yes**  | none                    | Secret for signing login tokens (32+ chars in production) |
| `JWT_EXPIRES_IN` | no    | `1d`                    | Token lifetime, e.g. `15m`, `1d`, `7d`              |
| `BCRYPT_SALT_ROUNDS` | no | `12`                   | bcrypt cost factor for password hashing             |

The server refuses to start if a required variable is missing. Generate a JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## API

| Method | Path                 | Access     | Description                                        |
| ------ | -------------------- | ---------- | -------------------------------------------------- |
| GET    | `/health`            | Public     | Health check                                       |
| POST   | `/api/auth/register` | Public     | Create an account. Body: `name`, `email`, `password`, `role` (`job_seeker` or `recruiter`). Returns `{ token, user }` |
| POST   | `/api/auth/login`    | Public     | Log in. Body: `email`, `password`. Returns `{ token, user }` |
| GET    | `/api/auth/me`       | Logged in  | The current user. Returns `{ user }`               |

**Authentication:** send the token from register/login in the header `Authorization: Bearer <token>`.

**Errors** are returned as JSON: `{ "message": "...", "details": [{ "field", "message" }] }` (`details` only for validation errors).

| Status | Meaning                                                          |
| ------ | ---------------------------------------------------------------- |
| 400    | Validation failed (see `details`)                                |
| 401    | Not logged in, or token invalid/expired, or wrong email/password |
| 403    | Logged in, but your role isn't allowed to do this                |
| 404    | Route or resource not found                                      |
| 409    | Conflict, e.g. email already registered                          |
| 429    | Too many login/register attempts (20 per 15 minutes per IP)      |

### Try it with curl

```bash
# Register (returns a token)
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Asha Tan","email":"asha@example.com","password":"secret123","role":"job_seeker"}'

# Use the token
curl http://localhost:5000/api/auth/me -H "Authorization: Bearer <token>"
```

### How auth works

1. On register, the password is hashed with bcrypt (salted, cost 12) and only the hash is stored.
2. Register and login return a signed JWT whose `sub` claim is the user's id.
3. The `authenticate` middleware verifies the token on protected routes, loads the user from MongoDB and sets `req.user`.
4. The `authorize(...roles)` middleware then returns 403 if `req.user.role` isn't allowed.
5. Request bodies pass through express-validator; only validated fields reach controllers, so clients can't set fields like `passwordHash` (mass assignment).

## Project structure

```
src/
  config/       env.js (config from .env), db.js (MongoDB connection)
  controllers/  request handlers (one file per resource)
  middleware/   auth.js (JWT), role.js (RBAC), validate.js, rateLimit.js, upload.js, error.js
  models/       Mongoose schemas
  routes/       Express routers, mounted in app.js
  utils/        shared helpers (ApiError, JWT token helpers, constants)
  validators/   express-validator rules for request bodies
  app.js        builds the Express app (no network port; easy to test)
  server.js     connects to MongoDB, then starts listening
tests/          Jest + Supertest tests
```

## Roadmap

1. ✅ Scaffold: Express app, MongoDB connection, health check
2. ✅ Authentication: register/login, JWT, role-based access
3. Jobs: CRUD, search, filters, pagination, Swagger
4. Jobs frontend
5. Applications: apply with resume, recruiter review
6. Profile and UI polish
7. Testing
8. Deployment: Docker, Render, MongoDB Atlas
9. Documentation
