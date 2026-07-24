import { BrowserWindow, app, globalShortcut, ipcMain, screen } from 'electron'
import { ChildProcess, spawn } from 'child_process'
import { join } from 'path'
import { existsSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { startDebugOutputListener, stopDebugOutputListener } from './gameDebugOutputListener'

export const CHAT_RELAY_CONSOLE_COMMAND = 'Set con_debugOutput true'

const CHAT_RELAY_ANCHOR =
  'function GameChat:AllChatMessages(messageType, channel, prefix, message, sender, senderName, entity, isMe, iconOverride)'

const CHAT_RELAY_HOOK_BODY = [
  '\tpcall(function()',
  "\t\tlocal relayText = tostring(prefix or '') .. tostring(message or '')",
  "\t\tif relayText == '' then return end",
  '\t\tif ChatTranslatorRelayDatabase == nil then',
  "\t\t\tChatTranslatorRelayDatabase = Database.New('ChatTranslatorRelay.ldb')",
  '\t\t\tChatTranslatorRelayCounter = 0',
  '\t\tend',
  '\t\tChatTranslatorRelayCounter = ChatTranslatorRelayCounter + 1',
  "\t\tlocal slot = 'entry' .. tostring(ChatTranslatorRelayCounter % 32)",
  "\t\tChatTranslatorRelayDatabase[slot] = tostring(ChatTranslatorRelayCounter) .. '|' .. tostring(messageType) .. '|' .. tostring(senderName or '') .. '|' .. relayText",
  '\t\tChatTranslatorRelayDatabase:Flush()',
  "\t\tlocal relayAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'",
  '\t\tlocal function relayEncode(input)',
  '\t\t\tlocal output = {}',
  '\t\t\tfor index = 1, #input, 3 do',
  '\t\t\t\tlocal byteOne = string.byte(input, index)',
  '\t\t\t\tlocal byteTwo = string.byte(input, index + 1)',
  '\t\t\t\tlocal byteThree = string.byte(input, index + 2)',
  '\t\t\t\tlocal chunk = byteOne * 65536 + (byteTwo or 0) * 256 + (byteThree or 0)',
  '\t\t\t\tlocal charFour = chunk % 64',
  '\t\t\t\tchunk = (chunk - charFour) / 64',
  '\t\t\t\tlocal charThree = chunk % 64',
  '\t\t\t\tchunk = (chunk - charThree) / 64',
  '\t\t\t\tlocal charTwo = chunk % 64',
  '\t\t\t\tchunk = (chunk - charTwo) / 64',
  '\t\t\t\tlocal charOne = chunk % 64',
  '\t\t\t\ttable.insert(output, string.sub(relayAlphabet, charOne + 1, charOne + 1))',
  '\t\t\t\ttable.insert(output, string.sub(relayAlphabet, charTwo + 1, charTwo + 1))',
  "\t\t\t\ttable.insert(output, byteTwo and string.sub(relayAlphabet, charThree + 1, charThree + 1) or '=')",
  "\t\t\t\ttable.insert(output, byteThree and string.sub(relayAlphabet, charFour + 1, charFour + 1) or '=')",
  '\t\t\tend',
  '\t\t\treturn table.concat(output)',
  '\t\tend',
  "\t\tEcho('HONCHATRELAY|' .. tostring(ChatTranslatorRelayCounter) .. '|' .. tostring(messageType) .. '|' .. relayEncode(tostring(senderName or '')) .. '|' .. relayEncode(relayText))",
  '\tend)'
].join('\n')

const CHAT_DEFINITIONS_ANCHOR = 'function GameChat:GetWidget(name)'

const CHAT_DEFINITIONS_BODY = [
  'function ChatTranslatorDecode(input)',
  '\tlocal alphabet = \'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/\'',
  '\tlocal charValues = {}',
  '\tfor index = 1, 64 do',
  '\t\tcharValues[string.sub(alphabet, index, index)] = index - 1',
  '\tend',
  "\tinput = string.gsub(input, '=', '')",
  '\tlocal bitCount = 0',
  '\tlocal accumulator = 0',
  '\tlocal output = {}',
  '\tfor index = 1, #input do',
  '\t\tlocal value = charValues[string.sub(input, index, index)]',
  '\t\tif value == nil then return \'\' end',
  '\t\taccumulator = accumulator * 64 + value',
  '\t\tbitCount = bitCount + 6',
  '\t\tif bitCount >= 8 then',
  '\t\t\tbitCount = bitCount - 8',
  '\t\t\tlocal byteValue = math.floor(accumulator / (2 ^ bitCount))',
  '\t\t\taccumulator = accumulator % (2 ^ bitCount)',
  '\t\t\ttable.insert(output, string.char(byteValue))',
  '\t\tend',
  '\tend',
  '\treturn table.concat(output)',
  'end',
  '',
  'function ChatTranslatorDeliver(originalEncoded, translatedEncoded)',
  '\tpcall(function()',
  '\t\tlocal originalText = ChatTranslatorDecode(originalEncoded)',
  '\t\tlocal translatedText = ChatTranslatorDecode(translatedEncoded)',
  "\t\tif originalText == '' or translatedText == '' then return end",
  '\t\tlocal replacedCount = 0',
  '\t\tfor index = 1, #GameChat.gameChat do',
  '\t\t\tlocal chatEntry = GameChat.gameChat[index]',
  "\t\t\tlocal combined = tostring(chatEntry.prefix or '') .. tostring(chatEntry.message or '')",
  '\t\t\tif combined == originalText then',
  "\t\t\t\tlocal headEnd = string.find(combined, '%^%*: [^%^]*$')",
  '\t\t\t\tif headEnd then',
  "\t\t\t\t\tchatEntry.prefix = string.sub(combined, 1, headEnd + 3) .. translatedText",
  '\t\t\t\telse',
  '\t\t\t\t\tchatEntry.prefix = translatedText',
  '\t\t\t\tend',
  "\t\t\t\tchatEntry.message = ''",
  '\t\t\t\treplacedCount = replacedCount + 1',
  '\t\t\tend',
  '\t\tend',
  '\t\tif replacedCount > 0 then',
  '\t\t\tlocal currentLine = GameChat:BuildChatTable(nil)',
  '\t\t\tGameChat.TransferChatTable(GameChat, currentLine, 0)',
  '\t\t\tGameChat:UpdateChatScroller()',
  '\t\tend',
  "\t\tEcho('HONCHATDELIVERED|' .. tostring(replacedCount))",
  '\tend)',
  'end',
  '',
  'function ChatTranslatorSend(encodedText, channelName)',
  '\tpcall(function()',
  '\t\tlocal messageText = ChatTranslatorDecode(encodedText)',
  "\t\tif messageText == '' then return end",
  "\t\tif channelName == 'team' then",
  '\t\t\tTeamChat(messageText)',
  '\t\telse',
  '\t\t\tAllChat(messageText)',
  '\t\tend',
  "\t\tEcho('HONCHATSENT|' .. tostring(channelName))",
  '\tend)',
  'end',
  '',
  'function ChatTranslatorPoll()',
  '\tChatTranslatorFrameCount = (ChatTranslatorFrameCount or 0) + 1',
  '\tif ChatTranslatorFrameCount % 20 ~= 0 then return end',
  '\tif ChatTranslatorPollAnnounced == nil then',
  '\t\tChatTranslatorPollAnnounced = true',
  "\t\tpcall(function() Echo('HONCHATPOLLALIVE') end)",
  '\tend',
  '\tpcall(function()',
  '\t\tlocal expected = ChatTranslatorNextInbox or 1',
  "\t\tpcall(function() runfile('#/ChatTranslatorInbox' .. tostring(expected) .. '.lua') end)",
  '\t\tif ChatTranslatorInboxLoaded ~= expected then',
  "\t\t\tpcall(function() runfile('~/ChatTranslatorInbox' .. tostring(expected) .. '.lua') end)",
  '\t\tend',
  '\t\tif ChatTranslatorInboxLoaded == expected then',
  '\t\t\tChatTranslatorNextInbox = expected + 1',
  '\t\tend',
  '\tend)',
  'end',
  ''
].join('\n')

export const chatRelayLuaEdits = [
  {
    targetPath: 'ui/scripts/game/chat.lua',
    find: CHAT_DEFINITIONS_ANCHOR,
    replace: CHAT_DEFINITIONS_BODY + '\n' + CHAT_DEFINITIONS_ANCHOR
  },
  {
    targetPath: 'ui/scripts/game/chat.lua',
    find: CHAT_RELAY_ANCHOR,
    replace: CHAT_RELAY_ANCHOR + '\n' + CHAT_RELAY_HOOK_BODY
  },
  {
    targetPath: 'ui/game_chat.interface',
    find: '<trigger name="MapChatMessage" />',
    replace:
      '<trigger name="MapChatMessage" />\n\t<panel width="1" height="1" color="invisible" noclick="1" onframelua="if ChatTranslatorPoll then ChatTranslatorPoll() end" />'
  }
]

const RELAY_LINE_PATTERN = /HONCHATRELAY\|(\d+)\|([^|]*)\|([A-Za-z0-9+/=]*)\|([A-Za-z0-9+/=]*)/
const THAI_CHARACTER_PATTERN = new RegExp('[\\u0E00-\\u0E7F]')
const COLOR_CODE_PATTERN = /\^\d{1,3}|\^\*|\^;|\^[A-Za-z]/g
const OVERLAY_MESSAGE_LIMIT = 6
const OVERLAY_WINDOW_ENABLED = false

let overlayWindow: BrowserWindow | null = null
let translationActive = false
let messageCounter = 0
let lastRelayCounter = 0
let inboxFileIndex = 0
const recentMessageTimes = new Map<string, number>()
const DUPLICATE_WINDOW_MILLISECONDS = 3000

function decodeRelayField(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf8')
}

function modProfileDirectory(): string | null {
  const candidates = [
    join(app.getPath('documents'), 'Juvio', 'mods'),
    join(app.getPath('home'), 'Documents', 'Juvio', 'mods'),
    join(app.getPath('home'), 'OneDrive', 'Documents', 'Juvio', 'mods')
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

function clearInboxFiles(): void {
  const profileDirectory = modProfileDirectory()
  if (!profileDirectory) {
    return
  }
  for (const entryName of readdirSync(profileDirectory)) {
    if (/^ChatTranslatorInbox\d+\.lua$/.test(entryName)) {
      rmSync(join(profileDirectory, entryName), { force: true })
    }
  }
}

const INBOX_FILE_LIFETIME_MILLISECONDS = 20000

function writeInboxFile(inboxLines: string[]): void {
  const profileDirectory = modProfileDirectory()
  if (!profileDirectory) {
    return
  }
  inboxFileIndex += 1
  const inboxPath = join(profileDirectory, 'ChatTranslatorInbox' + inboxFileIndex + '.lua')
  writeFileSync(inboxPath, ['ChatTranslatorInboxLoaded = ' + inboxFileIndex, ...inboxLines, ''].join('\n'))
  setTimeout(() => {
    rmSync(inboxPath, { force: true })
  }, INBOX_FILE_LIFETIME_MILLISECONDS)
}

function writeTranslationInbox(originalRelayText: string, translatedText: string): void {
  const markedTranslation = '^458[T]^* ' + translatedText
  const originalEncoded = Buffer.from(originalRelayText, 'utf8').toString('base64')
  const translatedEncoded = Buffer.from(markedTranslation, 'utf8').toString('base64')
  writeInboxFile([
    "if ChatTranslatorDeliver then ChatTranslatorDeliver('" + originalEncoded + "', '" + translatedEncoded + "') end"
  ])
}

function writeChatSendInbox(thaiText: string, channelName: 'team' | 'all'): void {
  const textEncoded = Buffer.from(thaiText, 'utf8').toString('base64')
  writeInboxFile(["if ChatTranslatorSend then ChatTranslatorSend('" + textEncoded + "', '" + channelName + "') end"])
}

function extractChatBody(relayText: string): string {
  const bodySeparatorIndex = relayText.lastIndexOf('^*: ')
  const rawBody = bodySeparatorIndex >= 0 ? relayText.slice(bodySeparatorIndex + 4) : relayText
  return rawBody.replace(COLOR_CODE_PATTERN, '').trim()
}

async function translateText(messageText: string, targetLanguage: string): Promise<string> {
  const requestUrl =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
    targetLanguage +
    '&dt=t&q=' +
    encodeURIComponent(messageText)
  const response = await fetch(requestUrl)
  if (!response.ok) {
    throw new Error('Translation request failed with status ' + response.status)
  }
  const payload = (await response.json()) as unknown[]
  const segments = Array.isArray(payload) && Array.isArray(payload[0]) ? (payload[0] as unknown[][]) : []
  return segments
    .map((segment) => (Array.isArray(segment) ? String(segment[0] ?? '') : ''))
    .join('')
    .trim()
}

async function translateToEnglish(messageText: string): Promise<string> {
  return translateText(messageText, 'en')
}

function createOverlayWindow(): void {
  if (overlayWindow) {
    return
  }
  const workArea = screen.getPrimaryDisplay().workArea
  const overlayWidth = 460
  const overlayHeight = 340
  const window = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: workArea.x + 12,
    y: workArea.y + Math.round(workArea.height * 0.32),
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setIgnoreMouseEvents(true)
  const rendererDevServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererDevServerUrl) {
    window.loadURL(rendererDevServerUrl + '#chat-translation-overlay')
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'chat-translation-overlay' })
  }
  window.on('closed', () => {
    if (overlayWindow === window) {
      overlayWindow = null
    }
  })
  overlayWindow = window
}

