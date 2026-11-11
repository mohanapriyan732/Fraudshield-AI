# Deployment notes

FraudShield has not been deployed. No production host, credentials or external service configuration are included in this project.

## Required topology

Build the frontend with `npm run build` and serve the generated `dist` directory as a static single-page app. Run the FastAPI application separately. The Vite `/api` proxy is for local development only; production must route `/api` to the API on the same origin because the frontend calls relative `/api` URLs.

Before any public release:

1. Put both services behind HTTPS and a maintained reverse proxy.
2. Set `FRAUDSHIELD_CORS_ORIGINS` to the exact production origin(s); do not use wildcard origins.
3. Add authentication or abuse controls, rate limits, proxy request-size limits, health monitoring and a retention policy for proxy/access logs. The API itself currently has no authentication or rate limiting.
4. Keep API and dependencies updated, run the checks below, and confirm the proxy does not cache or log request bodies.
5. Test service-worker updates and offline behavior on the actual deployment origin. The service worker caches same-origin GET shell/assets; API POST requests are not cached.

## Local release checks

From the project root:

```sh
npm run lint
npm run build
python -m unittest backend.tests.test_analysis
```

The automated tests exercise representative English, Hindi and Tamil rules plus API validation and URL handling. They are not a labeled accuracy benchmark. A local browser smoke check confirmed the scanner flow and no horizontal document overflow at 320 px, 768 px and 1280 px viewport widths. This does not replace testing on physical devices, assistive technology or additional browsers.
