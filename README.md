# deploy-test-express

Minimal Node.js and Express application for testing Git deployments.

## Routes

- `/` — HTML home page
- `/health` — JSON health check
- `/api/info` — runtime information

## Run

```bash
npm ci
npm test
PORT=3000 npm start
```

The server binds to `0.0.0.0` and reads the `PORT` environment variable.
