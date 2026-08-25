import { BrowserWindow, app, globalShortcut, ipcMain, screen, shell } from 'electron'
import { ChildProcess, spawn } from 'child_process'
import { join } from 'path'
import { appendFileSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { startDebugOutputListener, stopDebugOutputListener } from './gameDebugOutputListener'
import { whenGameFullyExits } from './juvioLauncher'
import { logLine } from './managerLogger'

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
  'ChatTranslatorAppliedSequences = ChatTranslatorAppliedSequences or {}',
  '',
  'function ChatTranslatorApply(sequenceNumber, applyCallback)',
  '\tif ChatTranslatorAppliedSequences[sequenceNumber] then return end',
  '\tChatTranslatorAppliedSequences[sequenceNumber] = true',
  '\tpcall(applyCallback)',
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
  "\t\tlocal inboxFileName = 'ChatTranslatorInbox.lua'",
  '\t\tlocal canCheckFiles = Testing and Testing.FileExists',
  "\t\tif not canCheckFiles or Testing.FileExists('#/' .. inboxFileName) then",
  "\t\t\tpcall(function() runfile('#/' .. inboxFileName) end)",
  "\t\telseif canCheckFiles and Testing.FileExists('~/' .. inboxFileName) then",
  "\t\t\tpcall(function() runfile('~/' .. inboxFileName) end)",
  '\t\tend',
  '\tend)',
  'end',
  '',
  "ChatTranslatorAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'",
  '',
  'function ChatTranslatorEncode(input)',
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
  '\t\ttable.insert(output, string.sub(ChatTranslatorAlphabet, charOne + 1, charOne + 1))',
  '\t\ttable.insert(output, string.sub(ChatTranslatorAlphabet, charTwo + 1, charTwo + 1))',
  "\t\ttable.insert(output, byteTwo and string.sub(ChatTranslatorAlphabet, charThree + 1, charThree + 1) or '=')",
  "\t\ttable.insert(output, byteThree and string.sub(ChatTranslatorAlphabet, charFour + 1, charFour + 1) or '=')",
  '\tend',
  '\treturn table.concat(output)',
  'end',
  '',
  'function ChatWhisperTranslatorDeliver(prefixEncoded, messageEncoded, translatedEncoded)',
  '\tpcall(function()',
  '\t\tlocal originalPrefix = ChatTranslatorDecode(prefixEncoded)',
  '\t\tlocal originalMessage = ChatTranslatorDecode(messageEncoded)',
  '\t\tlocal translatedText = ChatTranslatorDecode(translatedEncoded)',
  "\t\tif translatedText == '' then return end",
  '\t\tlocal replacedCount = 0',
  '\t\tfor index = 1, #GameChat.gameChat do',
  '\t\t\tlocal chatEntry = GameChat.gameChat[index]',
  "\t\t\tif tostring(chatEntry.prefix or '') == originalPrefix and tostring(chatEntry.message or '') == originalMessage then",
  '\t\t\t\tchatEntry.message = translatedText',
  '\t\t\t\treplacedCount = replacedCount + 1',
  '\t\t\tend',
  '\t\tend',
  '\t\tif replacedCount > 0 then',
  '\t\t\tlocal currentLine = GameChat:BuildChatTable(nil)',
  '\t\t\tGameChat.TransferChatTable(GameChat, currentLine, 0)',
  '\t\t\tGameChat:UpdateChatScroller()',
  '\t\tend',
  "\t\tEcho('HONWHISPERDELIVERED|' .. tostring(replacedCount))",
  '\tend)',
  'end',
  ''
].join('\n')

const WHISPER_RELAY_ANCHOR =
  "\ttable.insert(GameChat.gameChat,  { messageType = messageType, soundMessageType = messageType, channel = '', prefix = prefix, message = message, sender = sender, entity = '', hosttime = hosttime, playerIndex = '', team = 1, senderName = senderName, userTag = userTag, isBuddy = isBuddy, isMe = isMe} )"