let composeWindow: BrowserWindow | null = null

function createComposeWindow(): void {
  if (composeWindow) {
    return
  }
  const workArea = screen.getPrimaryDisplay().workArea
  const composeWidth = 520
  const composeHeight = 226
  const window = new BrowserWindow({
    width: composeWidth,
    height: composeHeight,
    x: workArea.x + Math.round((workArea.width - composeWidth) / 2),
    y: workArea.y + Math.round(workArea.height * 0.6),
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  window.setAlwaysOnTop(true, 'screen-saver')
  const rendererDevServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererDevServerUrl) {
    window.loadURL(rendererDevServerUrl + '#chat-compose')
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'chat-compose' })
  }
  window.on('closed', () => {
    if (composeWindow === window) {
      composeWindow = null
    }
  })
  composeWindow = window
}

function focusGameWindow(): void {
  const focusScript =
    "$gameProcess = Get-Process juvio -ErrorAction SilentlyContinue | Select-Object -First 1; if ($gameProcess) { (New-Object -ComObject WScript.Shell).AppActivate($gameProcess.Id) }"
  spawn('powershell.exe', ['-NoProfile', '-Command', focusScript], {
    stdio: 'ignore',
    windowsHide: true
  })
}

function hideComposeAndRefocusGame(): void {
  composeWindow?.hide()
  focusGameWindow()
}

