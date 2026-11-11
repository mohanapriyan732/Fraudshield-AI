import ipaddress
import re
from urllib.parse import urlsplit

from backend.app.schemas.analysis import (
    AnalysisResponse,
    RiskLevel,
    ScanLanguage,
    ScanType,
)

_MESSAGE_RULES: tuple[tuple[re.Pattern[str], str, int], ...] = (
    (
        re.compile(r"\b(otp|one[- ]time password|upi pin|mpin|cvv|card pin|password)\b", re.I),
        "Requests a secret code or payment credential",
        3,
    ),
    (
        re.compile(r"\b(urgent|immediately|within \d+ minutes|final warning|account.{0,30}blocked|suspended today|legal action)\b", re.I),
        "Uses urgency, a threat, or fear to pressure you",
        2,
    ),
    (
        re.compile(
            r"\b(kyc|police|government|customer care|official support|customs|courier|your bank(?: account)?|bank (?:support|security|account)|from (?:the )?bank)\b",
            re.I,
        ),
        "Claims to represent an authority or service",
        1,
    ),
    (
        re.compile(
            r"\b(registration fee|processing fee|pay.{0,20}to get.{0,20}job)\b",
            re.I,
        ),
        "Asks for an upfront fee to receive a job, prize, or reward",
        2,
    ),
    (
        re.compile(r"\b(earn.{0,20}daily|guaranteed returns?)\b", re.I),
        "Promises unusually large or guaranteed returns",
        2,
    ),
    (
        re.compile(r"\b(bit\.ly|tinyurl|t\.co|shorturl)\b|https?://\S+", re.I),
        "Contains a link that should be verified independently",
        1,
    ),
    (
        re.compile(
            r"\b(send|transfer).{0,30}(money|payment|funds|upi)\b|"
            r"\bpay.{0,20}now\b|\bupi.{0,20}(collect|payment) request\b|"
            r"\bcollect request\b|\bscan.{0,15}qr\b|"
            r"\bclaim.{0,15}refund\b|\brefund.{0,20}(fee|payment)\b|"
            r"\breceive.{0,20}refund.{0,20}(pay|send|fee)\b",
            re.I,
        ),
        "Asks for an unexpected payment or refund action",
        2,
    ),
    (
        re.compile(r"\b(install.{0,20}apk|remote access|screen sharing|download.{0,20}app)\b", re.I),
        "Asks you to install an app or grant device access",
        2,
    ),
    (
        re.compile(r"\b(lottery|prize money|you have won|claim your prize|investment opportunity)\b", re.I),
        "Uses a prize or investment lure",
        1,
    ),
)

_HIGH_RISK_INDICATORS = {
    "Requests a secret code or payment credential",
    "Asks for an unexpected payment or refund action",
    "Asks for an upfront fee to receive a job, prize, or reward",
}

