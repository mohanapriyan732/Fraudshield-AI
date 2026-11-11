import httpx
import unittest

from backend.app.main import app
from backend.app.detection.rules import analyze_content


class AnalysisRulesTests(unittest.TestCase):
    def test_otp_threat_is_high_risk_with_evidence(self):
        result = analyze_content(
            "Your account will be blocked today. Share your OTP to keep it active.",
            "message",
        )
        self.assertEqual(result.level, "High risk")
        self.assertTrue(any("secret code" in item for item in result.indicators))

    def test_normal_text_does_not_claim_verified_safety(self):
        result = analyze_content("Your statement is ready in the app.", "message")
        self.assertEqual(result.level, "No obvious indicators")
        self.assertIn("cannot verify the sender", result.summary)

    def test_private_url_is_not_inspected(self):
        result = analyze_content("http://127.0.0.1/private", "url")
        self.assertEqual(result.level, "Inconclusive")
        self.assertIn("not checked", result.indicators[0])

    def test_private_ipv6_url_is_not_inspected(self):
        result = analyze_content("http://[::1]/private", "url")
        self.assertEqual(result.level, "Inconclusive")
        self.assertIn("not checked", result.indicators[0])

    def test_credentials_in_url_are_rejected(self):
        result = analyze_content("https://user:pass@example.com/login", "url")
        self.assertEqual(result.level, "Inconclusive")
        self.assertIn("credentials", result.indicators[0])

    def test_internal_hostnames_are_not_reported_as_clear(self):
        for address in ("router.local", "service.internal", "example.test"):
            with self.subTest(address=address):
                result = analyze_content(address, "url")
                self.assertEqual(result.level, "Inconclusive")

    def test_public_url_is_not_fetched(self):
        result = analyze_content("https://secure-bank-verify.xyz/login", "url")
        self.assertEqual(result.level, "Caution")
        self.assertTrue(any("unusual formatting" in item for item in result.indicators))

    def test_upi_refund_request_is_high_risk(self):
        result = analyze_content(
            "Send a UPI payment now to receive your refund.", "payment"
        )
        self.assertEqual(result.level, "High risk")
        self.assertIn("Asks for an unexpected payment or refund action", result.indicators)

    def test_fake_bank_otp_message_is_high_risk(self):
        result = analyze_content(
            "Your bank account will be blocked today. Share your OTP to update KYC.",
            "message",
        )
        self.assertEqual(result.level, "High risk")
        self.assertGreaterEqual(len(result.indicators), 3)

    def test_genuine_style_bank_notice_has_no_obvious_indicators(self):
        result = analyze_content(
            "Your monthly statement is ready in the bank app.", "message"
        )
        self.assertEqual(result.level, "No obvious indicators")

    def test_unrealistic_investment_claim_is_caution(self):
        result = analyze_content(
            "This investment opportunity promises guaranteed returns.", "message"
        )
        self.assertEqual(result.level, "Caution")
        self.assertIn("Promises unusually large or guaranteed returns", result.indicators)

    def test_hindi_otp_threat_gets_localized_evidence_and_guidance(self):
        result = analyze_content(
            "आपका बैंक खाता आज बंद हो जाएगा। अपना ओटीपी साझा करें।",
            "message",
            "hi",
        )
        self.assertEqual(result.level, "High risk")
        self.assertTrue(any("गोपनीय कोड" in item for item in result.indicators))
        self.assertIn("OTP, PIN", result.next_steps[0])

    def test_tamil_upi_payment_request_gets_localized_evidence(self):
        result = analyze_content(
            "ரீஃபண்ட் பெற உடனே யுபிஐ மூலம் பணம் செலுத்து",
            "payment",
            "ta",
        )
        self.assertEqual(result.level, "High risk")
        self.assertTrue(any("கட்டணம்" in item for item in result.indicators))
        self.assertIn("இந்தச் செய்தி", result.summary)

    def test_english_language_selection_does_not_change_existing_result(self):
        english = analyze_content(
            "Your account will be blocked today. Share your OTP to keep it active.",
            "message",
        )
        explicit_english = analyze_content(
            "Your account will be blocked today. Share your OTP to keep it active.",
            "message",
            "en",
        )
        self.assertEqual(english, explicit_english)


class AnalysisApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        transport = httpx.ASGITransport(app=app)
        self.client = httpx.AsyncClient(transport=transport, base_url="http://testserver")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_health_endpoint(self):
        response = await self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["analysis"], "local-rules")

    async def test_analyze_endpoint_returns_validated_result(self):
        response = await self.client.post(
            "/api/analyze",
            json={
                "content": "Pay a registration fee to get a guaranteed job today.",
                "scan_type": "job",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["level"], "High risk")
        self.assertIn("indicators", response.json())

    async def test_rejects_oversized_content_without_echoing_it(self):
        secret_like_content = "x" * 5001
        response = await self.client.post(
            "/api/analyze",
            json={"content": secret_like_content, "scan_type": "message"},
        )
        self.assertEqual(response.status_code, 422)
        self.assertNotIn(secret_like_content, response.text)

    async def test_rejects_unknown_scan_type(self):
        response = await self.client.post(
            "/api/analyze",
            json={"content": "Hello", "scan_type": "audio"},
        )
        self.assertEqual(response.status_code, 422)

    async def test_api_returns_hindi_result_for_hindi_input(self):
        response = await self.client.post(
            "/api/analyze",
            json={
                "content": "आपका बैंक खाता आज बंद हो जाएगा। अपना ओटीपी साझा करें।",
                "scan_type": "message",
                "language": "hi",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("गोपनीय कोड", response.json()["indicators"][0])

    async def test_rejects_unknown_analysis_language(self):
        response = await self.client.post(
            "/api/analyze",
            json={"content": "Hello", "scan_type": "message", "language": "fr"},
        )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
