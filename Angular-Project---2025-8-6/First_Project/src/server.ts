import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import http from 'node:http';
import https from 'node:https';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Proxy API requests to the real backend (Express + MongoDB).
// Without this, first-load requests to http://localhost:4000/api/*
// hit the SSR server (which has no API routes) and appear to "work only after a second click".
const apiTarget = new URL(process.env['API_PROXY_TARGET'] || 'http://localhost:3000');
app.use('/api', (req, res) => {
  const isHttps = apiTarget.protocol === 'https:';
  const client = isHttps ? https : http;

  const proxyReq = client.request(
    {
      protocol: apiTarget.protocol,
      hostname: apiTarget.hostname,
      port: apiTarget.port || (isHttps ? 443 : 80),
      method: req.method,
      path: req.originalUrl,
      headers: {
        ...req.headers,
        host: apiTarget.host,
      },
    },
    (proxyRes) => {
      res.status(proxyRes.statusCode || 502);

      // Forward headers (skip hop-by-hop headers).
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (!value) continue;
        const lower = key.toLowerCase();
        if (lower === 'connection' || lower === 'transfer-encoding' || lower === 'keep-alive') continue;
        res.setHeader(key, value as any);
      }

      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', () => {
    if (!res.headersSent) {
      res.status(502).json({ error: 'API proxy error' });
    } else {
      res.end();
    }
  });

  req.pipe(proxyReq);
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