const WHISPER_RELAY_HOOK_BODY = [
  '\tpcall(function()',
  '\t\tif ChatTranslatorEncode == nil then return end',
  '\t\tlocal whisperEntry = GameChat.gameChat[#GameChat.gameChat]',
  '\t\tif whisperEntry == nil then return end',
  "\t\tlocal whisperPrefix = tostring(whisperEntry.prefix or '')",
  "\t\tlocal whisperMessage = tostring(whisperEntry.message or '')",
  "\t\tif whisperMessage == '' then return end",
  '\t\tChatWhisperRelayCounter = (ChatWhisperRelayCounter or 0) + 1',
  "\t\tEcho('HONWHISPERRELAY|' .. tostring(ChatWhisperRelayCounter) .. '|' .. ChatTranslatorEncode(tostring(senderName or '')) .. '|' .. ChatTranslatorEncode(whisperPrefix) .. '|' .. ChatTranslatorEncode(whisperMessage))",
  '\tend)'
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
  "\t\t\t\t\tif originalMessage == '' then",
  "\t\t\t\t\t\tlocal headEnd = string.find(originalPrefix, '%^%*: [^%^]*$')",
  '\t\t\t\t\t\tif headEnd then',
  '\t\t\t\t\t\t\tentry.prefix = string.sub(originalPrefix, 1, headEnd + 3) .. translatedText',
  '\t\t\t\t\t\telse',
  '\t\t\t\t\t\t\tentry.prefix = translatedText',
  '\t\t\t\t\t\tend',
  '\t\t\t\t\telse',
  '\t\t\t\t\t\tentry.message = translatedText',
  '\t\t\t\t\tend',
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
  'ChannelTranslatorAppliedSequences = ChannelTranslatorAppliedSequences or {}',
  '',
  'function ChannelTranslatorApply(sequenceNumber, applyCallback)',
  '\tif ChannelTranslatorAppliedSequences[sequenceNumber] then return end',
  '\tChannelTranslatorAppliedSequences[sequenceNumber] = true',
  '\tpcall(applyCallback)',
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
  "\t\tlocal inboxFileName = 'ChannelTranslatorInbox.lua'",
  '\t\tlocal canCheckFiles = Testing and Testing.FileExists',
  "\t\tif not canCheckFiles or Testing.FileExists('#/' .. inboxFileName) then",
  "\t\t\tpcall(function() runfile('#/' .. inboxFileName) end)",
  "\t\telseif canCheckFiles and Testing.FileExists('~/' .. inboxFileName) then",
  "\t\t\tpcall(function() runfile('~/' .. inboxFileName) end)",
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
  '\t\tpcall(function()',
  "\t\t\tcandidateWidgets[index]:SetCallback('onframe', pollFunction)",
  '\t\t\tChannelTranslatorPollAttached = true',
  '\t\tend)',
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

const SOCIAL_IM_DEFINITIONS_ANCHOR = 'function Social_IM:RefreshCurrentChat()'

const SOCIAL_IM_DEFINITIONS_BODY = [
  'function SocialImTranslatorDeliver(prefixEncoded, messageEncoded, translatedEncoded)',
  '\tpcall(function()',
  '\t\tif ChannelTranslatorDecode == nil then return end',
  '\t\tlocal originalPrefix = ChannelTranslatorDecode(prefixEncoded)',
  '\t\tlocal originalMessage = ChannelTranslatorDecode(messageEncoded)',
  '\t\tlocal translatedText = ChannelTranslatorDecode(translatedEncoded)',
  "\t\tif translatedText == '' then return end",
  '\t\tlocal replacedCount = 0',
  '\t\tfor _, chatHistory in pairs(Social_IM.chatHistories) do',
  "\t\t\tif type(chatHistory) == 'table' then",
  '\t\t\t\tfor index = 1, #chatHistory do',
  '\t\t\t\t\tlocal entry = chatHistory[index]',
  "\t\t\t\t\tif type(entry) == 'table' and entry.prefix == originalPrefix and entry.message == originalMessage then",
  '\t\t\t\t\t\tentry.message = translatedText',
  '\t\t\t\t\t\treplacedCount = replacedCount + 1',
  '\t\t\t\t\tend',
  '\t\t\t\tend',
  '\t\t\tend',
  '\t\tend',
  '\t\tif replacedCount > 0 then',
  '\t\t\tpcall(function() Social_IM:RefreshCurrentChat() end)',
  '\t\tend',
  "\t\tEcho('HONIMDELIVERED|' .. tostring(replacedCount))",
  '\tend)',
  'end',
  ''
].join('\n')

const SOCIAL_IM_RELAY_ANCHOR =
  '\t\ttable.insert(Social_IM.chatHistories[lName], {prefix = prefix, message = message, sender = sender})'

const SOCIAL_IM_RELAY_HOOK_BODY = [
  '\t\tpcall(function()',
  '\t\t\tif ChannelTranslatorEncode == nil then return end',
  "\t\t\tlocal privateMessage = tostring(message or '')",
  "\t\t\tif privateMessage == '' then return end",
  '\t\t\tSocialImRelayCounter = (SocialImRelayCounter or 0) + 1',
  "\t\t\tEcho('HONIMRELAY|' .. tostring(SocialImRelayCounter) .. '|' .. ChannelTranslatorEncode(tostring(name or '')) .. '|' .. ChannelTranslatorEncode(tostring(sender or '')) .. '|' .. ChannelTranslatorEncode(tostring(prefix or '')) .. '|' .. ChannelTranslatorEncode(privateMessage))",
  '\t\tend)'
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
    targetPath: 'ui/scripts/game/chat.lua',
    find: WHISPER_RELAY_ANCHOR,
    replace: WHISPER_RELAY_ANCHOR + '\n' + WHISPER_RELAY_HOOK_BODY
  },
  {
    targetPath: 'ui/scripts/fe3/social_im.lua',
    find: SOCIAL_IM_DEFINITIONS_ANCHOR,
    replace: SOCIAL_IM_DEFINITIONS_BODY + '\n' + SOCIAL_IM_DEFINITIONS_ANCHOR
  },
  {
    targetPath: 'ui/scripts/fe3/social_im.lua',
    find: SOCIAL_IM_RELAY_ANCHOR,
    replace: SOCIAL_IM_RELAY_ANCHOR + '\n' + SOCIAL_IM_RELAY_HOOK_BODY
  },
  {
    targetPath: 'ui/game_chat.interface',
    find: '<trigger name="MapChatMessage" />',
    replace:
      '<trigger name="MapChatMessage" />\n\t<panel width="1" height="1" color="invisible" noclick="1" onframelua="if ChatTranslatorPoll then ChatTranslatorPoll() end" />'
  },
  {
    targetPath: 'ui/fe3/main.interface',
    find: '<include file="/ui/fe3/triggers.package" />',
    replace:
      '<include file="/ui/fe3/triggers.package" />\n\t<panel width="1" height="1" color="invisible" noclick="1" onframelua="if ChannelTranslatorPoll then ChannelTranslatorPoll() end" />'
  }
]

let translationTargetLanguage: 'en' | 'th' = 'en'

const RELAY_LINE_PATTERN = /HONCHATRELAY\|(\d+)\|([^|]*)\|([A-Za-z0-9+/=]*)\|([A-Za-z0-9+/=]*)/
const CHANNEL_RELAY_LINE_PATTERN =
  /HONCHANRELAY\|(\d+)\|([A-Za-z0-9+/=]*)\|([A-Za-z0-9+/=]*)\|([A-Za-z0-9+/=]*)\|([A-Za-z0-9+/=]*)/
const WHISPER_RELAY_LINE_PATTERN =
  /HONWHISPERRELAY\|(\d+)\|([A-Za-z0-9+/=]*)\|([A-Za-z0-9+/=]*)\|([A-Za-z0-9+/=]*)/
const PRIVATE_MESSAGE_RELAY_LINE_PATTERN =
  /HONIMRELAY\|(\d+)\|([A-Za-z0-9+/=]*)\|([A-Za-z0-9+/=]*)\|([A-Za-z0-9+/=]*)\|([A-Za-z0-9+/=]*)/
const THAI_CHARACTER_PATTERN = new RegExp('[\\u0E00-\\u0E7F]')
const COLOR_CODE_PATTERN = /\^\d{1,3}|\^\*|\^;|\^[A-Za-z]/g
const OVERLAY_MESSAGE_LIMIT = 6
const OVERLAY_WINDOW_ENABLED = false

let overlayWindow: BrowserWindow | null = null
let translationActive = false
let sawAnyRelayLine = false
let relayWatchdogTimer: NodeJS.Timeout | null = null
let messageCounter = 0
let lastRelayCounter = 0
let lastChannelRelayCounter = 0
let lastWhisperRelayCounter = 0
let lastPrivateMessageRelayCounter = 0
const recentWhisperTimes = new Map<string, number>()
const recentPrivateMessageTimes = new Map<string, number>()
let pendingDuplicateText = ''
let pendingDuplicateCounter = 0
let pendingDuplicateTime = 0
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
  chatInboxEntries = []
  writeFileSync(join(profileDirectory, 'ChatTranslatorInbox.lua'), INBOX_READY_MARKER_LINE + '\n')
  for (const entryName of readdirSync(profileDirectory)) {
    if (/^ChatTranslatorInbox\d+\.lua$/.test(entryName)) {
      rmSync(join(profileDirectory, entryName), { force: true })
    }
  }
}

const INBOX_READY_MARKER_LINE = 'ChatTranslatorInboxOk = true'
const INBOX_ENTRY_LIFETIME_MILLISECONDS = 120000
const INBOX_ENTRY_LIMIT = 20

type InboxEntry = { sequence: number; luaCall: string; time: number }

let chatInboxSequence = 0
let channelInboxSequence = 0
let chatInboxEntries: InboxEntry[] = []
let channelInboxEntries: InboxEntry[] = []

function pruneInboxEntries(entries: InboxEntry[]): InboxEntry[] {
  const now = Date.now()
  return entries.filter((entry) => now - entry.time < INBOX_ENTRY_LIFETIME_MILLISECONDS).slice(-INBOX_ENTRY_LIMIT)
}

function rewriteInboxFile(fileName: string, applyFunctionName: string, entries: InboxEntry[]): void {
  const profileDirectory = modProfileDirectory()
  if (!profileDirectory) {
    return
  }
  const inboxPath = join(profileDirectory, fileName)
  const fileLines = [INBOX_READY_MARKER_LINE].concat(
    entries.map(
      (entry) =>
        'if ' + applyFunctionName + ' then ' + applyFunctionName + '(' + entry.sequence + ', function() ' + entry.luaCall + ' end) end'
    )
  )
  writeFileSync(inboxPath, fileLines.join('\n') + '\n')
}

const inboxWriteTimes = new Map<number, { time: number; kind: 'chat' | 'channel' }>()

// Entries the game never confirms would otherwise pile up for the whole session, and only the
// recent ones say anything about whether delivery is working right now.
function pruneUnconfirmedDeliveries(): void {
  const now = Date.now()
  for (const [sequence, writeRecord] of inboxWriteTimes) {
    if (now - writeRecord.time > INBOX_ENTRY_LIFETIME_MILLISECONDS) {
      inboxWriteTimes.delete(sequence)
    }
  }
}

const DELIVERY_RETRY_LIMIT = 2
const DELIVERY_RETRY_DELAY_MILLISECONDS = 2500
const DELIVERY_RETRY_MAX_AGE_MILLISECONDS = 30000
let lastDelivery: {
  kind: 'chat' | 'channel'
  luaCall: string
  attempts: number
  queuedAt: number
  retryPending: boolean
} | null = null

function dropDeliveryInboxEntries(luaCall: string): void {
  const chatCountBefore = chatInboxEntries.length
  chatInboxEntries = chatInboxEntries.filter((entry) => entry.luaCall !== luaCall)
  if (chatInboxEntries.length !== chatCountBefore) {
    rewriteInboxFile('ChatTranslatorInbox.lua', 'ChatTranslatorApply', chatInboxEntries)
  }
  const channelCountBefore = channelInboxEntries.length
  channelInboxEntries = channelInboxEntries.filter((entry) => entry.luaCall !== luaCall)
  if (channelInboxEntries.length !== channelCountBefore) {
    rewriteInboxFile('ChannelTranslatorInbox.lua', 'ChannelTranslatorApply', channelInboxEntries)
  }
}

function retryLastDelivery(): void {
  const pending = lastDelivery
  if (!pending) {
    return
  }
  const pendingAge = Date.now() - pending.queuedAt
  if (pendingAge > DELIVERY_RETRY_MAX_AGE_MILLISECONDS) {
    logLine(
      'translation',
      'the chat line to replace was queued ' +
        Math.round(pendingAge / 1000) +
        's ago in an earlier game phase and its chat history is gone, dropping it without retry'
    )
    lastDelivery = null
    dropDeliveryInboxEntries(pending.luaCall)
    return
  }
  if (pending.attempts >= DELIVERY_RETRY_LIMIT) {
    logLine('translation', 'the chat line to replace was gone, giving up after ' + pending.attempts + ' retries')
    lastDelivery = null
    dropDeliveryInboxEntries(pending.luaCall)
    noteDeliveryMissed()
    return
  }
  if (pending.retryPending) {
    return
  }
  pending.attempts += 1
  pending.retryPending = true
  logLine('translation', 'the chat line to replace was not found, retry ' + pending.attempts)
  setTimeout(() => {
    pending.retryPending = false
    if (!translationActive || lastDelivery !== pending) {
      return
    }
    if (pending.kind === 'chat') {
      queueChatInboxLine(pending.luaCall)
    } else {
      queueChannelInboxLine(pending.luaCall)
    }
  }, DELIVERY_RETRY_DELAY_MILLISECONDS)
}

function queueChatInboxLine(luaCall: string, retryWhenMissed: boolean = true): void {
  if (retryWhenMissed) {
    lastDelivery =
      lastDelivery && lastDelivery.luaCall === luaCall
        ? lastDelivery
        : { kind: 'chat', luaCall, attempts: 0, queuedAt: Date.now(), retryPending: false }
  } else {
    lastDelivery = null
  }
  pruneUnconfirmedDeliveries()
  chatInboxSequence += 1
  inboxWriteTimes.set(chatInboxSequence, { time: Date.now(), kind: 'chat' })
  chatInboxEntries.push({ sequence: chatInboxSequence, luaCall, time: Date.now() })
  chatInboxEntries = pruneInboxEntries(chatInboxEntries)
  rewriteInboxFile('ChatTranslatorInbox.lua', 'ChatTranslatorApply', chatInboxEntries)
  logLine('translation', 'chat inbox written, sequence ' + chatInboxSequence + ', pending entries ' + chatInboxEntries.length)
}

function queueChannelInboxLine(luaCall: string): void {
  lastDelivery =
    lastDelivery && lastDelivery.luaCall === luaCall
      ? lastDelivery
      : { kind: 'channel', luaCall, attempts: 0, queuedAt: Date.now(), retryPending: false }
  pruneUnconfirmedDeliveries()
  channelInboxSequence += 1
  inboxWriteTimes.set(channelInboxSequence, { time: Date.now(), kind: 'channel' })
  channelInboxEntries.push({ sequence: channelInboxSequence, luaCall, time: Date.now() })
  channelInboxEntries = pruneInboxEntries(channelInboxEntries)
  rewriteInboxFile('ChannelTranslatorInbox.lua', 'ChannelTranslatorApply', channelInboxEntries)
  logLine('translation', 'channel inbox written, sequence ' + channelInboxSequence + ', pending entries ' + channelInboxEntries.length)
}

