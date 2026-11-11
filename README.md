# FraudShield

A responsive digital-safety companion for reviewing suspicious messages and links.

## Run locally

Install and start the API and frontend in separate terminals:

```sh
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r backend\requirements.txt
npm run dev:api
```

In another terminal:

```sh
npm install
npm run dev
```

Create and preview a production build with `npm run build` and `npm run preview`.
The Vite development server proxies `/api` requests to `http://127.0.0.1:8000`.

Run backend tests from the project root:

```sh
python -m unittest backend.tests.test_analysis
```

`npm run lint` and `npm run build` are the frontend checks. See [security and privacy](./docs/SECURITY-PRIVACY.md) and [deployment notes](./docs/DEPLOYMENT.md) before exposing the API beyond local development.

## Available now

- Message, job-offer, payment-request and URL checks use validated deterministic rules in the FastAPI backend.
- Screenshot OCR runs in the browser with locally bundled Tesseract models (English, Hindi, Tamil); users review and consent before extracted text is sent to the API.
- Results explain detected warning signs and suggest safer next steps.
- Message analysis supports English, Hindi and Tamil rule sets; Hindi and Tamil coverage is limited and unbenchmarked.
- Safety Hub reminders and an interactive awareness quiz.
- India cyber-fraud guidance, including 1930 and the official reporting portal.
- Scan history stores only scan type, result and time in this browser; submitted content is not persisted by the API.
- Installable PWA shell with cached static app resources and an offline indicator.

## Limitations

This is a local-rule demo, not an AI model or threat-intelligence service. The API does not open or fetch submitted URLs, verify sender identities, or guarantee safety. Hindi/Tamil patterns have limited coverage and have not been accuracy-tested. Audio transcription, external AI, threat-intelligence lookups and account sync are not implemented. Do not enter passwords, PINs or OTPs.

History is stored in browser local storage and can be cleared in Settings. The API logs scan type and character count only, not submitted text. Images are not uploaded or retained. OCR worker, language and WASM assets are generated into `public\ocr` by the predev/prebuild scripts from the locally installed Apache-2.0 Tesseract.js engine and MIT-licensed language packages; the generated directory is git-ignored. There is no remote account or database.