_LANGUAGE_RULES: dict[ScanLanguage, tuple[tuple[re.Pattern[str], str, int], ...]] = {
    "hi": (
        (
            re.compile(r"(ओटीपी|ओ\s*टी\s*पी|otp|upi pin|यूपीआई पिन|सीवीवी|पासवर्ड|गुप्त कोड)", re.I),
            "Requests a secret code or payment credential",
            3,
        ),
        (
            re.compile(r"(तुरंत|अभी|आज|बंद हो जाएगा|बंद कर दिया जाएगा|निलंबित|अंतिम चेतावनी)", re.I),
            "Uses urgency, a threat, or fear to pressure you",
            2,
        ),
        (
            re.compile(r"(बैंक|केवाईसी|पुलिस|सरकार|आधिकारिक|ग्राहक सेवा)", re.I),
            "Claims to represent an authority or service",
            1,
        ),
        (
            re.compile(r"(पैसे भेजें|भुगतान करें|रिफंड पाने|क्यूआर|यूपीआई अनुरोध)", re.I),
            "Asks for an unexpected payment or refund action",
            2,
        ),
        (
            re.compile(r"(पंजीकरण शुल्क|प्रोसेसिंग शुल्क|नौकरी पाने के लिए भुगतान|गारंटी वाली नौकरी)", re.I),
            "Asks for an upfront fee to receive a job, prize, or reward",
            2,
        ),
    ),
    "ta": (
        (
            re.compile(r"(ஓடிபி|ஒடிபி|otp|யுபிஐ பின்|upi pin|சிவிவி|கடவுச்சொல்|ரகசிய குறியீடு)", re.I),
            "Requests a secret code or payment credential",
            3,
        ),
        (
            re.compile(r"(உடனே|இன்று|முடக்கப்படும்|மூடப்படும்|இறுதி எச்சரிக்கை|நிமிடங்களில்)", re.I),
            "Uses urgency, a threat, or fear to pressure you",
            2,
        ),
        (
            re.compile(r"(வங்கி|கேஒய்சி|காவல்துறை|காவல்|அரசு|அதிகாரப்பூர்வ|வாடிக்கையாளர் சேவை)", re.I),
            "Claims to represent an authority or service",
            1,
        ),
        (
            re.compile(r"(பணம் அனுப்பு|பணம் செலுத்து|ரீஃபண்ட் பெற|பணம் திரும்ப|க்யூஆர்|யுபிஐ கோரிக்கை)", re.I),
            "Asks for an unexpected payment or refund action",
            2,
        ),
        (
            re.compile(r"(பதிவு கட்டணம்|செயலாக்க கட்டணம்|வேலைக்காக கட்டணம்|உத்தரவாதமான வேலை)", re.I),
            "Asks for an upfront fee to receive a job, prize, or reward",
            2,
        ),
    ),
}

