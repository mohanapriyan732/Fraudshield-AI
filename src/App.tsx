import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Globe,
  House,
  MessageSquareText,
  Phone,
  ScanLine,
  Settings,
  Shield,
  ShieldAlert,
  Smartphone,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react'
import type { AnalysisResult, ScanLanguage, ScanRecord, ScanType } from './lib/types'
import { analyzeWithApi } from './lib/api'
import { readHistory, writeHistory } from './lib/history'
import { ScreenshotScanner } from './components/ScreenshotScanner'
import './App.css'

type Page = 'home' | 'scan' | 'screenshot' | 'safety' | 'history' | 'settings' | 'emergency'

const navigation: Array<{ id: Page; label: string; icon: typeof House }> = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'scan', label: 'Scan', icon: ScanLine },
  { id: 'safety', label: 'Safety Hub', icon: BookOpen },
  { id: 'history', label: 'History', icon: Clock3 },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const scanOptions: Array<{ type: ScanType; label: string; placeholder: string; example: string }> = [
  {
    type: 'message',
    label: 'Message',
    placeholder: 'Paste a message to check',
    example: 'Fictional example: Your account will be blocked today. Share your OTP to keep it active.',
  },
  {
    type: 'url',
    label: 'Website link',
    placeholder: 'Paste a website address',
    example: 'Fictional example: https://secure-bank-verify.xyz/login',
  },
  {
    type: 'job',
    label: 'Job offer',
    placeholder: 'Paste a job or internship offer',
    example: 'Fictional example: Earn ₹30,000 daily. Pay a registration fee to start today.',
  },
  {
    type: 'payment',
    label: 'Payment request',
    placeholder: 'Paste a payment or refund request',
    example: 'Fictional example: Send a UPI payment now to receive your refund.',
  },
]

const tips = [
  { title: 'Keep your OTP private', detail: 'A real bank or support agent will not ask you to read out your OTP.' },
  { title: 'Check the address first', detail: 'Open your bank or service from its official app, not an unexpected link.' },
  { title: 'Never pay to get a job', detail: 'Verify recruiters using the company’s official careers page.' },
  { title: 'Pause before scanning', detail: 'A QR code can request money from you. Check the payment screen carefully.' },
]
const dailyTip = tips[Math.floor(Date.now() / 86_400_000) % tips.length]

const quiz = [
  {
    question: '“Your account closes in 10 minutes. Send your OTP to restore access.”',
    answer: true,
    reason: 'It threatens account closure and asks for a secret code. Do not share an OTP.',
  },
  {
    question: '“Your monthly statement is ready. Open your bank app to view it.”',
    answer: false,
    reason: 'This example does not include a link or ask for sensitive information. Still verify unexpected messages independently.',
  },
  {
    question: '“Pay a small fee today to unlock your guaranteed new job.”',
    answer: true,
    reason: 'Upfront fees and guaranteed job claims are common warning signs. Check the company’s official careers site.',
  },
]

type SafetyGuide = {
  id: string
  category: string
  title: string
  mechanism: string
  warningSigns: string
  example: string
  protect: string
  ifAffected: string
}

const safetyGuides: SafetyGuide[] = [
  {
    id: 'upi',
    category: 'UPI & payments',
    title: 'Unexpected collect requests',
    mechanism: 'A scammer may ask you to approve a collect request or scan a QR code while claiming you will receive money.',
    warningSigns: 'A request arrives unexpectedly, asks you to enter a UPI PIN to receive money, or creates urgency.',
    example: 'Fictional example: “Approve this request now to receive your prize.”',
    protect: 'Read the payment app screen before approving. A UPI PIN authorizes a payment; it is not needed to receive one.',
    ifAffected: 'Contact your bank/payment provider promptly and call India’s cyber-fraud helpline 1930.',
  },
  {
    id: 'banking',
    category: 'Banking & KYC',
    title: 'Account or KYC threats',
    mechanism: 'A message impersonates a bank and threatens account suspension to get you to click a link or reveal a code.',
    warningSigns: 'Threatening deadlines, unexpected login links, requests for OTPs, PINs, CVV or passwords.',
    example: 'Fictional example: “Your account closes today. Share your OTP to update KYC.”',
    protect: 'Open your bank’s official app yourself or contact the bank using a number from your card or official site.',
    ifAffected: 'Call your bank using a trusted contact method, secure the account, preserve messages and report promptly.',
  },
  {
    id: 'jobs',
    category: 'Jobs & internships',
    title: 'Advance-fee job offers',
    mechanism: 'A fake recruiter promises quick employment or high earnings, then asks for a registration, training or equipment fee.',
    warningSigns: 'Guaranteed income, no meaningful interview, pressure to pay, or email/domain unrelated to the employer.',
    example: 'Fictional example: “Pay a refundable fee today to unlock your guaranteed remote job.”',
    protect: 'Check the employer’s official careers page and verify the recruiter using a company contact you find independently.',
    ifAffected: 'Stop payments, contact your payment provider, keep receipts and report the incident.',
  },
  {
    id: 'phishing',
    category: 'Phishing & links',
    title: 'Fake sign-in pages',
    mechanism: 'A link leads to a page designed to imitate a real service and collect login or payment information.',
    warningSigns: 'Unexpected links, misspelled or lookalike domains, link shorteners, or a request to sign in urgently.',
    example: 'Fictional example: a text says “view your refund” and links to a lookalike bank login.',
    protect: 'Do not open the message link. Navigate to the service through its official app or a saved address.',
    ifAffected: 'Change affected passwords through the official site, contact the provider and monitor the account.',
  },
  {
    id: 'investment',
    category: 'Investments',
    title: 'Guaranteed return schemes',
    mechanism: 'A promoter uses fake testimonials, urgency or unusually high guaranteed returns to attract deposits.',
    warningSigns: 'Guaranteed profits, pressure to recruit others, secrecy, or requests to transfer funds to a personal account.',
    example: 'Fictional example: “Double your savings this month—offer closes in one hour.”',
    protect: 'Verify registration and claims through official financial regulators. Never invest based only on a forwarded message.',
    ifAffected: 'Contact your bank immediately, preserve transaction evidence and report through official channels.',
  },
  {
    id: 'impersonation',
    category: 'Impersonation',
    title: 'Fake officials or digital-arrest threats',
    mechanism: 'A caller impersonates police or a government official and uses threats to demand money or personal details.',
    warningSigns: 'Threats of immediate arrest, demands to move money for “verification”, secrecy, or video-call intimidation.',
    example: 'Fictional example: a caller claims your identity is linked to a case and demands a transfer.',
    protect: 'End the call. Do not transfer money or share credentials; verify independently with the named agency.',
    ifAffected: 'Contact your bank and local authorities through official channels, and call 1930 if money was sent.',
  },
  {
    id: 'shopping',
    category: 'Shopping',
    title: 'Fake stores and payment diversions',
    mechanism: 'A fake seller advertises a bargain, then pushes payment outside a trusted marketplace or refuses delivery.',
    warningSigns: 'Prices far below market, only advance payment accepted, pressure to use a personal UPI ID.',
    example: 'Fictional example: a social-media shop asks you to pay a personal account for a “limited deal”.',
    protect: 'Check the seller and marketplace protections. Avoid off-platform payments and keep order records.',
    ifAffected: 'Raise a dispute with the payment provider or marketplace and retain receipts and communications.',
  },
  {
    id: 'support',
    category: 'Fake customer support',
    title: 'Search-result support numbers',
    mechanism: 'A fraudulent support account or listing poses as customer care and asks for remote access or payment.',
    warningSigns: 'Unsolicited calls, requests to install remote-access apps, or demands for OTPs and fees.',
    example: 'Fictional example: a “support agent” asks you to install an app to process a refund.',
    protect: 'Find support from the company’s official app or website. Do not grant screen control or share codes.',
    ifAffected: 'Disconnect the device, remove unknown access tools, change exposed credentials and contact your bank.',
  },
  {
    id: 'malware',
    category: 'Apps & malware',
    title: 'Unknown APK or remote-access app',
    mechanism: 'A message urges you to install an app that can expose device activity or enable unauthorized access.',
    warningSigns: 'APK attachment, app from an unknown source, or requests to enable accessibility/screen sharing.',
    example: 'Fictional example: “Install this courier APK to release your parcel.”',
    protect: 'Install apps only from trusted stores and review permissions before granting access.',
    ifAffected: 'Disconnect from the internet if appropriate, uninstall suspicious apps, secure accounts from another device and contact your bank.',
  },
  {
    id: 'social',
    category: 'Social media',
    title: 'Account takeover and friend-in-need messages',
    mechanism: 'A compromised profile asks contacts for money or sends malicious links while appearing to be someone they know.',
    warningSigns: 'Unusual payment urgency, a new number/account, odd language, or requests to keep it secret.',
    example: 'Fictional example: a friend’s account asks for an urgent transfer and says not to call.',
    protect: 'Verify with the person using a separate known channel before sending money or opening links.',
    ifAffected: 'Contact the account owner, report the profile to the platform, and contact your bank if a transfer was made.',
  },
]