function writeTranslationInbox(originalRelayText: string, translatedText: string): void {
  const markedTranslation = '^458[T]^* ' + translatedText
  const originalEncoded = Buffer.from(originalRelayText, 'utf8').toString('base64')
  const translatedEncoded = Buffer.from(markedTranslation, 'utf8').toString('base64')
  queueChatInboxLine("if ChatTranslatorDeliver then ChatTranslatorDeliver('" + originalEncoded + "', '" + translatedEncoded + "') end")
}

function writeChatSendInbox(thaiText: string, channelName: 'team' | 'all'): void {
  const textEncoded = Buffer.from(thaiText, 'utf8').toString('base64')
  queueChatInboxLine("if ChatTranslatorSend then ChatTranslatorSend('" + textEncoded + "', '" + channelName + "') end", false)
}

function dropAppliedInboxEntry(sequence: number): void {
  const chatBefore = chatInboxEntries.length
  chatInboxEntries = chatInboxEntries.filter((entry) => entry.sequence !== sequence)
  if (chatInboxEntries.length !== chatBefore) {
    rewriteInboxFile('ChatTranslatorInbox.lua', 'ChatTranslatorApply', chatInboxEntries)
    return
  }
  const channelBefore = channelInboxEntries.length
  channelInboxEntries = channelInboxEntries.filter((entry) => entry.sequence !== sequence)
  if (channelInboxEntries.length !== channelBefore) {
    rewriteInboxFile('ChannelTranslatorInbox.lua', 'ChannelTranslatorApply', channelInboxEntries)
  }
}

function dropSentChatInboxEntries(): void {
  const before = chatInboxEntries.length
  chatInboxEntries = chatInboxEntries.filter((entry) => !entry.luaCall.includes('ChatTranslatorSend('))
  if (chatInboxEntries.length !== before) {
    rewriteInboxFile('ChatTranslatorInbox.lua', 'ChatTranslatorApply', chatInboxEntries)
    logLine('translation', 'sent chat removed from the inbox so a reload cannot send it again')
  }
}

function clearChannelInboxFiles(): void {
  const profileDirectory = modProfileDirectory()
  if (!profileDirectory) {
    return
  }
  channelInboxEntries = []
  writeFileSync(join(profileDirectory, 'ChannelTranslatorInbox.lua'), INBOX_READY_MARKER_LINE + '\n')
  for (const entryName of readdirSync(profileDirectory)) {
    if (/^ChannelTranslatorInbox\d+\.lua$/.test(entryName)) {
      rmSync(join(profileDirectory, entryName), { force: true })
    }
  }
}

function writeChannelTranslationInbox(prefixRaw: string, messageRaw: string, translatedText: string): void {
  const markedTranslation = '^458[T]^* ' + translatedText
  const prefixEncoded = Buffer.from(prefixRaw, 'utf8').toString('base64')
  const messageEncoded = Buffer.from(messageRaw, 'utf8').toString('base64')
  const translatedEncoded = Buffer.from(markedTranslation, 'utf8').toString('base64')
  queueChannelInboxLine(
    "if ChannelTranslatorDeliver then ChannelTranslatorDeliver('" +
      prefixEncoded +
      "', '" +
      messageEncoded +
      "', '" +
      translatedEncoded +
      "') end"
  )
}

function writeWhisperTranslationInbox(prefixRaw: string, messageRaw: string, translatedText: string): void {
  const markedTranslation = '^458[T]^* ' + translatedText
  const prefixEncoded = Buffer.from(prefixRaw, 'utf8').toString('base64')
  const messageEncoded = Buffer.from(messageRaw, 'utf8').toString('base64')
  const translatedEncoded = Buffer.from(markedTranslation, 'utf8').toString('base64')
  queueChatInboxLine(
    "if ChatWhisperTranslatorDeliver then ChatWhisperTranslatorDeliver('" +
      prefixEncoded +
      "', '" +
      messageEncoded +
      "', '" +
      translatedEncoded +
      "') end"
  )
}