_LOCALIZED_TEXT: dict[ScanLanguage, dict[str, str]] = {
    "hi": {
        "summary.high": "इस संदेश में संवेदनशील जानकारी या पैसे की माँग है, या इसमें धोखाधड़ी के कई आम संकेत हैं।",
        "summary.caution": "इस संदेश में ऐसे चेतावनी संकेत हैं जिनकी जवाब देने से पहले स्वतंत्र रूप से जाँच करनी चाहिए।",
        "summary.clear": "इस जाँच में मज़बूत चेतावनी संकेत नहीं मिले। इससे भेजने वाले की पुष्टि या सुरक्षा की गारंटी नहीं होती।",
        "summary.url": "URL के दिखाई देने वाले प्रारूप में कोई स्पष्ट चेतावनी नहीं मिली। इससे वेबसाइट वैध साबित नहीं होती।",
        "summary.inconclusive": "स्थानीय URL जाँच इस पते का सुरक्षित आकलन नहीं कर सकी।",
        "indicator.credential": "गोपनीय कोड या भुगतान की जानकारी माँगता है",
        "indicator.urgency": "जल्दी करने का दबाव, धमकी या डर दिखाता है",
        "indicator.authority": "किसी संस्था या सेवा का रूप धारण करता है",
        "indicator.fee": "नौकरी, इनाम या लाभ के लिए पहले शुल्क माँगता है",
        "indicator.returns": "असामान्य रूप से बड़े या गारंटीकृत लाभ का वादा करता है",
        "indicator.link": "ऐसा लिंक है जिसकी स्वतंत्र रूप से जाँच करनी चाहिए",
        "indicator.payment": "अनपेक्षित भुगतान या रिफंड कार्रवाई माँगता है",
        "indicator.install": "ऐप इंस्टॉल करने या डिवाइस तक पहुँच देने को कहता है",
        "indicator.investment": "इनाम या निवेश का लालच देता है",
        "indicator.clear": "स्थानीय नियमों को कोई मज़बूत चेतावनी संकेत नहीं मिला",
        "indicator.url.clear": "URL के प्रारूप में कोई स्पष्ट चेतावनी नहीं मिली",
        "indicator.private": "निजी या स्थानीय पते की जाँच नहीं की जाती",
        "indicator.credentials": "इस पते में लॉगिन जानकारी शामिल है",
        "indicator.invalid": "URL का प्रारूप मान्य नहीं है",
        "indicator.local": "स्थानीय या आंतरिक होस्टनाम की जाँच नहीं की जाती",
        "indicator.reserved": "आरक्षित उदाहरण डोमेन सार्वजनिक वेबसाइट नहीं हैं",
        "indicator.raw_ip": "पते में डोमेन नाम के बजाय IP पता है",
        "indicator.http": "कनेक्शन HTTPS का उपयोग नहीं करता",
        "indicator.short": "पता लिंक छोटा करने वाली सेवा का उपयोग करता है",
        "indicator.subdomains": "पते में कई सबडोमेन हैं",
        "indicator.domain": "डोमेन में भरोसे से जुड़े शब्द असामान्य ढंग से जुड़े हैं",
        "indicator.tld": "यह डोमेन अंत कभी-कभी अस्थायी साइटों में उपयोग होता है",
        "next.credentials": "OTP, PIN, पासवर्ड या भुगतान जानकारी साझा न करें।",
        "next.verify": "संस्था के आधिकारिक ऐप या पहले से ज्ञात संपर्क से पुष्टि करें।",
        "next.link": "संदेश में दिए लिंक या फ़ोन नंबर का उपयोग न करें।",
        "next.channel": "किसी भरोसेमंद माध्यम से संस्था से संपर्क करें।",
        "next.general": "पैसे देने, सॉफ़्टवेयर इंस्टॉल करने या निजी जानकारी साझा करने से पहले सावधानी बरतें।",
        "next.url1": "अनपेक्षित संदेश के लिंक से साइन इन या भुगतान न करें।",
        "next.url2": "संस्था की आधिकारिक ऐप या सहेजे हुए पते से वेबसाइट खोलें।",
        "next.invalid": "लिंक खोलकर जाँच न करें। संस्था की आधिकारिक वेबसाइट स्वयं खोलें।",
    },
    "ta": {
        "summary.high": "இந்தச் செய்தி ரகசியத் தகவல் அல்லது பணம் கேட்கிறது; அல்லது மோசடிக்கான பல பொதுவான அறிகுறிகளைக் கொண்டுள்ளது.",
        "summary.caution": "பதிலளிப்பதற்கு முன் சுயமாகச் சரிபார்க்க வேண்டிய எச்சரிக்கை அறிகுறிகள் இந்தச் செய்தியில் உள்ளன.",
        "summary.clear": "இந்தச் சரிபார்ப்பில் வலுவான எச்சரிக்கை அறிகுறிகள் இல்லை. அனுப்புநரை உறுதிப்படுத்தவோ பாதுகாப்பை உறுதி செய்யவோ இது முடியாது.",
        "summary.url": "URL வடிவத்தில் வெளிப்படையான எச்சரிக்கை இல்லை. இதனால் அந்த இணையதளம் உண்மையானது என்று உறுதியாகாது.",
        "summary.inconclusive": "உள்ளூர் URL சரிபார்ப்பால் இந்த முகவரியைப் பாதுகாப்பாக மதிப்பிட முடியவில்லை.",
        "indicator.credential": "ரகசியக் குறியீடு அல்லது கட்டணத் தகவலைக் கேட்கிறது",
        "indicator.urgency": "அவசரம், மிரட்டல் அல்லது பயத்தைப் பயன்படுத்துகிறது",
        "indicator.authority": "ஒரு நிறுவனம் அல்லது சேவையாக நடிக்கிறது",
        "indicator.fee": "வேலை, பரிசு அல்லது பலனுக்காக முன்கட்டணம் கேட்கிறது",
        "indicator.returns": "அசாதாரணமான அல்லது உறுதியான லாபத்தை வாக்குறுதி செய்கிறது",
        "indicator.link": "தனியாகச் சரிபார்க்க வேண்டிய இணைப்பு உள்ளது",
        "indicator.payment": "எதிர்பாராத கட்டணம் அல்லது பணத்தைத் திரும்பப் பெறும் நடவடிக்கையைக் கேட்கிறது",
        "indicator.install": "செயலியை நிறுவ அல்லது சாதன அணுகலை வழங்கச் சொல்கிறது",
        "indicator.investment": "பரிசு அல்லது முதலீட்டு ஆசையைக் காட்டுகிறது",
        "indicator.clear": "உள்ளூர் விதிகளில் வலுவான எச்சரிக்கை அறிகுறிகள் இல்லை",
        "indicator.url.clear": "URL வடிவத்தில் வெளிப்படையான எச்சரிக்கை இல்லை",
        "indicator.private": "தனிப்பட்ட அல்லது உள்ளூர் முகவரிகள் சரிபார்க்கப்படுவதில்லை",
        "indicator.credentials": "இந்த முகவரியில் உள்நுழைவு விவரங்கள் உள்ளன",
        "indicator.invalid": "URL வடிவம் தவறானது",
        "indicator.local": "உள்ளூர் அல்லது உள் ஹோஸ்ட் பெயர்கள் சரிபார்க்கப்படுவதில்லை",
        "indicator.reserved": "ஒதுக்கப்பட்ட மாதிரி டொமைன்கள் பொது இணையதளங்கள் அல்ல",
        "indicator.raw_ip": "டொமைன் பெயருக்கு பதிலாக IP முகவரி பயன்படுத்தப்படுகிறது",
        "indicator.http": "இணைப்பு HTTPS பயன்படுத்தவில்லை",
        "indicator.short": "இணைப்பு சுருக்க சேவை பயன்படுத்தப்படுகிறது",
        "indicator.subdomains": "முகவரியில் பல துணை டொமைன்கள் உள்ளன",
        "indicator.domain": "நம்பிக்கையைச் சுட்டும் சொற்கள் டொமைனில் வழக்கமற்ற வகையில் இணைக்கப்பட்டுள்ளன",
        "indicator.tld": "இந்த டொமைன் முடிவு சில நேரங்களில் தற்காலிக தளங்களில் பயன்படுத்தப்படுகிறது",
        "next.credentials": "OTP, PIN, கடவுச்சொல் அல்லது கட்டண விவரங்களைப் பகிர வேண்டாம்.",
        "next.verify": "நிறுவனத்தின் அதிகாரப்பூர்வ செயலி அல்லது ஏற்கனவே தெரிந்த தொடர்பு வழியாகச் சரிபார்க்கவும்.",
        "next.link": "செய்தியில் உள்ள இணைப்பு அல்லது தொலைபேசி எண்ணைப் பயன்படுத்த வேண்டாம்.",
        "next.channel": "நீங்கள் ஏற்கனவே நம்பும் வழியில் நிறுவனத்தைத் தொடர்பு கொள்ளவும்.",
        "next.general": "பணம் செலுத்துதல், செயலி நிறுவுதல் அல்லது தனிப்பட்ட தகவலைப் பகிர்வதற்கு முன் கவனமாக இருங்கள்.",
        "next.url1": "எதிர்பாராத செய்தி இணைப்பில் உள்நுழையவோ பணம் செலுத்தவோ வேண்டாம்.",
        "next.url2": "நிறுவனத்தின் அதிகாரப்பூர்வ செயலி அல்லது சேமித்த முகவரியைத் திறக்கவும்.",
        "next.invalid": "சோதிப்பதற்காக இணைப்பைத் திறக்க வேண்டாம். நிறுவனத்தின் அதிகாரப்பூர்வ தளத்தை நீங்களே திறக்கவும்.",
    },
}

