import { useEffect, useState } from 'react'

const MESSAGE_LIFETIME_MILLISECONDS = 30000
const ACCENT = '#7287d9'

function ChatTranslationOverlay(): JSX.Element {
  const [messages, setMessages] = useState<ChatTranslationMessage[]>([])

  useEffect(() => {
    window.modManager.onChatTranslationMessage((message) => {
      setMessages((current) => [...current, message].slice(-message.displayLimit))
    })
    const pruneTimer = setInterval(() => {
      const cutoff = Date.now() - MESSAGE_LIFETIME_MILLISECONDS
      setMessages((current) => current.filter((message) => message.receivedAt > cutoff))
    }, 1000)
    return () => clearInterval(pruneTimer)
  }, [])

  return (
    <div className="flex h-screen flex-col justify-end gap-1.5 overflow-hidden p-2">
      {messages.map((message) => (
        <div key={message.id} className="rounded-md border border-white/10 bg-black/80 px-3 py-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold" style={{ color: ACCENT }}>
              {message.senderName}
            </span>
            <span className="truncate text-[10px] text-slate-500">{message.originalText}</span>
          </div>
          <p className="text-sm leading-snug text-white">{message.translatedText}</p>
        </div>
      ))}
    </div>
  )
}

export default ChatTranslationOverlay