function writePrivateMessageTranslationInbox(prefixRaw: string, messageRaw: string, translatedText: string): void {
  const markedTranslation = '^458[T]^* ' + translatedText
  const prefixEncoded = Buffer.from(prefixRaw, 'utf8').toString('base64')
  const messageEncoded = Buffer.from(messageRaw, 'utf8').toString('base64')
  const translatedEncoded = Buffer.from(markedTranslation, 'utf8').toString('base64')
  queueChannelInboxLine(
    "if SocialImTranslatorDeliver then SocialImTranslatorDeliver('" +
      prefixEncoded +
      "', '" +
      messageEncoded +
      "', '" +
      translatedEncoded +
      "') end"
  )
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
  logLine('translation', 'cache cleared by user')
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

export type TranslationHealthStatus =
  | 'off'
  | 'idle'
  | 'waiting'
  | 'listening'
  | 'healthy'
  | 'degraded'
  | 'failing'

export type TranslationHealth = {
  status: TranslationHealthStatus
  detailKey: string
  detailParams: Record<string, string | number>
  sessionActive: boolean
  relaySeen: boolean
  translatedCount: number
  failedCount: number
  consecutiveFailures: number
  lastFailureReason: string
  lastSuccessAt: number
  lastFailureAt: number
  coolingDownProviders: string[]
}

const RELAY_SILENCE_MILLISECONDS = 90000
const DELIVERY_SILENCE_MILLISECONDS = 45000
const FAILING_FAILURE_STREAK = 3
const FAILING_DELIVERY_MISSES = 3
const DEGRADED_FAILURE_WINDOW_MILLISECONDS = 2 * 60 * 1000

let sessionStartedAt = 0
let translatedCount = 0
let failedCount = 0
let consecutiveFailures = 0
let lastSuccessAt = 0
let lastFailureAt = 0
let lastFailureReason = ''
let lastDeliveryConfirmedAt = 0
let consecutiveDeliveryMisses = 0
let healthChangeListener: (() => void) | null = null

export function onTranslationHealthChanged(listener: () => void): void {
  healthChangeListener = listener
}

function reportHealthChange(): void {
  try {
    healthChangeListener?.()
  } catch {}
}

function resetHealthCounters(): void {
  sessionStartedAt = Date.now()
  translatedCount = 0
  failedCount = 0
  consecutiveFailures = 0
  lastSuccessAt = 0
  lastFailureAt = 0
  lastFailureReason = ''
  lastDeliveryConfirmedAt = 0
  consecutiveDeliveryMisses = 0
  inboxWriteTimes.clear()
}

// The game echoes how many chat lines a delivery replaced. Anything above zero proves the whole
// path works, so it clears the pending writes we cannot match up by sequence number.
function noteDeliveryConfirmed(): void {
  lastDeliveryConfirmedAt = Date.now()
  consecutiveDeliveryMisses = 0
  inboxWriteTimes.clear()
  reportHealthChange()
}

function noteDeliveryMissed(): void {
  consecutiveDeliveryMisses += 1
  reportHealthChange()
}

function noteTranslationSuccess(): void {
  translatedCount += 1
  consecutiveFailures = 0
  lastSuccessAt = Date.now()
  reportHealthChange()
}

const FAILURE_REASON_LIMIT = 140

function noteTranslationFailure(reason: string): void {
  failedCount += 1
  consecutiveFailures += 1
  lastFailureAt = Date.now()
  lastFailureReason = reason.length > FAILURE_REASON_LIMIT ? reason.slice(0, FAILURE_REASON_LIMIT) + '...' : reason
  reportHealthChange()
}

function coolingDownProviderNames(): string[] {
  const now = Date.now()
  return translationProviders.filter((provider) => provider.blockedUntil > now).map((provider) => provider.name)
}

function oldestUnconfirmedDeliveryAt(): number {
  let oldest = 0
  for (const writeRecord of inboxWriteTimes.values()) {
    if (writeRecord.kind !== 'chat') {
      continue
    }
    if (oldest === 0 || writeRecord.time < oldest) {
      oldest = writeRecord.time
    }
  }
  return oldest
}

export function chatTranslationHealth(featureEnabled: boolean): TranslationHealth {
  const now = Date.now()
  const coolingDown = coolingDownProviderNames()
  const health: TranslationHealth = {
    status: 'off',
    detailKey: 'healthOffDetail',
    detailParams: {},
    sessionActive: translationActive,
    relaySeen: sawAnyRelayLine,
    translatedCount,
    failedCount,
    consecutiveFailures,
    lastFailureReason,
    lastSuccessAt,
    lastFailureAt,
    coolingDownProviders: coolingDown
  }
  if (!featureEnabled) {
    return health
  }
  if (!translationActive) {
    health.status = 'idle'
    health.detailKey = 'healthIdleDetail'
    return health
  }
  if (!sawAnyRelayLine) {
    const silentFor = now - sessionStartedAt
    health.status = silentFor >= RELAY_SILENCE_MILLISECONDS ? 'failing' : 'waiting'
    health.detailKey = silentFor >= RELAY_SILENCE_MILLISECONDS ? 'healthNoRelayDetail' : 'healthWaitingDetail'
    return health
  }
  if (consecutiveFailures >= FAILING_FAILURE_STREAK) {
    health.status = 'failing'
    health.detailKey = 'healthProvidersDownDetail'
    health.detailParams = { reason: lastFailureReason }
    return health
  }
  const oldestUnconfirmed = oldestUnconfirmedDeliveryAt()
  const deliveryWentSilent =
    oldestUnconfirmed > 0 &&
    now - oldestUnconfirmed >= DELIVERY_SILENCE_MILLISECONDS &&
    now - lastDeliveryConfirmedAt >= DELIVERY_SILENCE_MILLISECONDS
  if (consecutiveDeliveryMisses >= FAILING_DELIVERY_MISSES || deliveryWentSilent) {
    health.status = 'failing'
    health.detailKey = 'healthNotReachingGameDetail'
    return health
  }
  // A single provider resting is the fallback working as designed, not a problem worth flagging.
  // Only losing every provider actually stops the next message from being translated.
  if (coolingDown.length >= translationProviders.length) {
    health.status = 'degraded'
    health.detailKey = 'healthAllProvidersCoolingDetail'
    return health
  }
  if (consecutiveFailures > 0 && now - lastFailureAt < DEGRADED_FAILURE_WINDOW_MILLISECONDS) {
    health.status = 'degraded'
    health.detailKey = 'healthRecentFailureDetail'
    health.detailParams = { reason: lastFailureReason }
    return health
  }
  if (translatedCount === 0) {
    health.status = 'listening'
    health.detailKey = 'healthNoChatYetDetail'
    return health
  }
  health.status = 'healthy'
  if (coolingDown.length > 0) {
    health.detailKey = 'healthHealthyRestingDetail'
    health.detailParams = { count: translatedCount, providers: coolingDown.join(', ') }
    return health
  }
  health.detailKey = 'healthHealthyDetail'
  health.detailParams = { count: translatedCount }
  return health
}

let translationCallChain: Promise<unknown> = Promise.resolve()

function rateLimitedTranslate(messageText: string): Promise<string> {
  const callPromise = translationCallChain.then(async () => {
    try {
      return await translateText(messageText, translationTargetLanguage)
    } catch (firstError) {
      logLine('translation', 'translate attempt 1 failed: ' + String(firstError))
      await waitMilliseconds(1000)
    }
    try {
      return await translateText(messageText, translationTargetLanguage)
    } catch (secondError) {
      logLine('translation', 'translate attempt 2 failed: ' + String(secondError))
      await waitMilliseconds(3000)
    }
    return await translateText(messageText, translationTargetLanguage)
  })
  translationCallChain = callPromise.then(
    () => waitMilliseconds(TRANSLATION_CALL_GAP_MILLISECONDS),
    () => waitMilliseconds(TRANSLATION_CALL_GAP_MILLISECONDS)
  )
  return callPromise
}

// In a lobby the channel relay and the game chat relay report the same message a few milliseconds
// apart. Both miss the finished cache because neither call has returned yet, so without this the
// same text is sent to the translation service twice, doubling the rate limit pressure.
const pendingTranslations = new Map<string, Promise<string>>()

async function performTranslation(messageText: string, cacheKey: string): Promise<string> {
  let translatedText = ''
  try {
    translatedText = await rateLimitedTranslate(messageText)
  } catch (error) {
    logLine('translation', 'translate failed after retry for: ' + messageText.slice(0, 80) + ' error: ' + String(error))
    noteTranslationFailure(describeTranslationFailure(error))
    throw error
  }
  if (translatedText) {
    persistentTranslationCache.set(cacheKey, translatedText)
    scheduleCacheSave()
    noteTranslationSuccess()
  } else {
    logLine('translation', 'empty translation returned for: ' + messageText.slice(0, 80))
    noteTranslationFailure('the translation service returned nothing')
  }
  return translatedText
}

async function translateWithCache(messageText: string): Promise<string> {
  loadPersistentCache()
  const cacheKey = translationTargetLanguage + '|' + messageText
  const cached = persistentTranslationCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }
  const alreadyRunning = pendingTranslations.get(cacheKey)
  if (alreadyRunning) {
    logLine('translation', 'reusing the in flight translation for: ' + messageText.slice(0, 60))
    return await alreadyRunning
  }
  const translationPromise = performTranslation(messageText, cacheKey)
  pendingTranslations.set(cacheKey, translationPromise)
  try {
    return await translationPromise
  } finally {
    if (pendingTranslations.get(cacheKey) === translationPromise) {
      pendingTranslations.delete(cacheKey)
    }
  }
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

const TRANSLATION_REQUEST_TIMEOUT_MILLISECONDS = 10000
const TRANSLATION_PROVIDER_COOLDOWN_MILLISECONDS = 5 * 60 * 1000

type TranslationProvider = {
  name: string
  blockedUntil: number
  translate: (messageText: string, targetLanguage: string) => Promise<string>
}

async function fetchTranslationJson(requestUrl: string): Promise<unknown> {
  const response = await fetch(requestUrl, { signal: AbortSignal.timeout(TRANSLATION_REQUEST_TIMEOUT_MILLISECONDS) })
  if (!response.ok) {
    throw new Error('HTTP ' + response.status)
  }
  return await response.json()
}

function sourceLanguageFor(targetLanguage: string): string {
  return targetLanguage === 'th' ? 'en' : 'th'
}

const translationProviders: TranslationProvider[] = [
  {
    name: 'translate.googleapis.com',
    blockedUntil: 0,
    translate: async (messageText, targetLanguage) => {
      const payload = (await fetchTranslationJson(
        'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
          targetLanguage +
          '&dt=t&q=' +
          encodeURIComponent(messageText)
      )) as unknown[]
      const segments = Array.isArray(payload) && Array.isArray(payload[0]) ? (payload[0] as unknown[][]) : []
      return segments
        .map((segment) => (Array.isArray(segment) ? String(segment[0] ?? '') : ''))
        .join('')
        .trim()
    }
  },
  {
    name: 'clients5.google.com',
    blockedUntil: 0,
    translate: async (messageText, targetLanguage) => {
      const payload = (await fetchTranslationJson(
        'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=' +
          targetLanguage +
          '&q=' +
          encodeURIComponent(messageText)
      )) as unknown
      if (!Array.isArray(payload)) {
        throw new Error('unexpected response shape')
      }
      return payload
        .map((entry) => (Array.isArray(entry) ? String(entry[0] ?? '') : String(entry ?? '')))
        .join(' ')
        .trim()
    }
  },
  {
    name: 'api.mymemory.translated.net',
    blockedUntil: 0,
    translate: async (messageText, targetLanguage) => {
      const payload = (await fetchTranslationJson(
        'https://api.mymemory.translated.net/get?q=' +
          encodeURIComponent(messageText) +
          '&langpair=' +
          sourceLanguageFor(targetLanguage) +
          '|' +
          targetLanguage
      )) as { responseStatus?: number; responseDetails?: string; responseData?: { translatedText?: string } }
      if (payload.responseStatus !== 200) {
        throw new Error('service status ' + payload.responseStatus + ' ' + (payload.responseDetails ?? ''))
      }
      return String(payload.responseData?.translatedText ?? '').trim()
    }
  }
]

function describeTranslationFailure(error: unknown): string {
  const errorObject = error as { name?: string; message?: string; cause?: { code?: string; message?: string } }
  if (errorObject && errorObject.name === 'TimeoutError') {
    return 'no response after ' + Math.round(TRANSLATION_REQUEST_TIMEOUT_MILLISECONDS / 1000) + ' seconds'
  }
  if (errorObject && errorObject.cause && (errorObject.cause.code || errorObject.cause.message)) {
    return String(errorObject.cause.code || errorObject.cause.message)
  }
  return errorObject && errorObject.message ? errorObject.message : String(error)
}

async function translateText(messageText: string, targetLanguage: string): Promise<string> {
  const failures: string[] = []
  const now = Date.now()
  for (const provider of translationProviders) {
    if (provider.blockedUntil > now) {
      failures.push(provider.name + ': cooling down for ' + Math.ceil((provider.blockedUntil - now) / 1000) + 's after a rate limit')
      continue
    }
    const startedAt = Date.now()
    try {
      const translatedText = await provider.translate(messageText, targetLanguage)
      logLine('translation', 'translated via ' + provider.name + ' in ' + (Date.now() - startedAt) + 'ms')
      return translatedText
    } catch (error) {
      const reason = describeTranslationFailure(error)
      if (reason === 'HTTP 429') {
        provider.blockedUntil = Date.now() + TRANSLATION_PROVIDER_COOLDOWN_MILLISECONDS
        logLine('translation', 'provider ' + provider.name + ' rate limited this machine, HTTP 429 after ' + (Date.now() - startedAt) + 'ms, skipping it for ' + Math.round(TRANSLATION_PROVIDER_COOLDOWN_MILLISECONDS / 60000) + ' minutes')
      } else {
        logLine('translation', 'provider ' + provider.name + ' failed, ' + reason + ', after ' + (Date.now() - startedAt) + 'ms')
      }
      failures.push(provider.name + ': ' + reason)
    }
  }
  throw new Error('every translation provider failed, ' + failures.join(', '))
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
  window.webContents.on('before-input-event', (inputEvent, input) => {
    if (input.type === 'keyDown' && input.control && !input.alt && !input.shift && input.key.toLowerCase() === 't') {
      inputEvent.preventDefault()
      toggleComposeWindow()
    }
  })
  window.on('closed', () => {
    if (composeWindow === window) {
      composeWindow = null
    }
  })
  composeWindow = window
}

let foregroundWatcherProcess: ChildProcess | null = null
let composeShortcutRegistered = false

function setComposeShortcutActive(active: boolean): void {
  if (active && !composeShortcutRegistered) {
    composeShortcutRegistered = globalShortcut.register('Control+T', toggleComposeWindow)
  } else if (!active && composeShortcutRegistered) {
    globalShortcut.unregister('Control+T')
    composeShortcutRegistered = false
  }
}

function startForegroundWatcher(): void {
  if (foregroundWatcherProcess) {
    return
  }
  const watcherScript = [
    "Add-Type -Namespace Win32 -Name ForegroundWindowReader -MemberDefinition '[DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);'",
    "$lastName = 'startup'",
    'while ($true) {',
    '  $handle = [Win32.ForegroundWindowReader]::GetForegroundWindow()',
    '  $foregroundProcessId = [uint32]0',
    '  [void][Win32.ForegroundWindowReader]::GetWindowThreadProcessId($handle, [ref]$foregroundProcessId)',
    "  $name = ''",
    '  try { $name = (Get-Process -Id $foregroundProcessId -ErrorAction Stop).ProcessName } catch {}',
    '  if ($name -ne $lastName) { $lastName = $name; [Console]::Out.WriteLine($name) }',
    '  Start-Sleep -Milliseconds 300',
    '}'
  ].join('\n')
  const watcher = spawn('powershell.exe', ['-NoProfile', '-Command', watcherScript], {
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true
  })
  watcher.stdout?.setEncoding('utf8')
  let pendingOutput = ''
  watcher.stdout?.on('data', (chunk: string) => {
    pendingOutput += chunk
    const outputLines = pendingOutput.split(/\r?\n/)
    pendingOutput = outputLines.pop() ?? ''
    for (const outputLine of outputLines) {
      setComposeShortcutActive(outputLine.trim().toLowerCase() === 'juvio')
    }
  })
  watcher.on('exit', () => {
    if (foregroundWatcherProcess === watcher) {
      foregroundWatcherProcess = null
    }
  })
  foregroundWatcherProcess = watcher
}

function stopForegroundWatcher(): void {
  setComposeShortcutActive(false)
  if (foregroundWatcherProcess) {
    foregroundWatcherProcess.kill()
    foregroundWatcherProcess = null
  }
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
    logLine('compose', 'sending to ' + (channelName === 'all' ? 'all' : 'team') + ' chat: ' + thaiText.trim().slice(0, 60))
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

  ipcMain.handle('chatTranslation:openCacheFolder', () => {
    const cachePath = translationCachePath()
    if (existsSync(cachePath)) {
      shell.showItemInFolder(cachePath)
    } else {
      shell.openPath(app.getPath('userData'))
    }
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
    logLine('translation', 'game channel relay counter reset, clearing channel inbox')
    clearChannelInboxFiles()
  }
  lastChannelRelayCounter = relayCounter
  const prefixRaw = decodeRelayField(match[4])
  const messageRaw = decodeRelayField(match[5])
  const messageBody = messageRaw.replace(COLOR_CODE_PATTERN, '').trim()
  const prefixBody = extractChatBody(prefixRaw)
  const cleanMessage = messageBody.length > 0 ? messageBody : prefixBody
  if (!needsTranslation(cleanMessage)) {
    logLine('translation', 'channel chat skipped, no translation needed: ' + cleanMessage.slice(0, 60))
    return true
  }
  const now = Date.now()
  const previousTime = recentChannelMessageTimes.get(prefixRaw + '|' + messageRaw)
  if (previousTime !== undefined && now - previousTime < DUPLICATE_WINDOW_MILLISECONDS) {
    logLine('translation', 'channel chat duplicate suppressed: ' + cleanMessage.slice(0, 60))
    return true
  }
  logLine('translation', 'channel chat translating: ' + cleanMessage.slice(0, 60))
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
      logLine('translation', 'channel chat translated: ' + cleanMessage.slice(0, 60) + ' -> ' + translatedText.slice(0, 60))
      writeChannelTranslationInbox(prefixRaw, messageRaw, translatedText)
    })
    .catch(() => {})
  return true
}