_INDICATOR_KEYS = {
    "Requests a secret code or payment credential": "credential",
    "Uses urgency, a threat, or fear to pressure you": "urgency",
    "Claims to represent an authority or service": "authority",
    "Asks for an upfront fee to receive a job, prize, or reward": "fee",
    "Promises unusually large or guaranteed returns": "returns",
    "Contains a link that should be verified independently": "link",
    "Asks for an unexpected payment or refund action": "payment",
    "Asks you to install an app or grant device access": "install",
    "Uses a prize or investment lure": "investment",
    "No strong warning signs found by the local rules": "clear",
    "No obvious URL-format warning found": "url.clear",
}

_NEXT_STEP_KEYS = {
    "Do not share OTPs, PINs, passwords, or payment details.": "credentials",
    "Verify through the organisation’s official app or a known contact.": "verify",
    "Do not use links or phone numbers included in the message.": "link",
    "Contact the organisation through a channel you already trust.": "channel",
    "Be cautious if asked to pay, install software, or share personal information.": "general",
    "Do not sign in or pay from a link in an unexpected message.": "url1",
    "Visit the organisation using its official app or a saved address.": "url2",
    "Do not open the link to test it. Navigate to the organisation’s official site yourself.": "invalid",
}

_INDICATOR_TEXT_KEYS = (
    ("Private or non-public IP addresses are not checked", "private"),
    ("Only a complete HTTP or HTTPS website address can be checked", "invalid"),
    ("The URL has an invalid format or port", "invalid"),
    ("Local or internal hostnames are not checked", "local"),
    ("Reserved example domains are not treated as public websites", "reserved"),
    ("The address uses an invalid network port", "invalid"),
    ("The domain name could not be normalized", "invalid"),
    ("The address embeds login credentials", "credentials"),
    ("The domain name has an invalid format", "invalid"),
    ("The address uses a raw IP instead of a domain name", "raw_ip"),
    ("The connection does not use HTTPS", "http"),
    ("The address uses a link-shortening service", "short"),
    ("The address has several subdomains", "subdomains"),
    ("The domain combines trust-related words with unusual formatting", "domain"),
    ("The domain ending is sometimes used by disposable sites", "tld"),
)


def _result(
    level: RiskLevel,
    summary: str,
    indicators: list[str],
    next_steps: list[str],
) -> AnalysisResponse:
    return AnalysisResponse(
        level=level, summary=summary, indicators=indicators, next_steps=next_steps
    )


def _invalid_url(reason: str) -> AnalysisResponse:
    return _result(
        "Inconclusive",
        "This address could not be safely assessed by the local URL-format checker.",
        [reason],
        ["Do not open the link to test it. Navigate to the organisation’s official site yourself."],
    )


def _analyze_url(content: str) -> AnalysisResponse:
    candidate = content if "://" in content else f"https://{content}"
    try:
        parsed = urlsplit(candidate)
        hostname = parsed.hostname
        port = parsed.port
    except ValueError:
        return _invalid_url("The URL has an invalid format or port")

    if parsed.scheme.lower() not in {"http", "https"} or not hostname:
        return _invalid_url("Only a complete HTTP or HTTPS website address can be checked")
    if parsed.username is not None or parsed.password is not None:
        return _invalid_url("The address embeds login credentials")
    if port is not None and not 1 <= port <= 65535:
        return _invalid_url("The address uses an invalid network port")

    try:
        host = hostname.rstrip(".").encode("idna").decode("ascii").lower()
    except UnicodeError:
        return _invalid_url("The domain name could not be normalized")

    if host == "localhost" or host.endswith((".localhost", ".local", ".internal")):
        return _invalid_url("Local or internal hostnames are not checked")

    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None

    if address is not None:
        if not address.is_global:
            return _invalid_url("Private or non-public IP addresses are not checked")
        indicators = ["The address uses a raw IP instead of a domain name"]
    else:
        labels = host.split(".")
        if labels[-1] in {"test", "invalid", "example"}:
            return _invalid_url("Reserved example domains are not treated as public websites")
        if len(labels) < 2 or any(
            not label
            or len(label) > 63
            or label.startswith("-")
            or label.endswith("-")
            or not re.fullmatch(r"[a-z0-9-]+", label)
            for label in labels
        ):
            return _invalid_url("The domain name has an invalid format")
        indicators = []

    if parsed.scheme.lower() == "http":
        indicators.append("The connection does not use HTTPS")
    if host in {"bit.ly", "tinyurl.com", "t.co", "shorturl.at"}:
        indicators.append("The address uses a link-shortening service")
    if len(host.split(".")) > 4:
        indicators.append("The address has several subdomains")
    if "-" in host and re.search(r"(bank|secure|verify|account|login|support)", host):
        indicators.append("The domain combines trust-related words with unusual formatting")
    if re.search(r"\.(xyz|top|click|work|zip)$", host):
        indicators.append("The domain ending is sometimes used by disposable sites")

    if indicators:
        return _result(
            "Caution",
            f"A local URL-format check found {len(indicators)} feature(s) worth verifying. It does not check malware or site reputation.",
            indicators[:4],
            [
                "Do not sign in or pay from a link in an unexpected message.",
                "Visit the organisation using its official app or a saved address.",
            ],
        )
    return _result(
        "No obvious indicators",
        "No obvious URL-format warning was found. This does not confirm the site is legitimate.",
        ["No obvious URL-format warning found"],
        [
            "Do not sign in or pay from a link in an unexpected message.",
            "Visit the organisation using its official app or a saved address.",
        ],
    )


