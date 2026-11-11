# JobConnect API

REST API for **JobConnect**, a job portal where recruiters post jobs and job seekers search and apply.

> **Status:** Phase 1 (scaffold). The API currently exposes a health check; features are added phase by phase (see [Roadmap](#roadmap)).

Frontend repo: [jobconnect-frontend](https://github.com/sudhan-murugan/jobconnect-frontend)

## Tech stack

- **Runtime:** Node.js 22+
- **Framework:** Express 5
- **Database:** MongoDB with Mongoose
- **Security:** Helmet (HTTP headers), CORS allow-list
- **Planned:** JWT + bcrypt auth, Multer uploads, express-validator, Swagger docs, Jest + Supertest, Docker

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

The server refuses to start if a required variable is missing.

## API

| Method | Path      | Description  |
| ------ | --------- | ------------ |
| GET    | `/health` | Health check |

All errors are returned as JSON: `{ "message": "..." }`.

## Project structure

```
src/
  config/       env.js (config from .env), db.js (MongoDB connection)
  controllers/  request handlers (one file per resource)
  middleware/   auth.js, role.js, upload.js, error.js
  models/       Mongoose schemas
  routes/       Express routers, mounted in app.js
  utils/        shared helpers (e.g. ApiError)
  validators/   express-validator rules for request bodies
  app.js        builds the Express app (no network port; easy to test)
  server.js     connects to MongoDB, then starts listening
tests/          Jest + Supertest tests
```

## Roadmap

1. ✅ Scaffold: Express app, MongoDB connection, health check
2. Authentication: register/login, JWT, role-based access
3. Jobs: CRUD, search, filters, pagination, Swagger
4. Jobs frontend
5. Applications: apply with resume, recruiter review
6. Profile and UI polish
7. Testing
8. Deployment: Docker, Render, MongoDB Atlas
9. Documentation