function forgetStaleTimes(seenTimes: Map<string, number>, now: number): void {
  for (const [key, seenTime] of seenTimes) {
    if (now - seenTime > DUPLICATE_WINDOW_MILLISECONDS) {
      seenTimes.delete(key)
    }
  }
}

function handleWhisperRelayLine(line: string): boolean {
  const match = WHISPER_RELAY_LINE_PATTERN.exec(line)
  if (!match) {
    return false
  }
  const relayCounter = parseInt(match[1], 10)
  if (relayCounter === lastWhisperRelayCounter) {
    return true
  }
  lastWhisperRelayCounter = relayCounter
  const senderName = decodeRelayField(match[2]).replace(COLOR_CODE_PATTERN, '').trim()
  const prefixRaw = decodeRelayField(match[3])
  const messageRaw = decodeRelayField(match[4])
  const messageBody = messageRaw.replace(COLOR_CODE_PATTERN, '').trim()
  if (messageBody === '') {
    logLine('translation', 'whisper skipped, the message was empty after removing colour codes, sender ' + senderName)
    return true
  }
  if (!needsTranslation(messageBody)) {
    logLine('translation', 'whisper skipped, no translation needed: ' + messageBody.slice(0, 60))
    return true
  }
  const now = Date.now()
  const duplicateKey = prefixRaw + '|' + messageRaw
  const previousTime = recentWhisperTimes.get(duplicateKey)
  if (previousTime !== undefined && now - previousTime < DUPLICATE_WINDOW_MILLISECONDS) {
    logLine('translation', 'whisper duplicate suppressed: ' + messageBody.slice(0, 60))
    return true
  }
  recentWhisperTimes.set(duplicateKey, now)
  forgetStaleTimes(recentWhisperTimes, now)
  logLine('translation', 'whisper translating from ' + senderName + ': ' + messageBody.slice(0, 60))
  translateWithCache(messageBody)
    .then((translatedText) => {
      if (!translationActive) {
        return
      }
      if (!translatedText) {
        logLine('translation', 'whisper not delivered, the translator returned nothing for: ' + messageBody.slice(0, 60))
        return
      }
      logLine('translation', 'whisper translated: ' + messageBody.slice(0, 60) + ' -> ' + translatedText.slice(0, 60))
      writeWhisperTranslationInbox(prefixRaw, messageRaw, translatedText)
    })
    .catch((error) => {
      logLine('translation', 'whisper translation failed for: ' + messageBody.slice(0, 60) + ' error: ' + String(error))
    })
  return true
}

