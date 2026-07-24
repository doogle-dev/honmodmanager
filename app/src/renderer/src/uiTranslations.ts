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
  updateReady: { en: 'Update {version} ready', th: 'อัปเดต {version} พร้อมแล้ว' },
  desktopShortcuts: { en: 'Desktop Shortcuts', th: 'ทางลัดบนเดสก์ท็อป' },
  desktopShortcutsDescription: {
    en: 'Creates two desktop shortcuts, one that launches the game plain and one that launches it with your enabled mods. Both run through the manager so mods, settings and chat translation all work without opening this window first.',
    th: 'สร้างทางลัดสองอันบนเดสก์ท็อป อันหนึ่งเปิดเกมแบบปกติ อีกอันเปิดเกมพร้อมม็อดที่เปิดไว้ ทั้งสองทำงานผ่านตัวจัดการม็อด ดังนั้นม็อด การตั้งค่า และการแปลแชทจะทำงานโดยไม่ต้องเปิดหน้าต่างนี้ก่อน'
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
  cacheCleared: { en: 'Translation cache cleared.', th: 'ล้างแคชคำแปลแล้ว' },
  language: { en: 'Language', th: 'ภาษา' },
  languageDescription: {
    en: 'Choose the language of the mod manager.',
    th: 'เลือกภาษาของตัวจัดการม็อด'
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
    en: 'Catalog offline. Showing installed mods only.',
    th: 'แคตตาล็อกออฟไลน์ แสดงเฉพาะม็อดที่ติดตั้งแล้ว'
  },
  byAuthor: { en: 'by {author}', th: 'โดย {author}' },
  unknown: { en: 'unknown', th: 'ไม่ทราบ' },
  onLatestVersion: { en: 'You are on the latest version.', th: 'คุณใช้เวอร์ชันล่าสุดอยู่แล้ว' },
  updateFound: {
    en: 'Update {version} found. Downloading now, the restart button will appear when it is ready.',
    th: 'พบอัปเดต {version} กำลังดาวน์โหลด ปุ่มรีสตาร์ทจะแสดงเมื่อพร้อม'
  },
  updatesUnavailable: { en: 'Updates only work in the installed app.', th: 'อัปเดตใช้ได้เฉพาะแอปที่ติดตั้งแล้ว' },
  updateCheckFailed: { en: 'Update check failed: {error}', th: 'ตรวจสอบอัปเดตไม่สำเร็จ: {error}' },
  updateDownloadFailed: { en: 'Update download failed: {error}', th: 'ดาวน์โหลดอัปเดตไม่สำเร็จ: {error}' },
  downloadCancelled: { en: 'Download cancelled.', th: 'ยกเลิกการดาวน์โหลดแล้ว' }
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