function App() {
  const [page, setPage] = useState<Page>('home')
  const [scanType, setScanType] = useState<ScanType>('message')
  const [scanLanguage, setScanLanguage] = useState<ScanLanguage>('en')
  const [input, setInput] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [history, setHistory] = useState<ScanRecord[]>(readHistory)
  const [online, setOnline] = useState(navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [notice, setNotice] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizAnswer, setQuizAnswer] = useState<boolean | null>(null)
  const [quizCorrect, setQuizCorrect] = useState(0)
  const [safetyFocus, setSafetyFocus] = useState<string | null>(null)

  useEffect(() => {
    const setOnlineStatus = () => setOnline(navigator.onLine)
    window.addEventListener('online', setOnlineStatus)
    window.addEventListener('offline', setOnlineStatus)
    const onInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onInstall)
    return () => {
      window.removeEventListener('online', setOnlineStatus)
      window.removeEventListener('offline', setOnlineStatus)
      window.removeEventListener('beforeinstallprompt', onInstall)
    }
  }, [])

  const navigate = (next: Page) => {
    setPage(next)
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const analyzeText = async (
    content: string,
    type: ScanType,
    language: ScanLanguage = scanLanguage,
  ): Promise<boolean> => {
    if (!content.trim()) {
      setNotice('Add a message or website address first.')
      return false
    }
    setIsAnalyzing(true)
    setResult(null)
    setNotice('')
    try {
      const analysis = await analyzeWithApi(content, type, language)
      setResult(analysis)
      const record: ScanRecord = {
        id: crypto.randomUUID(),
        type,
        level: analysis.level,
        createdAt: new Date().toISOString(),
      }
      const updated = [record, ...history].slice(0, 30)
      setHistory(updated)
      if (!writeHistory(updated)) {
        setNotice('This check is complete, but history could not be saved on this device.')
      }
      return true
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The analysis failed. Please try again.')
      return false
    } finally {
      setIsAnalyzing(false)
    }
  }

  const runScan = () => analyzeText(input, scanType)

  const chooseScan = (type: ScanType) => {
    setScanType(type)
    setInput('')
    setResult(null)
    navigate('scan')
  }

  const openSafety = (focus?: string) => {
    setSafetyFocus(focus ?? null)
    navigate('safety')
  }

  const useExample = () => {
    const option = scanOptions.find(({ type }) => type === scanType)
    setInput(option?.example.replace('Fictional example: ', '') ?? '')
    setResult(null)
    setNotice('Demo text inserted. This is a fictional example.')
  }

  const clearHistory = () => {
    if (!window.confirm('Delete all saved scan history from this device?')) return
    setHistory([])
    if (writeHistory([])) setNotice('History cleared from this device.')
    else setNotice('Could not clear local history. Check this browser’s storage settings.')
  }

  const removeRecord = (id: string) => {
    const updated = history.filter((record) => record.id !== id)
    setHistory(updated)
    setNotice(writeHistory(updated) ? 'Scan removed from history.' : 'Could not update local history.')
  }

  const installApp = async () => {
    if (!installPrompt) {
      setNotice('To install, use your browser menu and choose “Install app” or “Add to Home Screen”.')
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setNotice(choice.outcome === 'accepted' ? 'FraudShield was added to your device.' : 'Installation was cancelled.')
    setInstallPrompt(null)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => navigate('home')} aria-label="FraudShield home">
          <span className="brand-icon"><Shield size={20} /></span>
          <span><strong>FraudShield</strong><small>Digital safety</small></span>
        </button>
        <div className="top-actions">
          <span className={`connection ${online ? 'is-online' : 'is-offline'}`} aria-live="polite">
            {online ? <Wifi size={15} /> : <WifiOff size={15} />}
            {online ? 'Online' : 'Offline'}
          </span>
          <button type="button" className="emergency-shortcut" onClick={() => navigate('emergency')}>
            <Phone size={16} /> Emergency help
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <nav aria-label="Main navigation">
            {navigation.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                className={`nav-item ${page === id || (id === 'scan' && page === 'screenshot') ? 'selected' : ''}`}
                onClick={() => navigate(id)}
                aria-current={page === id || (id === 'scan' && page === 'screenshot') ? 'page' : undefined}
              >
                <Icon size={18} /> {label}
              </button>
            ))}
          </nav>
          <div className="sidebar-note">
            <ShieldAlert size={18} />
            <p>Not sure? Pause and verify through an official channel.</p>
            <button type="button" onClick={() => navigate('emergency')}>Get help <ArrowRight size={14} /></button>
          </div>
          <small className="sidebar-version">Local demo · English</small>
        </aside>

        <main className="main-content">
          {page === 'home' && (
            <HomePage
              tip={dailyTip}
              history={history}
              navigate={navigate}
              chooseScan={chooseScan}
              openSafety={openSafety}
              online={online}
            />
          )}
          {page === 'screenshot' && (
            <ScreenshotScanner
              notice={notice}
              onAnalyze={async (text, type, language) => {
                setScanType(type)
                setInput(text)
                setScanLanguage(language)
                if (await analyzeText(text, type, language)) navigate('scan')
              }}
            />
          )}
          {page === 'scan' && (
            <ScanPage
              scanType={scanType}
              scanLanguage={scanLanguage}
              input={input}
              result={result}
              notice={notice}
              isAnalyzing={isAnalyzing}
              openSafety={openSafety}
              setInput={setInput}
              setScanLanguage={(language) => { setScanLanguage(language); setResult(null) }}
              setScanType={(type) => { setScanType(type); setResult(null); setNotice('') }}
              runScan={runScan}
              useExample={useExample}
              clear={() => { setInput(''); setResult(null); setNotice('') }}
            />
          )}
          {page === 'safety' && (
            <SafetyPage
              quizIndex={quizIndex}
              quizAnswer={quizAnswer}
              quizCorrect={quizCorrect}
              safetyFocus={safetyFocus}
              onAnswer={(answer) => {
                if (quizAnswer === null && answer === quiz[quizIndex].answer) {
                  setQuizCorrect((score) => score + 1)
                }
                setQuizAnswer(answer)
              }}
              nextQuestion={() => {
                setQuizAnswer(null)
                setQuizIndex((index) => {
                  if (index + 1 === quiz.length) {
                    setQuizCorrect(0)
                    return 0
                  }
                  return index + 1
                })
              }}
            />
          )}
          {page === 'history' && (
            <HistoryPage history={history} notice={notice} removeRecord={removeRecord} clearHistory={clearHistory} />
          )}
          {page === 'settings' && (
            <SettingsPage
              online={online}
              installAvailable={Boolean(installPrompt)}
              installApp={installApp}
              clearHistory={clearHistory}
              notice={notice}
            />
          )}
          {page === 'emergency' && <EmergencyPage />}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            onClick={() => navigate(id)}
            className={page === id || (id === 'scan' && page === 'screenshot') ? 'active' : ''}
            aria-current={page === id || (id === 'scan' && page === 'screenshot') ? 'page' : undefined}
          >
            <Icon size={19} /><span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function HomePage({
  tip,
  history,
  navigate,
  chooseScan,
  openSafety,
  online,
}: {
  tip: (typeof tips)[number]
  history: ScanRecord[]
  navigate: (page: Page) => void
  chooseScan: (type: ScanType) => void
  openSafety: (focus?: string) => void
  online: boolean
}) {
  const recent = history.slice(0, 3)
  return (
    <div className="page home-page">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">YOUR DIGITAL SAFETY COMPANION</p>
          <h1>Pause. Check.<br />Then decide.</h1>
          <p className="lede">A simple way to review suspicious messages and links before you act.</p>
          <button className="button primary" type="button" onClick={() => chooseScan('message')}>
            Check for a scam <ArrowRight size={17} />
          </button>
        </div>
        <div className="welcome-art" aria-hidden="true"><Shield size={66} strokeWidth={1.4} /></div>
      </div>

      <section className="section-block">
        <SectionTitle title="Quick checks" subtitle="Choose what you want to review." />
        <div className="quick-grid">
          <QuickCard icon={MessageSquareText} title="Message" text="SMS, chat or email" onClick={() => chooseScan('message')} />
          <QuickCard icon={Globe} title="Website link" text="Check visible URL signs" onClick={() => chooseScan('url')} />
          <QuickCard icon={Upload} title="Screenshot" text="Extract text locally from an image" onClick={() => navigate('screenshot')} />
          <QuickCard icon={Smartphone} title="Audio" text="Audio scanning is not available yet" disabled />
        </div>
      </section>

      <div className="home-panels">
        <section className="tip-card">
          <div className="section-icon"><Shield size={18} /></div>
          <p className="eyebrow">TODAY’S SAFETY TIP</p>
          <h2>{tip.title}</h2>
          <p>{tip.detail}</p>
          <button type="button" className="text-button" onClick={() => openSafety()}>Visit Safety Hub <ChevronRight size={16} /></button>
        </section>
        <section className="recent-card">
          <div className="section-title-row"><SectionTitle title="Recent checks" /><button className="text-button" type="button" onClick={() => navigate('history')}>View all <ChevronRight size={15} /></button></div>
          {recent.length ? recent.map((record) => <HistoryRow key={record.id} record={record} />) : <p className="empty-copy">Your recent checks will appear here. The message itself is never saved.</p>}
        </section>
      </div>

      <div className="inline-help">
        <AlertTriangle size={18} />
        <span>Already sent money? Report it promptly.</span>
        <button type="button" onClick={() => navigate('emergency')}>Emergency help <ArrowRight size={15} /></button>
      </div>
      {!online && <p className="offline-note"><WifiOff size={15} /> You’re offline. Cached Safety Hub content is available; scanning needs the API connection.</p>}
    </div>
  )
}