function handlePrivateMessageRelayLine(line: string): boolean {
  const match = PRIVATE_MESSAGE_RELAY_LINE_PATTERN.exec(line)
  if (!match) {
    return false
  }
  const relayCounter = parseInt(match[1], 10)
  if (relayCounter === lastPrivateMessageRelayCounter) {
    return true
  }
  lastPrivateMessageRelayCounter = relayCounter
  const conversationName = decodeRelayField(match[2]).replace(COLOR_CODE_PATTERN, '').trim()
  const prefixRaw = decodeRelayField(match[4])
  const messageRaw = decodeRelayField(match[5])
  const messageBody = messageRaw.replace(COLOR_CODE_PATTERN, '').trim()
  if (messageBody === '') {
    logLine(
      'translation',
      'private message skipped, the message was empty after removing colour codes, conversation ' + conversationName
    )
    return true
  }
  if (!needsTranslation(messageBody)) {
    logLine('translation', 'private message skipped, no translation needed: ' + messageBody.slice(0, 60))
    return true
  }
  const now = Date.now()
  const duplicateKey = prefixRaw + '|' + messageRaw
  const previousTime = recentPrivateMessageTimes.get(duplicateKey)
  if (previousTime !== undefined && now - previousTime < DUPLICATE_WINDOW_MILLISECONDS) {
    logLine('translation', 'private message duplicate suppressed: ' + messageBody.slice(0, 60))
    return true
  }
  recentPrivateMessageTimes.set(duplicateKey, now)
  forgetStaleTimes(recentPrivateMessageTimes, now)
  logLine('translation', 'private message translating with ' + conversationName + ': ' + messageBody.slice(0, 60))
  translateWithCache(messageBody)
    .then((translatedText) => {
      if (!translationActive) {
        return
      }
      if (!translatedText) {
        logLine(
          'translation',
          'private message not delivered, the translator returned nothing for: ' + messageBody.slice(0, 60)
        )
        return
      }
      logLine('translation', 'private message translated: ' + messageBody.slice(0, 60) + ' -> ' + translatedText.slice(0, 60))
      writePrivateMessageTranslationInbox(prefixRaw, messageRaw, translatedText)
    })
    .catch((error) => {
      logLine(
        'translation',
        'private message translation failed for: ' + messageBody.slice(0, 60) + ' error: ' + String(error)
      )
    })
  return true
}

