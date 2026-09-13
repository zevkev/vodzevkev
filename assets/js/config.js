/* ============================================================
   Modul: assets/js/config.js — zentrale Einstellungen
   ============================================================ */
window.ZV_CONFIG = {
  siteUrl: 'https://vod.zevkev.me',
  twitch: {
    channel: 'zevkev_',
    channelUrl: 'https://www.twitch.tv/zevkev_',
    // Twitch verlangt die Domain als parent-Parameter (plus lokale Tests).
    // Der Player wird nur bei bestätigtem Live-Status eingebettet,
    // sonst läuft oben das neueste Video vom VOD-Kanal.
    parents: ['vod.zevkev.me', 'localhost', '127.0.0.1'],
    // Budget muss über der Summe der Einzel-Checks liegen,
    // sonst verliert langsames Netz systematisch (False-Offline).
    liveCheckBudgetMs: 16000,
    thumbTimeoutMs: 6000,
    pageTimeoutMs: 9000
  },
  youtube: {
    // Einzige Quelle: VOD-Kanal @ZevKevPlus (dort landen die Twitch-VODs).
    // Es wird bewusst KEIN anderer Kanal beigemischt.
    primary: { handle: '@ZevKevPlus', channelId: 'UCTTbSiyRUop-hMeZGIJD_QA', label: 'VOD-Kanal' },
    channelUrl: 'https://www.youtube.com/@ZevKevPlus',
    maxItems: 24,
    archiveSize: 8,
    railSize: 12,
    neuDays: 14,
    cacheMinutes: 30,
    // Stichworte für den Tab "Stream-VODs" (RSS liefert keine Typen)
    streamKeywords: ['live', 'stream', 'vod', 'premiere', 'restream', 'reaktion', 'zocken', 'gaming', 'just chatting', 'talk', 'mit chat', 'q&a', ' Vod ']
  },
  links: {
    twitch: 'https://www.twitch.tv/zevkev_',
    website: 'https://zevkev.me',
    discord: 'https://discord.com/invite/psW4NgjBFN',
    tiktok: 'https://www.tiktok.com/@zevkev',
    instagram: 'https://www.instagram.com/zevkev/'
  }
};