function ScanPage({
  scanType,
  scanLanguage,
  input,
  result,
  notice,
  isAnalyzing,
  openSafety,
  setInput,
  setScanLanguage,
  setScanType,
  runScan,
  useExample,
  clear,
}: {
  scanType: ScanType
  scanLanguage: ScanLanguage
  input: string
  result: AnalysisResult | null
  notice: string
  isAnalyzing: boolean
  openSafety: (focus?: string) => void
  setInput: (value: string) => void
  setScanLanguage: (language: ScanLanguage) => void
  setScanType: (type: ScanType) => void
  runScan: () => void
  useExample: () => void
  clear: () => void
}) {
  const selected = scanOptions.find(({ type }) => type === scanType) ?? scanOptions[0]
  return (
    <div className="page">
      <PageHeading eyebrow="SCAM CHECK" title="Review a message or link" subtitle="Rule-based checks through FraudShield. No external AI or link opening." />
      <div className="scan-types" role="group" aria-label="Content type">
        {scanOptions.map(({ type, label }) => (
          <button key={type} type="button" className={scanType === type ? 'type-chip active' : 'type-chip'} onClick={() => setScanType(type)}>
            {label}
          </button>
        ))}
      </div>
      <section className="scan-form card">
        <div className="analysis-language">
          <label htmlFor="analysis-language">Analysis language</label>
          <select
            id="analysis-language"
            value={scanLanguage}
            onChange={(event) => setScanLanguage(event.target.value as ScanLanguage)}
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="ta">Tamil</option>
          </select>
          <span>Risk guidance follows your selection. Hindi and Tamil patterns have limited coverage.</span>
        </div>
        <label htmlFor="scan-input">{selected.label}</label>
        <textarea
          id="scan-input"
          value={input}
          maxLength={5000}
          onChange={(event) => setInput(event.target.value)}
          placeholder={selected.placeholder}
          rows={7}
        />
        <div className="input-meta"><span>Do not enter passwords, PINs or OTPs.</span><span>{input.length}/5,000</span></div>
        <div className="form-actions">
          <button type="button" className="button primary" onClick={runScan} disabled={isAnalyzing}>
            {isAnalyzing ? 'Checking…' : 'Check now'} {!isAnalyzing && <ArrowRight size={16} />}
          </button>
          <button type="button" className="button secondary" onClick={useExample}>Try fictional example</button>
          <button type="button" className="button-quiet" onClick={clear}>Clear</button>
        </div>
        <p className="privacy-line"><Shield size={14} /> Sent to your configured FraudShield API for rule checks. Text is not saved or sent to external AI.</p>
        {notice && <p className="notice" role="status">{notice}</p>}
      </section>
      {result && <ResultCard result={result} type={scanType} language={scanLanguage} openSafety={openSafety} />}
    </div>
  )
}

