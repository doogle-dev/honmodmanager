export type UiLanguage = 'en' | 'th'

const LANGUAGE_STORAGE_KEY = 'managerUiLanguage'

export function loadUiLanguage(): UiLanguage {
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'th' ? 'th' : 'en'
}

export function saveUiLanguage(language: UiLanguage): void {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
}

const translations: Record<string, { en: string; th: string }> = {
  browseMods: { en: 'Browse Mods', th: 'เรียกดูม็อด' },
  browseModsNav: { en: 'Browse mods', th: 'เรียกดูม็อด' },
  installedMods: { en: 'Installed Mods', th: 'ม็อดที่ติดตั้งแล้ว' },
  installedModsNav: { en: 'Installed mods', th: 'ม็อดที่ติดตั้ง' },
  settings: { en: 'Settings', th: 'ตั้งค่า' },
  credits: { en: 'Credits', th: 'เครดิต' },
  launch: { en: 'Launch', th: 'เปิดเกม' },
  launching: { en: 'Launching...', th: 'กำลังเปิดเกม...' },
  applyEnabled: { en: 'Apply Enabled', th: 'ใช้งานม็อดที่เปิดไว้' },
  unapplyAll: { en: 'Unapply All', th: 'ยกเลิกม็อดทั้งหมด' },
  customMod: { en: 'Custom Mod', th: 'เพิ่มม็อดเอง' },
  searchMods: { en: 'Search mods', th: 'ค้นหาม็อด' },
  allCategories: { en: 'All categories', th: 'ทุกหมวดหมู่' },
  enabled: { en: 'Enabled', th: 'เปิดใช้งาน' },
  disabled: { en: 'Disabled', th: 'ปิดอยู่' },
  install: { en: 'Install', th: 'ติดตั้ง' },
  uninstall: { en: 'Uninstall', th: 'ถอนการติดตั้ง' },
  details: { en: 'Details', th: 'รายละเอียด' },
  close: { en: 'Close', th: 'ปิด' },
  updateAvailable: { en: 'Update available', th: 'มีอัปเดต' },
  checkModUpdates: { en: 'Check for Updates', th: 'ตรวจสอบอัปเดต' },
  selectMod: { en: 'Select a mod to see its details', th: 'เลือกม็อดเพื่อดูรายละเอียด' },
  updateCountMods: { en: 'Update {count} mod(s)', th: 'อัปเดตม็อด {count} รายการ' },
  modInfoHeading: { en: 'Mod info', th: 'ข้อมูลม็อด' },
  descriptionHeading: { en: 'Description', th: 'คำอธิบาย' },
  infoVersion: { en: 'Version', th: 'เวอร์ชัน' },
  infoAuthor: { en: 'Author', th: 'ผู้สร้าง' },
  infoCategory: { en: 'Category', th: 'หมวดหมู่' },
  infoFileName: { en: 'File', th: 'ไฟล์' },
  modsUpdated: { en: 'Updated {count} mod(s)', th: 'อัปเดตม็อดแล้ว {count} รายการ' },
  modUpdatesFound: { en: 'Updates available for {count} mod(s)', th: 'มีอัปเดตสำหรับม็อด {count} รายการ' },
  modUpdatesNone: { en: 'All mods are up to date', th: 'ม็อดทั้งหมดเป็นเวอร์ชันล่าสุดแล้ว' },
  noModsMatch: { en: 'No mods match your search.', th: 'ไม่พบม็อดที่ตรงกับการค้นหา' },
  noModsInstalled: {
    en: 'No mods installed yet. Open Browse mods to install some.',
    th: 'ยังไม่มีม็อดที่ติดตั้ง เปิดหน้าเรียกดูม็อดเพื่อติดตั้ง'
  },
  updates: { en: 'Updates', th: 'อัปเดต' },
  currentVersion: { en: 'Current version', th: 'เวอร์ชันปัจจุบัน' },
  checkForUpdates: { en: 'Check for Updates', th: 'ตรวจสอบอัปเดต' },
  checking: { en: 'Checking...', th: 'กำลังตรวจสอบ...' },
  downloadingUpdate: { en: 'Downloading update', th: 'กำลังดาวน์โหลดอัปเดต' },
  starting: { en: 'Starting...', th: 'กำลังเริ่ม...' },
  cancel: { en: 'Cancel', th: 'ยกเลิก' },
  restartNow: { en: 'Restart Now', th: 'รีสตาร์ทตอนนี้' },
  viewLog: { en: 'View Log', th: 'ดูบันทึก' },
  updateReady: { en: 'Update {version} ready', th: 'อัปเดต {version} พร้อมแล้ว' },
  desktopShortcuts: { en: 'Desktop Shortcuts', th: 'ทางลัดบนเดสก์ท็อป' },
  languageAndChatSection: { en: 'Language and chat', th: 'ภาษาและแชท' },
  systemSection: { en: 'System', th: 'ระบบ' },
  version: { en: 'Version', th: 'เวอร์ชัน' },
  desktopShortcutsDescription: {
    en: 'Creates two desktop shortcuts. The modded shortcut applies your enabled mods, starts chat translation if it is enabled, and launches the game, with the manager running quietly in the background until you close the game. The plain shortcut just launches the game with no mods and no translation.',
    th: 'สร้างทางลัดสองอันบนเดสก์ท็อป ทางลัดแบบม็อดจะใช้ม็อดที่เปิดไว้ เริ่มการแปลแชทถ้าเปิดใช้งานอยู่ แล้วเปิดเกม โดยตัวจัดการม็อดจะทำงานเบื้องหลังจนกว่าจะปิดเกม ส่วนทางลัดแบบปกติจะเปิดเกมเฉยๆ โดยไม่มีม็อดและไม่มีการแปลแชท'
  },
  createShortcuts: { en: 'Create Shortcuts', th: 'สร้างทางลัด' },
  shortcutsCreated: {
    en: 'Both shortcuts were created on your desktop.',
    th: 'สร้างทางลัดทั้งสองอันบนเดสก์ท็อปแล้ว'
  },
  shortcutsFailed: {
    en: 'Shortcut creation failed. Try running the manager as administrator.',
    th: 'สร้างทางลัดไม่สำเร็จ ลองเปิดตัวจัดการม็อดแบบผู้ดูแลระบบ'
  },
  translationCache: { en: 'Translation Cache', th: 'แคชคำแปล' },
  translationCacheDescription: {
    en: 'Chat translations are saved locally so repeated messages never call the translation service twice. The cache clears itself automatically if it grows past 20 MB.',
    th: 'คำแปลแชทถูกบันทึกไว้ในเครื่อง ข้อความซ้ำจะไม่เรียกใช้บริการแปลอีกครั้ง แคชจะล้างตัวเองอัตโนมัติเมื่อเกิน 20 MB'
  },
  savedTranslations: { en: '{count} saved translations, {size}', th: 'คำแปลที่บันทึกไว้ {count} รายการ, {size}' },
  clearCache: { en: 'Clear Cache', th: 'ล้างแคช' },
  openCacheFolder: { en: 'Open Cache Folder', th: 'เปิดโฟลเดอร์แคช' },
  cacheCleared: { en: 'Translation cache cleared.', th: 'ล้างแคชคำแปลแล้ว' },
  language: { en: 'Language', th: 'ภาษา' },
  logs: { en: 'Logs', th: 'บันทึกการทำงาน' },
  logsDescription: {
    en: 'The manager keeps a log of launches, mod applying and chat translation. Send it along when reporting a problem. Logs rotate automatically so they never grow beyond a few megabytes.',
    th: 'ตัวจัดการม็อดบันทึกการเปิดเกม การใช้งานม็อด และการแปลแชท ส่งไฟล์นี้มาด้วยเมื่อแจ้งปัญหา บันทึกจะหมุนเวียนอัตโนมัติจึงไม่โตเกินไม่กี่เมกะไบต์'
  },
  openLogsFolder: { en: 'Open Logs Folder', th: 'เปิดโฟลเดอร์บันทึก' },
  languageDescription: {
    en: 'Choose the language of the mod manager. This also sets the chat translation direction: in English, Thai game chat is translated to English and your Ctrl+T messages are sent in Thai. In Thai it works the other way around.',
    th: 'เลือกภาษาของตัวจัดการม็อด ภาษานี้กำหนดทิศทางการแปลแชทด้วย: เมื่อใช้ภาษาอังกฤษ แชทภาษาไทยจะถูกแปลเป็นอังกฤษ และข้อความ Ctrl+T ของคุณจะถูกส่งเป็นภาษาไทย เมื่อใช้ภาษาไทยจะทำงานกลับกัน'
  },
  applying: { en: 'Applying...', th: 'กำลังใช้งานม็อด...' },
  applied: { en: 'Applied. Press Launch Modded to play.', th: 'ใช้งานม็อดแล้ว กดเปิดเกมเพื่อเล่น' },
  appliedSkipped: {
    en: 'Applied, but these mods did not match your game files and were skipped: {mods}',
    th: 'ใช้งานม็อดแล้ว แต่ม็อดเหล่านี้ไม่ตรงกับไฟล์เกมและถูกข้าม: {mods}'
  },
  noModsEnabled: { en: 'No mods enabled. The overlay was cleared.', th: 'ไม่มีม็อดที่เปิดไว้ ลบไฟล์ม็อดแล้ว' },
  allUnapplied: { en: 'All mods unapplied.', th: 'ยกเลิกม็อดทั้งหมดแล้ว' },
  installing: { en: 'Installing {name} ...', th: 'กำลังติดตั้ง {name} ...' },
  installed: { en: 'Installed {name}.', th: 'ติดตั้ง {name} แล้ว' },
  installFailed: { en: 'Install failed: {error}', th: 'ติดตั้งไม่สำเร็จ: {error}' },
  uninstalled: { en: 'Uninstalled {name}.', th: 'ถอนการติดตั้ง {name} แล้ว' },
  uninstallFailed: { en: 'Uninstall failed: {error}', th: 'ถอนการติดตั้งไม่สำเร็จ: {error}' },
  applyFailed: { en: 'Apply failed: {error}', th: 'ใช้งานม็อดไม่สำเร็จ: {error}' },
  addedCustom: { en: 'Added {count} custom mod(s).', th: 'เพิ่มม็อดเอง {count} รายการแล้ว' },
  addFailed: { en: 'Add failed: {error}', th: 'เพิ่มไม่สำเร็จ: {error}' },
  loadFailed: { en: 'Failed to load mods: {error}', th: 'โหลดม็อดไม่สำเร็จ: {error}' },
  catalogOffline: {
    en: 'Catalog offline, showing installed mods only. {detail}',
    th: 'แคตตาล็อกออฟไลน์ แสดงเฉพาะม็อดที่ติดตั้งแล้ว {detail}'
  },
  catalogCached: {
    en: 'Catalog offline, showing the last catalog this app saw. {detail}',
    th: 'แคตตาล็อกออฟไลน์ กำลังแสดงแคตตาล็อกล่าสุดที่เคยโหลดไว้ {detail}'
  },
  byAuthor: { en: 'by {author}', th: 'โดย {author}' },
  unknown: { en: 'unknown', th: 'ไม่ทราบ' },
  onLatestVersion: { en: 'You are on the latest version.', th: 'คุณใช้เวอร์ชันล่าสุดอยู่แล้ว' },
  updateFound: {
    en: 'Update {version} found. Downloading now, the restart button will appear when it is ready.',
    th: 'พบอัปเดต {version} กำลังดาวน์โหลด ปุ่มรีสตาร์ทจะแสดงเมื่อพร้อม'
  },
  updateReadyRestart: {
    en: 'Update {version} is ready. Click Restart Now to install it.',
    th: 'อัปเดต {version} พร้อมติดตั้งแล้ว กดรีสตาร์ทตอนนี้เพื่อติดตั้ง'
  },
  catalogUnavailable: {
    en: 'Cannot reach the mod catalog. {detail} The manager log has the full details.',
    th: 'เชื่อมต่อแคตตาล็อกม็อดไม่ได้ {detail} ดูรายละเอียดเต็มได้ในล็อกของโปรแกรม'
  },
  updatesUnavailable: { en: 'Updates only work in the installed app.', th: 'อัปเดตใช้ได้เฉพาะแอปที่ติดตั้งแล้ว' },
  updateCheckFailed: { en: 'Update check failed: {error}', th: 'ตรวจสอบอัปเดตไม่สำเร็จ: {error}' },
  updateDownloadFailed: { en: 'Update download failed: {error}', th: 'ดาวน์โหลดอัปเดตไม่สำเร็จ: {error}' },
  downloadCancelled: { en: 'Download cancelled.', th: 'ยกเลิกการดาวน์โหลดแล้ว' },

  healthHeading: { en: 'Health', th: 'สถานะการทำงาน' },
  healthStatusOff: { en: 'Off', th: 'ปิดอยู่' },
  healthStatusIdle: { en: 'Idle', th: 'รออยู่' },
  healthStatusWaiting: { en: 'Starting', th: 'กำลังเริ่ม' },
  healthStatusListening: { en: 'Connected', th: 'เชื่อมต่อแล้ว' },
  healthStatusHealthy: { en: 'Working', th: 'ทำงานปกติ' },
  healthStatusDegraded: { en: 'Struggling', th: 'ทำงานได้ไม่เต็มที่' },
  healthStatusFailing: { en: 'Not working', th: 'ใช้งานไม่ได้' },
  healthOffDetail: {
    en: 'Chat translation is turned off.',
    th: 'การแปลแชทถูกปิดอยู่'
  },
  healthIdleDetail: {
    en: 'Ready. Translation starts when you launch the game from the manager.',
    th: 'พร้อมแล้ว การแปลจะเริ่มเมื่อคุณเปิดเกมจากตัวจัดการม็อด'
  },
  healthWaitingDetail: {
    en: 'Waiting for the game to say hello.',
    th: 'กำลังรอสัญญาณจากเกม'
  },
  healthNoChatYetDetail: {
    en: 'Connected to the game and watching chat. Nothing has needed translating yet.',
    th: 'เชื่อมต่อกับเกมและกำลังเฝ้าดูแชทอยู่ ยังไม่มีข้อความที่ต้องแปล'
  },
  healthHealthyDetail: {
    en: 'Translating normally, {count} message(s) this session.',
    th: 'แปลได้ตามปกติ {count} ข้อความในรอบนี้'
  },
  healthHealthyRestingDetail: {
    en: 'Translating normally, {count} message(s) this session. Using a backup service while {providers} rests after a rate limit.',
    th: 'แปลได้ตามปกติ {count} ข้อความในรอบนี้ กำลังใช้บริการสำรองระหว่างที่ {providers} พักหลังถูกจำกัดจำนวนคำขอ'
  },
  healthNoRelayDetail: {
    en: 'The game is not sending chat to the manager. Launch the game from the manager with chat translation already enabled.',
    th: 'เกมไม่ได้ส่งแชทมาที่ตัวจัดการม็อด ให้เปิดเกมจากตัวจัดการม็อดโดยเปิดการแปลแชทไว้ก่อน'
  },
  healthProvidersDownDetail: {
    en: 'Every translation service is refusing requests. Last reason: {reason}',
    th: 'บริการแปลทุกตัวปฏิเสธคำขอ เหตุผลล่าสุด: {reason}'
  },
  healthNotReachingGameDetail: {
    en: 'Translations are being made but the game is not picking them up.',
    th: 'แปลข้อความได้แล้ว แต่เกมไม่ได้รับไปแสดง'
  },
  healthRecentFailureDetail: {
    en: 'A translation just failed: {reason}',
    th: 'เพิ่งแปลไม่สำเร็จ: {reason}'
  },
  healthAllProvidersCoolingDetail: {
    en: 'Every translation service is resting after a rate limit. This clears itself within a few minutes.',
    th: 'บริการแปลทุกตัวกำลังพักหลังถูกจำกัดจำนวนคำขอ ระบบจะกลับมาเองภายในไม่กี่นาที'
  },
  healthCounts: {
    en: '{translated} translated, {failed} failed',
    th: 'แปลสำเร็จ {translated} ล้มเหลว {failed}'
  },
  healthNeedsAttention: {
    en: 'Chat translation needs attention',
    th: 'การแปลแชทมีปัญหา'
  },

  liveLogHeading: { en: 'Live log', th: 'บันทึกสด' },
  hideLog: { en: 'Hide Log', th: 'ซ่อนบันทึก' },
  openLogFile: { en: 'Open File', th: 'เปิดไฟล์' },
  logEmpty: { en: 'Nothing logged yet.', th: 'ยังไม่มีบันทึก' },
  followLog: { en: 'Follow', th: 'ตามอัตโนมัติ' }
}

export function createTranslator(language: UiLanguage): (key: string, params?: Record<string, string | number>) => string {
  return (key, params) => {
    const entry = translations[key]
    let text = entry ? entry[language] : key
    if (params) {
      for (const [paramName, paramValue] of Object.entries(params)) {
        text = text.replaceAll('{' + paramName + '}', String(paramValue))
      }
    }
    return text
  }
}
