import { BrowserWindow, app, globalShortcut, ipcMain, screen } from 'electron'
import { ChildProcess, spawn } from 'child_process'
import { join } from 'path'
import { appendFileSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { startDebugOutputListener, stopDebugOutputListener } from './gameDebugOutputListener'
import { whenGameFullyExits } from './juvioLauncher'

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

const CHANNEL_DEFINITIONS_ANCHOR = 'function ProcessMessage(prefix, message, sender, allow)'

const CHANNEL_DEFINITIONS_BODY = [
  "ChannelTranslatorAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'",
  '',
  'function ChannelTranslatorEncode(input)',
  '\tlocal output = {}',
  '\tfor index = 1, #input, 3 do',
  '\t\tlocal byteOne = string.byte(input, index)',
  '\t\tlocal byteTwo = string.byte(input, index + 1)',
  '\t\tlocal byteThree = string.byte(input, index + 2)',
  '\t\tlocal chunk = byteOne * 65536 + (byteTwo or 0) * 256 + (byteThree or 0)',
  '\t\tlocal charFour = chunk % 64',
  '\t\tchunk = (chunk - charFour) / 64',
  '\t\tlocal charThree = chunk % 64',
  '\t\tchunk = (chunk - charThree) / 64',
  '\t\tlocal charTwo = chunk % 64',
  '\t\tchunk = (chunk - charTwo) / 64',
  '\t\tlocal charOne = chunk % 64',
  '\t\ttable.insert(output, string.sub(ChannelTranslatorAlphabet, charOne + 1, charOne + 1))',
  '\t\ttable.insert(output, string.sub(ChannelTranslatorAlphabet, charTwo + 1, charTwo + 1))',
  "\t\ttable.insert(output, byteTwo and string.sub(ChannelTranslatorAlphabet, charThree + 1, charThree + 1) or '=')",
  "\t\ttable.insert(output, byteThree and string.sub(ChannelTranslatorAlphabet, charFour + 1, charFour + 1) or '=')",
  '\tend',
  '\treturn table.concat(output)',
  'end',
  '',
  'function ChannelTranslatorDecode(input)',
  '\tlocal charValues = {}',
  '\tfor index = 1, 64 do',
  '\t\tcharValues[string.sub(ChannelTranslatorAlphabet, index, index)] = index - 1',
  '\tend',
  "\tinput = string.gsub(input, '=', '')",
  '\tlocal bitCount = 0',
  '\tlocal accumulator = 0',
  '\tlocal output = {}',
  '\tfor index = 1, #input do',
  '\t\tlocal value = charValues[string.sub(input, index, index)]',
  "\t\tif value == nil then return '' end",
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
  'function ChannelTranslatorDeliver(prefixEncoded, messageEncoded, translatedEncoded)',
  '\tpcall(function()',
  '\t\tlocal originalPrefix = ChannelTranslatorDecode(prefixEncoded)',
  '\t\tlocal originalMessage = ChannelTranslatorDecode(messageEncoded)',
  '\t\tlocal translatedText = ChannelTranslatorDecode(translatedEncoded)',
  "\t\tif translatedText == '' then return end",
  '\t\tlocal replacedCount = 0',
  '\t\tfor _, channelHistory in pairs(Communicator.channelHistories) do',
  '\t\t\tfor index = 1, #channelHistory do',
  '\t\t\t\tlocal entry = channelHistory[index]',
  '\t\t\t\tif entry.prefix == originalPrefix and entry.message == originalMessage then',
  '\t\t\t\t\tentry.message = translatedText',
  '\t\t\t\t\treplacedCount = replacedCount + 1',
  '\t\t\t\tend',
  '\t\t\tend',
  '\t\tend',
  '\t\tif replacedCount > 0 then',
  '\t\t\tpcall(function() Communicator:ReloadChannel() end)',
  '\t\tend',
  "\t\tEcho('HONCHANDELIVERED|' .. tostring(replacedCount))",
  '\tend)',
  'end',
  '',
  'function ChannelTranslatorPoll()',
  '\tChannelTranslatorFrameCount = (ChannelTranslatorFrameCount or 0) + 1',
  '\tif ChannelTranslatorFrameCount % 20 ~= 0 then return end',
  '\tif ChannelTranslatorPollAnnounced == nil then',
  '\t\tChannelTranslatorPollAnnounced = true',
  "\t\tpcall(function() Echo('HONCHANPOLLALIVE') end)",
  '\tend',
  '\tpcall(function()',
  '\t\tlocal expected = ChannelTranslatorNextInbox or 1',
  "\t\tpcall(function() runfile('#/ChannelTranslatorInbox' .. tostring(expected) .. '.lua') end)",
  '\t\tif ChannelTranslatorInboxLoaded ~= expected then',
  "\t\t\tpcall(function() runfile('~/ChannelTranslatorInbox' .. tostring(expected) .. '.lua') end)",
  '\t\tend',
  '\t\tif ChannelTranslatorInboxLoaded == expected then',
  '\t\t\tChannelTranslatorNextInbox = expected + 1',
  '\t\tend',
  '\tend)',
  'end',
  '',
  'function ChannelTranslatorAttachPoll()',
  '\tif ChannelTranslatorPollAttached then return end',
  '\tlocal pollFunction = function() ChannelTranslatorPoll() end',
  '\tlocal candidateWidgets = {}',
  '\tpcall(function() if communicator_chatbuffer then table.insert(candidateWidgets, communicator_chatbuffer) end end)',
  '\tpcall(function() if communicator_lobby_chatbuffer then table.insert(candidateWidgets, communicator_lobby_chatbuffer) end end)',
  '\tpcall(function() if Communicator.chatBuffer then table.insert(candidateWidgets, Communicator.chatBuffer) end end)',
  '\tfor index = 1, #candidateWidgets do',
  '\t\tif not ChannelTranslatorPollAttached then',
  '\t\t\tpcall(function()',
  "\t\t\t\tcandidateWidgets[index]:SetCallback('onframe', pollFunction)",
  '\t\t\t\tChannelTranslatorPollAttached = true',
  '\t\t\tend)',
  '\t\tend',
  '\tend',
  '\tif ChannelTranslatorPollAttached then',
  "\t\tpcall(function() Echo('HONCHANPOLLATTACHED') end)",
  '\telse',
  "\t\tpcall(function() Echo('HONCHANPOLLFAILED') end)",
  '\tend',
  'end',
  '',
  'ChannelTranslatorAttachPoll()',
  ''
].join('\n')

const CHANNEL_RELAY_ANCHOR = 'function Communicator:AddMessage(channelName, prefix, message, sender)'

const CHANNEL_RELAY_HOOK_BODY = [
  '\tpcall(function() ChannelTranslatorAttachPoll() end)',
  '\tpcall(function()',
  "\t\tlocal relayContent = tostring(prefix or '') .. tostring(message or '')",
  "\t\tif relayContent == '' then return end",
  '\t\tChannelTranslatorRelayCounter = (ChannelTranslatorRelayCounter or 0) + 1',
  "\t\tEcho('HONCHANRELAY|' .. tostring(ChannelTranslatorRelayCounter) .. '|' .. ChannelTranslatorEncode(tostring(channelName or '')) .. '|' .. ChannelTranslatorEncode(tostring(sender or '')) .. '|' .. ChannelTranslatorEncode(tostring(prefix or '')) .. '|' .. ChannelTranslatorEncode(tostring(message or '')))",
  '\tend)'
].join('\n')

export const chatRelayLuaEdits = [
  {
    targetPath: 'ui/scripts/fe3/communicator.lua',
    find: CHANNEL_DEFINITIONS_ANCHOR,
    replace: CHANNEL_DEFINITIONS_BODY + '\n' + CHANNEL_DEFINITIONS_ANCHOR
  },
  {
    targetPath: 'ui/scripts/fe3/communicator.lua',
    find: CHANNEL_RELAY_ANCHOR,
    replace: CHANNEL_RELAY_ANCHOR + '\n' + CHANNEL_RELAY_HOOK_BODY
  },
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

let translationTargetLanguage: 'en' | 'th' = 'en'

const RELAY_LINE_PATTERN = /HONCHATRELAY\|(\d+)\|([^|]*)\|([A-Za-z0-9+/=]*)\|([A-Za-z0-9+/=]*)/
const CHANNEL_RELAY_LINE_PATTERN =
  /HONCHANRELAY\|(\d+)\|([A-Za-z0-9+/=]*)\|([A-Za-z0-9+/=]*)\|([A-Za-z0-9+/=]*)\|([A-Za-z0-9+/=]*)/
const THAI_CHARACTER_PATTERN = new RegExp('[\\u0E00-\\u0E7F]')
const COLOR_CODE_PATTERN = /\^\d{1,3}|\^\*|\^;|\^[A-Za-z]/g
const OVERLAY_MESSAGE_LIMIT = 6
const OVERLAY_WINDOW_ENABLED = false

let overlayWindow: BrowserWindow | null = null
let translationActive = false
let messageCounter = 0
let lastRelayCounter = 0
let inboxFileIndex = 0
let lastChannelRelayCounter = 0
let channelInboxFileIndex = 0
const recentMessageTimes = new Map<string, number>()
const recentChannelMessageTimes = new Map<string, number>()
const persistentTranslationCache = new Map<string, string>()
let persistentCacheLoaded = false
let cacheSaveTimer: ReturnType<typeof setTimeout> | null = null
const DUPLICATE_WINDOW_MILLISECONDS = 3000
const TRANSLATION_CACHE_MAXIMUM_BYTES = 20 * 1024 * 1024
const TRANSLATION_CALL_GAP_MILLISECONDS = 300

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

function clearChannelInboxFiles(): void {
  const profileDirectory = modProfileDirectory()
  if (!profileDirectory) {
    return
  }
  for (const entryName of readdirSync(profileDirectory)) {
    if (/^ChannelTranslatorInbox\d+\.lua$/.test(entryName)) {
      rmSync(join(profileDirectory, entryName), { force: true })
    }
  }
}

function writeChannelTranslationInbox(prefixRaw: string, messageRaw: string, translatedText: string): void {
  const profileDirectory = modProfileDirectory()
  if (!profileDirectory) {
    return
  }
  channelInboxFileIndex += 1
  const markedTranslation = '^458[T]^* ' + translatedText
  const prefixEncoded = Buffer.from(prefixRaw, 'utf8').toString('base64')
  const messageEncoded = Buffer.from(messageRaw, 'utf8').toString('base64')
  const translatedEncoded = Buffer.from(markedTranslation, 'utf8').toString('base64')
  const inboxPath = join(profileDirectory, 'ChannelTranslatorInbox' + channelInboxFileIndex + '.lua')
  const inboxLines = [
    'ChannelTranslatorInboxLoaded = ' + channelInboxFileIndex,
    "if ChannelTranslatorDeliver then ChannelTranslatorDeliver('" +
      prefixEncoded +
      "', '" +
      messageEncoded +
      "', '" +
      translatedEncoded +
      "') end",
    ''
  ]
  writeFileSync(inboxPath, inboxLines.join('\n'))
  setTimeout(() => {
    rmSync(inboxPath, { force: true })
  }, INBOX_FILE_LIFETIME_MILLISECONDS)
}

function translationCachePath(): string {
  return join(app.getPath('userData'), 'translation-cache.json')
}

function loadPersistentCache(): void {
  if (persistentCacheLoaded) {
    return
  }
  persistentCacheLoaded = true
  try {
    const cachePath = translationCachePath()
    if (!existsSync(cachePath)) {
      return
    }
    if (statSync(cachePath).size > TRANSLATION_CACHE_MAXIMUM_BYTES) {
      rmSync(cachePath, { force: true })
      return
    }
    const stored = JSON.parse(readFileSync(cachePath, 'utf8')) as Record<string, string>
    for (const [original, translated] of Object.entries(stored)) {
      if (typeof translated === 'string') {
        persistentTranslationCache.set(original, translated)
      }
    }
  } catch {
    persistentTranslationCache.clear()
  }
}

function scheduleCacheSave(): void {
  if (cacheSaveTimer) {
    return
  }
  cacheSaveTimer = setTimeout(() => {
    cacheSaveTimer = null
    try {
      const serialized = JSON.stringify(Object.fromEntries(persistentTranslationCache))
      if (serialized.length > TRANSLATION_CACHE_MAXIMUM_BYTES) {
        persistentTranslationCache.clear()
        rmSync(translationCachePath(), { force: true })
        return
      }
      writeFileSync(translationCachePath(), serialized)
    } catch {}
  }, 2000)
}

export function clearTranslationCache(): void {
  persistentTranslationCache.clear()
  rmSync(translationCachePath(), { force: true })
}

export function translationCacheInfo(): { entryCount: number; sizeBytes: number } {
  loadPersistentCache()
  const cachePath = translationCachePath()
  const sizeBytes = existsSync(cachePath) ? statSync(cachePath).size : 0
  return { entryCount: persistentTranslationCache.size, sizeBytes }
}

function waitMilliseconds(duration: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, duration))
}