function handleDebugOutputLine(_processId: number, line: string): void {
  const applyMatch = /HONCHATSTANDALONEAPPLY\|(\d+)/.exec(line)
  if (applyMatch) {
    const sequence = parseInt(applyMatch[1], 10)
    const writeRecord = inboxWriteTimes.get(sequence)
    if (writeRecord !== undefined) {
      inboxWriteTimes.delete(sequence)
      logLine('translation', 'game applied sequence ' + sequence + ' after ' + (Date.now() - writeRecord.time) + 'ms')
      noteDeliveryConfirmed()
    }
    dropAppliedInboxEntry(sequence)
  }
  if (line.includes('HONCHATSENT|')) {
    dropSentChatInboxEntries()
    noteDeliveryConfirmed()
  }
  const deliveredMatch = /HON(?:CHAT|CHAN|WHISPER|IM)DELIVERED\|(\d+)/.exec(line)
  if (deliveredMatch) {
    if (parseInt(deliveredMatch[1], 10) > 0) {
      noteDeliveryConfirmed()
    } else {
      retryLastDelivery()
    }
  }
  if (line.includes('HONCHA') || line.includes('HONWHISPER') || line.includes('HONIM')) {
    if (!sawAnyRelayLine) {
      sawAnyRelayLine = true
      logLine('translation', 'first relay line received, the game side is alive')
      reportHealthChange()
    }
    logLine('relay', line)
  }
  if (handleChannelRelayLine(line)) {
    return
  }
  if (handleWhisperRelayLine(line)) {
    return
  }
  if (handlePrivateMessageRelayLine(line)) {
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
    logLine('translation', 'game relay counter reset, clearing chat inbox')
    clearInboxFiles()
  }
  lastRelayCounter = relayCounter
  const relayText = decodeRelayField(match[4])
  const originalText = extractChatBody(relayText)
  if (!needsTranslation(originalText)) {
    logLine('translation', 'game chat skipped, no translation needed: ' + originalText.slice(0, 60))
    return
  }
  const now = Date.now()
  if (
    originalText === pendingDuplicateText &&
    relayCounter - pendingDuplicateCounter <= 2 &&
    now - pendingDuplicateTime < DUPLICATE_WINDOW_MILLISECONDS
  ) {
    pendingDuplicateText = ''
    logLine('translation', 'game chat duplicate suppressed: ' + originalText.slice(0, 60))
    return
  }
  pendingDuplicateText = originalText
  pendingDuplicateCounter = relayCounter
  pendingDuplicateTime = now
  logLine('translation', 'game chat translating: ' + originalText.slice(0, 60))
  messageCounter += 1
  const messageId = messageCounter
  translateWithCache(originalText)
    .then((translatedText) => {
      if (!translationActive || !translatedText) {
        return
      }
      logLine('translation', 'game chat translated: ' + originalText.slice(0, 60) + ' -> ' + translatedText.slice(0, 60))
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
  logLine(
    'translation',
    'session started, target language ' + targetLanguage + ', ' + (gameProcess ? 'attached to launched game' : 'standalone, game was already running')
  )
  sawAnyRelayLine = false
  resetHealthCounters()
  reportHealthChange()
  relayWatchdogTimer = setTimeout(() => {
    if (translationActive && !sawAnyRelayLine) {
      logLine(
        'translation',
        'no relay lines from the game after 90 seconds. The game side is not talking. Check that the game was launched modded through the manager and that chat translation was enabled before the launch'
      )
      reportHealthChange()
    }
  }, 90000)
  lastRelayCounter = 0
  lastChannelRelayCounter = 0
  lastWhisperRelayCounter = 0
  lastPrivateMessageRelayCounter = 0
  recentWhisperTimes.clear()
  recentPrivateMessageTimes.clear()
  chatInboxSequence = Date.now() % 1000000000
  channelInboxSequence = chatInboxSequence
  pendingDuplicateText = ''
  pendingDuplicateCounter = 0
  pendingDuplicateTime = 0
  clearInboxFiles()
  clearChannelInboxFiles()
  if (OVERLAY_WINDOW_ENABLED) {
    createOverlayWindow()
  }
  createComposeWindow()
  startForegroundWatcher()
  startDebugOutputListener(handleDebugOutputLine)
  if (gameProcess) {
    whenGameFullyExits(gameProcess, () => {
      stopThaiChatTranslation()
    })
  }
}

export function isThaiChatTranslationActive(): boolean {
  return translationActive
}

export function stopThaiChatTranslation(): void {
  if (!translationActive) {
    return
  }
  translationActive = false
  logLine('translation', 'session stopped')
  reportHealthChange()
  if (relayWatchdogTimer) {
    clearTimeout(relayWatchdogTimer)
    relayWatchdogTimer = null
  }
  stopForegroundWatcher()
  stopDebugOutputListener(handleDebugOutputLine)
  if (overlayWindow) {
    overlayWindow.close()
    overlayWindow = null
  }
  if (composeWindow) {
    composeWindow.close()
    composeWindow = null
  }
}