function toggleComposeWindow(): void {
  if (!composeWindow) {
    return
  }
  if (composeWindow.isVisible()) {
    hideComposeAndRefocusGame()
  } else {
    composeWindow.show()
    composeWindow.focus()
    composeWindow.webContents.send('chatCompose:shown')
  }
}

export function registerChatComposeHandlers(): void {
  ipcMain.handle('chatCompose:translate', async (_event, englishText: string) => {
    if (typeof englishText !== 'string' || englishText.trim() === '') {
      return { thaiText: '', backTranslation: '' }
    }
    try {
      const thaiText = await translateText(englishText.trim(), 'th')
      if (!thaiText) {
        return { thaiText: '', backTranslation: '' }
      }
      let backTranslation = ''
      try {
        backTranslation = await translateText(thaiText, 'en')
      } catch {
        backTranslation = ''
      }
      return { thaiText, backTranslation }
    } catch {
      return { thaiText: '', backTranslation: '' }
    }
  })

  ipcMain.handle('chatCompose:send', (_event, thaiText: string, channelName: string) => {
    if (typeof thaiText !== 'string' || thaiText.trim() === '') {
      return false
    }
    writeChatSendInbox(thaiText.trim(), channelName === 'all' ? 'all' : 'team')
    hideComposeAndRefocusGame()
    return true
  })

  ipcMain.handle('chatCompose:close', () => {
    hideComposeAndRefocusGame()
    return true
  })
}