def _localize(result: AnalysisResponse, language: ScanLanguage) -> AnalysisResponse:
    if language == "en":
        return result
    text = _LOCALIZED_TEXT[language]
    summary_key = {
        "High risk": "summary.high",
        "Caution": "summary.caution",
        "No obvious indicators": "summary.clear",
        "Inconclusive": "summary.inconclusive",
    }[result.level]
    if "URL-format warning was found" in result.summary:
        summary_key = "summary.url"
    elif result.summary.startswith("A local URL-format check found"):
        summary_key = "summary.caution"

    def localized_indicator(indicator: str) -> str:
        key = _INDICATOR_KEYS.get(indicator)
        if key is None:
            key = next(
                (
                    candidate
                    for prefix, candidate in _INDICATOR_TEXT_KEYS
                    if prefix in indicator
                ),
                None,
            )
        return text.get(f"indicator.{key}", indicator) if key else indicator

    return AnalysisResponse(
        level=result.level,
        summary=text[summary_key],
        indicators=[localized_indicator(indicator) for indicator in result.indicators],
        next_steps=[
            text.get(f"next.{_NEXT_STEP_KEYS[step]}", step)
            if step in _NEXT_STEP_KEYS
            else step
            for step in result.next_steps
        ],
    )


def analyze_content(
    content: str, scan_type: ScanType, language: ScanLanguage = "en"
) -> AnalysisResponse:
    if scan_type == "url":
        return _localize(_analyze_url(content), language)

    matches = [
        (indicator, weight)
        for pattern, indicator, weight in _MESSAGE_RULES
        if pattern.search(content)
    ]
    matches.extend(
        (indicator, weight)
        for pattern, indicator, weight in _LANGUAGE_RULES.get(language, ())
        if pattern.search(content)
    )
    indicators = list(dict.fromkeys(indicator for indicator, _ in matches))[:4]

    if not indicators:
        return _localize(_result(
            "No obvious indicators",
            "This check did not find strong warning signs. It cannot verify the sender or guarantee safety.",
            ["No strong warning signs found by the local rules"],
            ["Be cautious if asked to pay, install software, or share personal information."],
        ), language)

    score = sum(weight for _, weight in matches)
    is_high_risk = score >= 4 or any(
        indicator in _HIGH_RISK_INDICATORS for indicator in indicators
    )
    if is_high_risk:
        return _localize(_result(
            "High risk",
            "This message asks for sensitive information or money, or combines that request with other common scam tactics.",
            indicators,
            [
                "Do not share OTPs, PINs, passwords, or payment details.",
                "Verify through the organisation’s official app or a known contact.",
            ],
        ), language)
    return _localize(_result(
        "Caution",
        "This message has warning signs that deserve an independent check before you respond.",
        indicators,
        [
            "Do not use links or phone numbers included in the message.",
            "Contact the organisation through a channel you already trust.",
        ],
    ), language)