let translationCallChain: Promise<unknown> = Promise.resolve()

function rateLimitedTranslate(messageText: string): Promise<string> {
  const callPromise = translationCallChain.then(async () => {
    try {
      return await translateText(messageText, translationTargetLanguage)
    } catch {
      await waitMilliseconds(1000)
      return await translateText(messageText, translationTargetLanguage)
    }
  })
  translationCallChain = callPromise.then(
    () => waitMilliseconds(TRANSLATION_CALL_GAP_MILLISECONDS),
    () => waitMilliseconds(TRANSLATION_CALL_GAP_MILLISECONDS)
  )
  return callPromise
}

async function translateWithCache(messageText: string): Promise<string> {
  loadPersistentCache()
  const cacheKey = translationTargetLanguage + '|' + messageText
  const cached = persistentTranslationCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }
  const translatedText = await rateLimitedTranslate(messageText)
  if (translatedText) {
    persistentTranslationCache.set(cacheKey, translatedText)
    scheduleCacheSave()
  }
  return translatedText
}

function extractChatBody(relayText: string): string {
  const bodySeparatorIndex = relayText.lastIndexOf('^*: ')
  const rawBody = bodySeparatorIndex >= 0 ? relayText.slice(bodySeparatorIndex + 4) : relayText
  return rawBody.replace(COLOR_CODE_PATTERN, '').trim()
}

