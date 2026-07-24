import { useEffect, useRef, useState } from 'react'

const ACCENT = '#7287d9'
const PANEL_BACKGROUND = '#1b1c21'

function ChatComposeWindow(): JSX.Element {
  const [englishText, setEnglishText] = useState('')
  const [thaiPreview, setThaiPreview] = useState('')
  const [backTranslationPreview, setBackTranslationPreview] = useState('')
  const [translating, setTranslating] = useState(false)
  const [sending, setSending] = useState(false)
  const inputReference = useRef<HTMLInputElement>(null)
  const debounceReference = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRequestReference = useRef(0)

  useEffect(() => {
    window.modManager.onChatComposeShown(() => {
      setEnglishText('')
      setThaiPreview('')
      setBackTranslationPreview('')
      inputReference.current?.focus()
    })
    inputReference.current?.focus()
  }, [])

  function updateEnglishText(nextText: string): void {
    setEnglishText(nextText)
    if (debounceReference.current) {
      clearTimeout(debounceReference.current)
    }
    if (nextText.trim() === '') {
      setThaiPreview('')
      setBackTranslationPreview('')
      setTranslating(false)
      return
    }
    setTranslating(true)
    debounceReference.current = setTimeout(async () => {
      const requestId = latestRequestReference.current + 1
      latestRequestReference.current = requestId
      const result = await window.modManager.translateForChatCompose(nextText)
      if (latestRequestReference.current === requestId) {
        setThaiPreview(result.thaiText)
        setBackTranslationPreview(result.backTranslation)
        setTranslating(false)
      }
    }, 400)
  }

  const readyToSend = !translating && !sending && thaiPreview !== ''

  async function sendToChannel(channelName: 'team' | 'all'): Promise<void> {
    if (!readyToSend) {
      return
    }
    setSending(true)
    try {
      await window.modManager.sendComposedChat(thaiPreview, channelName)
      setEnglishText('')
      setThaiPreview('')
      setBackTranslationPreview('')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent): void {
    if (event.key === 'Escape') {
      window.modManager.closeChatCompose()
    }
    if (event.key === 'Enter') {
      sendToChannel('team')
    }
  }

  return (
    <div className="flex h-screen items-stretch p-2">
      <div
        className="flex w-full flex-col gap-2 rounded-lg border border-white/20 p-3"
        style={{ backgroundColor: PANEL_BACKGROUND }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white">Translate to Thai chat</span>
          <span className="text-[11px] text-white">Enter sends to team. Esc closes.</span>
        </div>
        <input
          ref={inputReference}
          value={englishText}
          onChange={(event) => updateEnglishText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message in English"
          className="w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500"
        />
        <div className="min-h-[2.25rem] rounded-md bg-black/30 px-3 py-2 text-sm text-slate-300">
          {translating ? 'Translating...' : thaiPreview || 'Thai preview appears here'}
        </div>
        {backTranslationPreview && !translating && (
          <div className="rounded-md bg-black/20 px-3 py-1.5 text-xs text-slate-400">
            Reads back as: <span className="text-slate-300">{backTranslationPreview}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => sendToChannel('team')}
            disabled={!readyToSend}
            className="rounded-md px-4 py-1.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            Team Chat
          </button>
          <button
            onClick={() => sendToChannel('all')}
            disabled={!readyToSend}
            className="rounded-md bg-black/40 px-4 py-1.5 text-sm font-semibold text-slate-200 hover:text-white disabled:opacity-50"
          >
            All Chat
          </button>
          <button
            onClick={() => window.modManager.closeChatCompose()}
            className="ml-auto rounded-md px-4 py-1.5 text-sm font-semibold text-white hover:brightness-110"
            style={{ backgroundColor: '#d64c4c' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatComposeWindow
