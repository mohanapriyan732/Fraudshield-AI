# Security and privacy

## Data flow

- Message, job, payment and URL text is sent to the configured FraudShield API only after the user starts a check. The API applies deterministic local rules; it does not fetch submitted URLs or call an external AI or reputation service.
- Screenshot OCR runs in the browser with bundled Tesseract assets. The image stays on the device. Extracted text is shown for review and is sent only after the user checks the consent box and starts analysis.
- The browser stores scan type, risk level and timestamp in local storage. Submitted text is not included in history. The API logs scan type and character count, not content.
- The app does not request microphone access. Audio transcription is unavailable.

## Limits and safeguards

Analysis is heuristic, not a verdict. A clean result cannot confirm that a sender, message or website is safe. Hindi and Tamil patterns are limited and have not been accuracy-tested. Do not enter passwords, PINs, OTPs or other secrets.

The API validates scan type, language and content length, limits request size, and configures CORS origins through `FRAUDSHIELD_CORS_ORIGINS`. Development binds to loopback. The API has no authentication, rate limiting, or production abuse controls; do not expose it directly to the public internet.

## Reporting a vulnerability

Do not include real scam messages, personal information or credentials in a report. Provide a minimal reproduction using fictional data and describe the affected version and impact.