const LATIN_WORD_PATTERN = /[A-Za-z]{2,}/

function needsTranslation(messageText: string): boolean {
  if (messageText.startsWith('[T]')) {
    return false
  }
  if (translationTargetLanguage === 'en') {
    return THAI_CHARACTER_PATTERN.test(messageText)
  }
  return LATIN_WORD_PATTERN.test(messageText) && !THAI_CHARACTER_PATTERN.test(messageText)
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
  ipcMain.handle('chatCompose:mode', () => translationTargetLanguage)

  ipcMain.handle('chatCompose:translate', async (_event, inputText: string) => {
    if (typeof inputText !== 'string' || inputText.trim() === '') {
      return { thaiText: '', backTranslation: '' }
    }
    const outgoingLanguage = translationTargetLanguage === 'en' ? 'th' : 'en'
    try {
      const thaiText = await translateText(inputText.trim(), outgoingLanguage)
      if (!thaiText) {
        return { thaiText: '', backTranslation: '' }
      }
      let backTranslation = ''
      try {
        backTranslation = await translateText(thaiText, translationTargetLanguage)
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

  ipcMain.handle('chatTranslation:cacheInfo', () => translationCacheInfo())

  ipcMain.handle('chatTranslation:clearCache', () => {
    clearTranslationCache()
    return true
  })
}

function handleChannelRelayLine(line: string): boolean {
  const match = CHANNEL_RELAY_LINE_PATTERN.exec(line)
  if (!match) {
    return false
  }
  const relayCounter = parseInt(match[1], 10)
  if (relayCounter === lastChannelRelayCounter) {
    return true
  }
  if (relayCounter < lastChannelRelayCounter) {
    channelInboxFileIndex = 0
    clearChannelInboxFiles()
  }
  lastChannelRelayCounter = relayCounter
  const prefixRaw = decodeRelayField(match[4])
  const messageRaw = decodeRelayField(match[5])
  const cleanMessage = messageRaw.replace(COLOR_CODE_PATTERN, '').trim()
  if (!needsTranslation(cleanMessage)) {
    return true
  }
  const now = Date.now()
  const previousTime = recentChannelMessageTimes.get(prefixRaw + '|' + messageRaw)
  if (previousTime !== undefined && now - previousTime < DUPLICATE_WINDOW_MILLISECONDS) {
    return true
  }
  recentChannelMessageTimes.set(prefixRaw + '|' + messageRaw, now)
  for (const [key, seenTime] of recentChannelMessageTimes) {
    if (now - seenTime > DUPLICATE_WINDOW_MILLISECONDS) {
      recentChannelMessageTimes.delete(key)
    }
  }
  translateWithCache(cleanMessage)
    .then((translatedText) => {
      if (!translationActive || !translatedText) {
        return
      }
      writeChannelTranslationInbox(prefixRaw, messageRaw, translatedText)
    })
    .catch(() => {})
  return true
}

function handleDebugOutputLine(_processId: number, line: string): void {
  if (line.includes('HONCHA')) {
    try {
      appendFileSync(join(app.getPath('userData'), 'relay-debug.log'), new Date().toISOString() + ' ' + line + '\n')
    } catch {}
  }
  if (handleChannelRelayLine(line)) {
    return
  }
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
  if (!needsTranslation(originalText)) {
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
  translateWithCache(originalText)
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

export function startThaiChatTranslation(gameProcess: ChildProcess | null, targetLanguage: 'en' | 'th' = 'en'): void {
  if (translationActive) {
    return
  }
  translationActive = true
  translationTargetLanguage = targetLanguage
  lastRelayCounter = 0
  inboxFileIndex = 0
  lastChannelRelayCounter = 0
  channelInboxFileIndex = 0
  clearInboxFiles()
  clearChannelInboxFiles()
  if (OVERLAY_WINDOW_ENABLED) {
    createOverlayWindow()
  }
  createComposeWindow()
  globalShortcut.register('Control+T', toggleComposeWindow)
  startDebugOutputListener(handleDebugOutputLine)
  if (gameProcess) {
    whenGameFullyExits(gameProcess, () => {
      stopThaiChatTranslation()
    })
  }
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
