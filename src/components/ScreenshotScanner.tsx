import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Image, LoaderCircle, Shield, Upload } from 'lucide-react'
import Tesseract from 'tesseract.js'
import type { ScanLanguage, ScanType } from '../lib/types'

type OcrLanguage = 'eng' | 'hin' | 'tam'
const apiLanguage: Record<OcrLanguage, ScanLanguage> = {
  eng: 'en',
  hin: 'hi',
  tam: 'ta',
}

const languageNames: Record<OcrLanguage, string> = {
  eng: 'English',
  hin: 'Hindi',
  tam: 'Tamil',
}

const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_IMAGE_PIXELS = 24_000_000
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function ScreenshotScanner({
  onAnalyze,
  notice,
}: {
  onAnalyze: (text: string, type: ScanType, language: ScanLanguage) => Promise<void>
  notice: string
}) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [language, setLanguage] = useState<OcrLanguage>('eng')
  const [extractedText, setExtractedText] = useState('')
  const [ocrMessage, setOcrMessage] = useState('')
  const [progress, setProgress] = useState(0)
  const [isReading, setIsReading] = useState(false)
  const [consent, setConsent] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const chooseFile = (selected: File | undefined) => {
    setExtractedText('')
    setConsent(false)
    setOcrMessage('')
    setProgress(0)
    if (!selected) return
    if (!SUPPORTED_IMAGE_TYPES.has(selected.type)) {
      setFile(null)
      setPreviewUrl('')
      setOcrMessage('Choose a JPEG, PNG, or WebP image.')
      return
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFile(null)
      setPreviewUrl('')
      setOcrMessage('This image is over the 8 MB limit. Choose a smaller image.')
      return
    }
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
  }

  const extractText = async () => {
    if (!file) return
    setIsReading(true)
    setOcrMessage('Checking image dimensions before local OCR…')
    setProgress(0)
    let worker: Awaited<ReturnType<typeof Tesseract.createWorker>> | undefined
    try {
      const bitmap = await createImageBitmap(file)
      const pixels = bitmap.width * bitmap.height
      bitmap.close()
      if (pixels > MAX_IMAGE_PIXELS) {
        setOcrMessage('This image has too many pixels for a safe local scan. Choose a smaller or lower-resolution image.')
        return
      }

      setOcrMessage(`Reading text locally with the ${languageNames[language]} model…`)
      worker = await Tesseract.createWorker(language, Tesseract.OEM.LSTM_ONLY, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/core',
        langPath: '/ocr',
        gzip: true,
        cachePath: `fraudshield-ocr-${language}-v1`,
        cacheMethod: 'write',
        workerBlobURL: false,
        logger: (event) => {
          if (typeof event.progress === 'number') {
            setProgress(Math.round(event.progress * 100))
          }
        },
      })
      const { data } = await worker.recognize(file)
      const text = data.text.trim().slice(0, 5000)
      setExtractedText(text)
      setConsent(false)
      setOcrMessage(
        text
          ? 'Review and correct the extracted text. No image was uploaded.'
          : 'No readable text was found. Try a clearer, well-lit image.',
      )
    } catch (error) {
      console.error('Local screenshot OCR failed.', error)
      setOcrMessage('Text extraction failed. Check that the local OCR assets are available, or choose another image.')
    } finally {
      if (worker) {
        try {
          await worker.terminate()
        } catch (error) {
          console.error('Unable to terminate the local OCR worker.', error)
          setOcrMessage('OCR finished, but its worker could not be shut down cleanly. Reload before scanning another image.')
        }
      }
      setIsReading(false)
    }
  }

  const analyzeReviewedText = async () => {
    const text = extractedText.trim()
    if (!text || !consent) return
    setIsAnalyzing(true)
    try {
      await onAnalyze(text, 'message', apiLanguage[language])
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="page">
      <header className="page-heading">
        <p className="eyebrow">SCREENSHOT CHECK</p>
        <h1>Review text from an image</h1>
        <p className="lede">Text is extracted in your browser. You review it before choosing to send the text to the FraudShield API.</p>
      </header>

      <section className="scan-form card">
        <label htmlFor="screenshot-file">Choose a screenshot</label>
        <input
          ref={inputRef}
          id="screenshot-file"
          className="file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={() => inputRef.current?.click()} disabled={isReading}>
            <Upload size={16} /> Choose image
          </button>
          {file && <span className="selected-file"><Image size={15} /> {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span>}
        </div>
        <p className="input-meta">JPEG, PNG or WebP · maximum 8 MB · one image at a time</p>

        {previewUrl && (
          <div className="screenshot-preview">
            <img src={previewUrl} alt="Preview of the selected screenshot" />
          </div>
        )}

        <label className="ocr-language" htmlFor="ocr-language">Text language</label>
        <select
          id="ocr-language"
          value={language}
          onChange={(event) => {
            setLanguage(event.target.value as OcrLanguage)
            setExtractedText('')
            setConsent(false)
          }}
          disabled={isReading}
        >
          {(Object.keys(languageNames) as OcrLanguage[]).map((code) => (
            <option value={code} key={code}>{languageNames[code]}</option>
          ))}
        </select>

        <button type="button" className="button primary" onClick={extractText} disabled={!file || isReading}>
          {isReading ? <><LoaderCircle className="spin" size={16} /> Extracting… {progress}%</> : 'Extract text on this device'}
        </button>
        {ocrMessage && <p className="notice" role="status">{ocrMessage}</p>}

        {extractedText && (
          <div className="ocr-review">
            <label htmlFor="ocr-text">Review extracted text</label>
            <textarea
              id="ocr-text"
              rows={7}
              maxLength={5000}
              value={extractedText}
              onChange={(event) => {
                setExtractedText(event.target.value)
                setConsent(false)
              }}
            />
            <div className="input-meta"><span>Correct OCR mistakes before analysis.</span><span>{extractedText.length}/5,000</span></div>
            <label className="consent-row">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span>I reviewed this text and want to send this text (not the image) to the configured FraudShield API for checking.</span>
            </label>
            <button type="button" className="button primary" disabled={!consent || !extractedText.trim() || isAnalyzing} onClick={analyzeReviewedText}>
              {isAnalyzing ? 'Checking…' : 'Analyze reviewed text'} {!isAnalyzing && <ArrowRight size={16} />}
            </button>
          </div>
        )}
        {notice && <p className="notice" role="status">{notice}</p>}
        <p className="privacy-line"><Shield size={14} /> Images are never sent to the API or stored by FraudShield. OCR runs locally using bundled models.</p>
      </section>
    </div>
  )
}