function ResultCard({ result, type, language, openSafety }: { result: AnalysisResult; type: ScanType; language: ScanLanguage; openSafety: (focus?: string) => void }) {
  const stateClass = result.level === 'High risk' ? 'high' : result.level === 'Caution' ? 'caution' : 'neutral'
  const evidence = result.indicators.join(' ')
  const paymentSignal = language === 'hi'
    ? /अनपेक्षित भुगतान/.test(evidence)
    : language === 'ta'
      ? /எதிர்பாராத கட்டணம்/.test(evidence)
      : /unexpected payment/.test(evidence)
  const jobSignal = language === 'hi'
    ? /नौकरी, इनाम/.test(evidence)
    : language === 'ta'
      ? /வேலை, பரிசு/.test(evidence)
      : /upfront fee/.test(evidence)
  const bankingSignal = language === 'hi'
    ? /गोपनीय कोड|किसी संस्था|बैंक/.test(evidence)
    : language === 'ta'
      ? /ரகசியக் குறியீடு|ஒரு நிறுவனம்|வங்கி/.test(evidence)
      : /secret code|credential|authority/i.test(evidence)
  const guideId = type === 'payment' || paymentSignal
    ? 'upi'
    : type === 'job' || jobSignal
      ? 'jobs'
      : type === 'url'
        ? 'phishing'
        : bankingSignal
          ? 'banking'
          : 'phishing'
  return (
    <section className={`result-panel ${stateClass}`} aria-live="polite">
      <div className="result-heading">
        <span className={`risk-mark ${stateClass}`}><ShieldAlert size={20} /></span>
        <div><p className="eyebrow">LOCAL RULE CHECK · {scanOptions.find((option) => option.type === type)?.label.toUpperCase()} · {language.toUpperCase()}</p><h2>{result.level}</h2></div>
      </div>
      <p className="result-summary">{result.summary}</p>
      <div className="result-columns">
        <div><h3>What we noticed</h3><ul>{result.indicators.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div><h3>What to do</h3><ul>{result.nextSteps.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </div>
      <button type="button" className="text-button contextual-guide" onClick={() => openSafety(guideId)}>
        Read a related safety guide <ChevronRight size={15} />
      </button>
      <p className="limitation">A local check cannot verify who sent this or whether a site is safe. “No obvious indicators” is not a safety guarantee.</p>
    </section>
  )
}

function SafetyPage({
  quizIndex,
  quizAnswer,
  quizCorrect,
  safetyFocus,
  onAnswer,
  nextQuestion,
}: {
  quizIndex: number
  quizAnswer: boolean | null
  quizCorrect: number
  safetyFocus: string | null
  onAnswer: (answer: boolean) => void
  nextQuestion: () => void
}) {
  const current = quiz[quizIndex]
  const focusedGuide = safetyGuides.find(({ id }) => id === safetyFocus)
  return (
    <div className="page">
      <PageHeading eyebrow="SAFETY HUB" title="Small habits, safer choices." subtitle="Practical guides for common scam situations." />
      <section className="hub-tip card">
        <div className="section-icon"><Shield size={18} /></div>
        <div><p className="eyebrow">REMEMBER</p><h2>Never share your OTP or UPI PIN.</h2><p>Your bank will not ask you to reveal either by call, message or link.</p></div>
      </section>
      <section className="featured-scam">
        <p className="eyebrow">FEATURED SCAM · FICTIONAL EXAMPLE</p>
        <h2>Fake customer-support refund</h2>
        <p>A fake support contact offers a refund, then asks you to install remote-access software or approve a payment request.</p>
        <button type="button" className="text-button" onClick={() => document.getElementById('guide-support')?.scrollIntoView({ behavior: 'smooth' })}>
          See how to protect yourself <ArrowRight size={15} />
        </button>
      </section>
      <section className="section-block">
        <SectionTitle title="Scam awareness library" subtitle="Select a guide to learn the warning signs and next steps." />
        {focusedGuide && <p className="guide-recommendation" role="status">Suggested from your scan: {focusedGuide.category}</p>}
        <div className="guide-grid">
          {safetyGuides.map((guide) => (
            <details className="guide-card" id={`guide-${guide.id}`} key={guide.id} open={guide.id === safetyFocus}>
              <summary><span>{guide.category}</span><strong>{guide.title}</strong><ChevronRight size={17} /></summary>
              <div className="guide-details">
                <GuidePart title="How it works" text={guide.mechanism} />
                <GuidePart title="Warning signs" text={guide.warningSigns} />
                <GuidePart title="Example · fictional" text={guide.example} />
                <GuidePart title="Protect yourself" text={guide.protect} />
                <GuidePart title="If affected" text={guide.ifAffected} />
                <a href="https://cybercrime.gov.in/" target="_blank" rel="noreferrer">Official cybercrime portal <ArrowRight size={13} /></a>
              </div>
            </details>
          ))}
        </div>
      </section>
      <section className="quiz-card card">
        <div className="quiz-heading"><div><p className="eyebrow">QUICK QUIZ · {quizIndex + 1} OF {quiz.length}</p><h2>Would you pause and verify?</h2></div><CircleHelp size={22} /></div>
        <div className="quiz-progress" role="progressbar" aria-label="Quiz progress" aria-valuenow={quizIndex + 1} aria-valuemin={1} aria-valuemax={quiz.length}><span style={{ width: `${((quizIndex + 1) / quiz.length) * 100}%` }} /></div>
        <p className="quiz-score">Correct answers: {quizCorrect}</p>
        <blockquote>{current.question}</blockquote>
        {quizAnswer === null ? (
          <div className="form-actions">
            <button type="button" className="button primary" onClick={() => onAnswer(true)}>Suspicious</button>
            <button type="button" className="button secondary" onClick={() => onAnswer(false)}>Looks routine</button>
          </div>
        ) : (
          <div className="quiz-feedback" role="status">
            <p><Check size={17} /> {quizAnswer === current.answer ? 'Good call.' : 'That’s okay—these can be tricky.'} {current.reason}</p>
            <button type="button" className="text-button" onClick={nextQuestion}>Next example <ArrowRight size={15} /></button>
          </div>
        )}
      </section>
      <p className="source-note">For urgent financial cyber fraud in India, call 1930 and use the official <a href="https://cybercrime.gov.in/" target="_blank" rel="noreferrer">National Cyber Crime Reporting Portal</a>.</p>
    </div>
  )
}

function HistoryPage({
  history,
  notice,
  removeRecord,
  clearHistory,
}: {
  history: ScanRecord[]
  notice: string
  removeRecord: (id: string) => void
  clearHistory: () => void
}) {
  return (
    <div className="page">
      <div className="heading-with-action">
        <PageHeading eyebrow="ON THIS DEVICE" title="Scan history" subtitle="Only scan type, result and time are saved. The content is not." />
        {history.length > 0 && <button className="button secondary" type="button" onClick={clearHistory}><Trash2 size={16} /> Clear all</button>}
      </div>
      <section className="card history-list">
        {history.length ? history.map((record) => (
          <div className="history-item" key={record.id}>
            <HistoryRow record={record} />
            <button className="icon-button" type="button" aria-label="Delete this scan" onClick={() => removeRecord(record.id)}><Trash2 size={16} /></button>
          </div>
        )) : <EmptyState title="No saved checks" detail="When you run a check, its result and time appear here—never the message itself." />}
      </section>
      {notice && <p className="notice" role="status">{notice}</p>}
    </div>
  )
}

function SettingsPage({
  online,
  installAvailable,
  installApp,
  clearHistory,
  notice,
}: {
  online: boolean
  installAvailable: boolean
  installApp: () => void
  clearHistory: () => void
  notice: string
}) {
  return (
    <div className="page">
      <PageHeading eyebrow="PREFERENCES" title="Settings & privacy" subtitle="No account needed. Your checks run locally." />
      <section className="settings-list card">
        <SettingRow icon={online ? Wifi : WifiOff} title="Connection" detail={online ? 'Online · Scan requests use your configured FraudShield API.' : 'Offline · Cached Safety Hub content remains available; scans require the API.'} />
        <SettingRow icon={Shield} title="Scan privacy" detail="Text is sent to your configured FraudShield API. The current backend does not persist content or use external AI." />
        <SettingRow icon={Globe} title="Language support" detail="English, Hindi and Tamil rule checks are available. Hindi/Tamil coverage is limited and not accuracy-tested; interface labels remain English." />
        <div className="setting-row">
          <span className="setting-icon"><Smartphone size={18} /></span>
          <div><strong>Install FraudShield</strong><p>Add the app to your home screen for quick access.</p></div>
          <button className="button secondary" type="button" onClick={installApp}>{installAvailable ? 'Install' : 'How to install'}</button>
        </div>
        <div className="setting-row">
          <span className="setting-icon"><Trash2 size={18} /></span>
          <div><strong>Saved history</strong><p>Delete all scan metadata stored by this browser.</p></div>
          <button className="button secondary" type="button" onClick={clearHistory}>Clear history</button>
        </div>
      </section>
      {notice && <p className="notice" role="status">{notice}</p>}
      <p className="source-note">This tool does not contact threat-intelligence services, use external AI, or guarantee that a message or site is safe.</p>
    </div>
  )
}

function EmergencyPage() {
  return (
    <div className="page">
      <PageHeading eyebrow="URGENT SUPPORT · INDIA" title="If you’ve lost money" subtitle="Act promptly. Recovery is not guaranteed." />
      <section className="emergency-callout">
        <span className="call-icon"><Phone size={22} /></span>
        <div><p className="eyebrow">CYBER FRAUD HELPLINE</p><h2>Call 1930</h2><p>Contact your bank or payment provider through its official app or website as soon as possible.</p></div>
        <a className="button primary" href="tel:1930">Call 1930</a>
      </section>
      <section className="section-block">
        <SectionTitle title="Do these steps now" />
        <div className="sign-list emergency-steps">
          <SignItem title="Stop contact" detail="Do not reply, transfer more money or share more codes." />
          <SignItem title="Secure accounts" detail="Ask your bank or payment provider to block or flag affected transactions." />
          <SignItem title="Save evidence" detail="Keep transaction IDs, receipts, messages and screenshots." />
          <SignItem title="Report the incident" detail="Call 1930 promptly and submit a report to the official portal." />
        </div>
      </section>
      <a className="portal-link" href="https://cybercrime.gov.in/" target="_blank" rel="noreferrer">
        Open cybercrime.gov.in <ArrowRight size={16} />
      </a>
      <p className="source-note">Use only official bank and government channels. FraudShield cannot freeze accounts or recover funds.</p>
    </div>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div className="section-title"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
}

function PageHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <header className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lede">{subtitle}</p></header>
}

function QuickCard({
  icon: Icon,
  title,
  text,
  onClick,
  disabled = false,
}: {
  icon: typeof MessageSquareText
  title: string
  text: string
  onClick?: () => void
  disabled?: boolean
}) {
  const content = <><span className="quick-icon"><Icon size={20} /></span><strong>{title}</strong><span className="quick-description">{text}</span>{disabled && <span className="coming-soon">Coming soon</span>}</>
  return disabled
    ? <div className="quick-card disabled" aria-disabled="true">{content}</div>
    : <button type="button" className="quick-card" onClick={onClick}>{content}<ArrowRight className="quick-arrow" size={16} /></button>
}

function SignItem({ title, detail }: { title: string; detail: string }) {
  return <article className="sign-item"><span className="sign-dot"><AlertTriangle size={16} /></span><div><strong>{title}</strong><p>{detail}</p></div></article>
}

function GuidePart({ title, text }: { title: string; text: string }) {
  return <div className="guide-part"><h3>{title}</h3><p>{text}</p></div>
}

function HistoryRow({ record }: { record: ScanRecord }) {
  const label = scanOptions.find(({ type }) => type === record.type)?.label ?? record.type
  const date = new Date(record.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  return <div className="history-row"><span className="history-icon"><ScanLine size={17} /></span><div className="history-details"><strong>{label}</strong><small>{date}</small></div><span className={`history-risk ${record.level === 'High risk' ? 'high' : record.level === 'Caution' ? 'caution' : ''}`}>{record.level}</span></div>
}

function SettingRow({ icon: Icon, title, detail }: { icon: typeof Wifi; title: string; detail: string }) {
  return <div className="setting-row"><span className="setting-icon"><Icon size={18} /></span><div><strong>{title}</strong><p>{detail}</p></div></div>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span><Clock3 size={22} /></span><h2>{title}</h2><p>{detail}</p></div>
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default App
