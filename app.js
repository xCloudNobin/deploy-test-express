import express from 'express';

export function createApp() {
  const app = express();

  app.get('/', (_request, response) => {
    response.type('html').send(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Express Deployment Test</title></head>
  <body style="font-family:system-ui;max-width:720px;margin:5rem auto;padding:1rem">
    <h1>Hello from deploy-test-express</h1>
    <p>Your Node.js and Express deployment is working.</p>
    <p><a href="/health">Health check</a> · <a href="/api/info">API info</a></p>
  </body>
</html>`);
  });

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', app: 'deploy-test-express' });
  });

  app.get('/api/info', (_request, response) => {
    response.json({ app: 'deploy-test-express', runtime: 'node', framework: 'express' });
  });

  return app;
}