function handleDebugOutputLine(_processId: number, line: string): void {
  const match = RELAY_LINE_PATTERN.exec(line)
  if (!match) {
    return
  }
  const relayCounter = parseInt(match[1], 10)
  const messageType = match[2]
  const senderName = decodeRelayField(match[3])
  if (relayCounter === lastRelayCounter) {
    return
  }
  if (relayCounter < lastRelayCounter) {
    inboxFileIndex = 0
    clearInboxFiles()
  }
  lastRelayCounter = relayCounter
  const relayText = decodeRelayField(match[4])
  const originalText = extractChatBody(relayText)
  if (!THAI_CHARACTER_PATTERN.test(originalText)) {
    return
  }
  const now = Date.now()
  const duplicateKey = originalText
  const previousTime = recentMessageTimes.get(duplicateKey)
  if (previousTime !== undefined && now - previousTime < DUPLICATE_WINDOW_MILLISECONDS) {
    return
  }
  recentMessageTimes.set(duplicateKey, now)
  for (const [key, seenTime] of recentMessageTimes) {
    if (now - seenTime > DUPLICATE_WINDOW_MILLISECONDS) {
      recentMessageTimes.delete(key)
    }
  }
  messageCounter += 1
  const messageId = messageCounter
  translateToEnglish(originalText)
    .then((translatedText) => {
      if (!translationActive || !translatedText) {
        return
      }
      writeTranslationInbox(relayText, translatedText)
      overlayWindow?.webContents.send('chatTranslation:message', {
        id: messageId,
        messageType,
        senderName,
        originalText,
        translatedText,
        receivedAt: Date.now(),
        displayLimit: OVERLAY_MESSAGE_LIMIT
      })
    })
    .catch(() => {})
}

export function startThaiChatTranslation(gameProcess: ChildProcess | null): void {
  if (translationActive) {
    return
  }
  translationActive = true
  lastRelayCounter = 0
  inboxFileIndex = 0
  clearInboxFiles()
  if (OVERLAY_WINDOW_ENABLED) {
    createOverlayWindow()
  }
  createComposeWindow()
  globalShortcut.register('Control+T', toggleComposeWindow)
  startDebugOutputListener(handleDebugOutputLine)
  gameProcess?.once('exit', () => {
    stopThaiChatTranslation()
  })
}

export function stopThaiChatTranslation(): void {
  if (!translationActive) {
    return
  }
  translationActive = false
  globalShortcut.unregister('Control+T')
  stopDebugOutputListener()
  if (overlayWindow) {
    overlayWindow.close()
    overlayWindow = null
  }
  if (composeWindow) {
    composeWindow.close()
    composeWindow = null
  }
}
