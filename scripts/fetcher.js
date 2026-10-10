(async () => {
  'use strict';

  const STYLES = {
    title: 'font-size:18px; font-weight:bold; color:#F09040; background:#3D3D3D; padding:8px 16px; border-radius:4px;',
    subtitle: 'color:#B8A090; font-style:italic;',
    info: 'color:#8FAFC4;',
    success: 'color:#7A9F6B; font-weight:bold;',
    warning: 'color:#C9A857; font-weight:bold;',
    error: 'color:#B86A6A; font-weight:bold;',
    progress: 'color:#A89080;'
  };
  // The message is passed as an argument, so a % in a username is not read as a format directive.
  const log = {
    info: (msg) => console.log('%c\u25CF %s', STYLES.info, msg),
    success: (msg) => console.log('%c\u2714 %s', STYLES.success, msg),
    warning: (msg) => console.log('%c\u26A0 %s', STYLES.warning, msg),
    error: (msg) => console.log('%c\u2716 %s', STYLES.error, msg),
    progress: (msg) => console.log('%c\u25CF %s', STYLES.progress, msg)
  };

  try {
    if (location.hostname !== 'steamcommunity.com') {
      throw new Error(`Run this script on steamcommunity.com, not ${location.hostname}.`);
    }

    // /my/ redirects to the signed in user's profile, so this works from any steamcommunity.com page.
    // The redirect is resolved once from the first response, because following it costs a round trip on every page.
    const BASE_URL = 'https://steamcommunity.com/my/gcpd/440/';
    const TAB = 'playermatchhistory';
    const PAGE_DELAY = 100;
    const MAX_PAGES = 2000;
    const MAX_RETRIES = 5;
    const RETRY_BASE_DELAY = 1000;
    // Steam answers rate limits with 429 and temporary overload with 503. Other errors are not retried.
    const RETRY_STATUSES = [429, 503];
    // Steam timestamp fields. Other values are never dates, and Date() would misread strings that end in a number.
    const TIME_COLUMNS = new Set(['match_creation_time', 'connection_time', 'join_time', 'match_end_time', 'time_left_match']);
    const ORDERED_COLUMNS = [
      'match_id', 'match_title', 'type', 'season_id', 'reached_conclusion',
      'match_creation_time', 'connection_time', 'join_time', 'joined_after_match_start',
      'time_in_queue', 'match_end_time', 'time_left_match',
      'game_mode', 'map_index', 'datacenter', 'match_ip', 'match_port',
      'match_size', 'match_status', 'match_duration', 'match_flags', 'match_included_bots',
      'red_team_final_score', 'blu_team_final_score', 'winning_team', 'win_reason',
      'party_id_at_join', 'team_at_join', 'ping_estimate_at_join',
      'result_partyid', 'result_team', 'result_score', 'result_ping',
      'result_player_flags', 'result_displayed_rating', 'result_displayed_rating_change', 'result_rank',
      'classes_played', 'kills', 'deaths', 'damage', 'healing', 'support',
      'score_medal', 'kills_medal', 'damage_medal', 'healing_medal', 'support_medal',
      'leave_reason'
    ];

    console.log('%c TF2 Match History Fetcher ', STYLES.title);
    console.log('%c Exporting your casual match data', STYLES.subtitle);

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Steam's page script sets g_sessionID; the sessionid cookie is the fallback.
    function getSessionID() {
      if (window.g_sessionID) return window.g_sessionID;
      const m = document.cookie.match(/(?:^|; )sessionid=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    }

    function extractUsername() {
      // Blacklisted entries are nav and section labels that match the selectors below.
      const blacklist = ['you & friends', 'you &amp; friends', 'store', 'community', 'chat', 'support'];
      const selectors = [
        '#account_pulldown',
        '.profile_small_header_name a',
        '.persona_name_text_content',
        '.actual_persona_name'
      ];
      for (const selector of selectors) {
        const name = document.querySelector(selector)?.textContent.trim();
        if (name && name.length < 100 && !blacklist.includes(name.toLowerCase())) return name;
      }
      if (window.g_steamID !== undefined) return window.g_steamID;
      return 'unknown_user';
    }

    function sanitizeFilename(name) {
      return (name || 'unknown')
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 50);
    }

    async function fetchJson(url) {
      for (let attempt = 0; ; attempt++) {
        const delay = RETRY_BASE_DELAY * 2 ** attempt;
        let res;
        try {
          res = await fetch(url, {
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
          });
        } catch (err) {
          if (attempt === MAX_RETRIES) throw err;
          log.warning(`Network error, retrying in ${delay} ms`);
          await wait(delay);
          continue;
        }
        if (res.ok) return { json: await res.json(), finalUrl: res.url };
        if (!RETRY_STATUSES.includes(res.status) || attempt === MAX_RETRIES) {
          throw new Error(`HTTP ${res.status}`);
        }
        log.warning(`Steam returned ${res.status}, retrying in ${delay} ms`);
        await wait(delay);
      }
    }

    function normalizeKey(label) {
      return label
        .replace(/\u00A0/g, ' ')
        .trim()
        .replace(/[:\u2013\u2014\-\/\\]+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/^_+|_+$/g, '');
    }

    function parseTime(s) {
      const d = new Date(s);
      if (!Number.isNaN(d.valueOf())) return d.toISOString();
      const m = s.match(/(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
      return m ? new Date(`${m[1]}T${m[2]}Z`).toISOString() : null;
    }

    function parseValue(key, s) {
      if (s === '') return null;
      const low = s.toLowerCase();
      if (low === 'yes') return true;
      if (low === 'no') return false;
      if (/^-?\d+$/.test(s)) {
        // Ids such as party and match ids can exceed the safe range, where a Number would round them.
        const n = parseInt(s, 10);
        return Number.isSafeInteger(n) ? n : s;
      }
      if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
      if (TIME_COLUMNS.has(key)) {
        const iso = parseTime(s);
        if (iso) return iso;
      }
      return s;
    }

    // The header carries the match id, or the title when it has none.
    function parseTable(table) {
      const row = {};
      const th = table.querySelector('th');
      if (th) {
        const header = th.textContent.trim();
        const m = header.match(/Match\s*([0-9]+)/i);
        if (m) row.match_id = m[1];
        else row.match_title = header;
      }
      for (const tr of table.querySelectorAll('tr')) {
        const cells = tr.querySelectorAll('td');
        if (cells.length !== 2) continue;
        const key = normalizeKey(cells[0].textContent.trim());
        row[key] = parseValue(key, cells[1].textContent.trim());
      }
      return row;
    }

    function buildCsv(rows) {
      const known = new Set(ORDERED_COLUMNS);
      const extras = [...new Set(rows.flatMap((row) => Object.keys(row)))]
        .filter((key) => !known.has(key) && !key.startsWith('_'))
        .sort();
      const headers = [...ORDERED_COLUMNS, ...extras];
      const escape = (value) => {
        if (value === null || value === undefined) return '';
        const s = String(value);
        return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = rows.map((row) => headers.map((h) => escape(row[h])).join(','));
      return [headers.join(','), ...lines].join('\n');
    }

    const username = extractUsername();
    const sessionid = getSessionID();
    log.info(`Fetching casual match history for ${username}...`);

    const rows = [];
    const seen = new Set();
    let base = BASE_URL;
    let token = null;
    let page = 0;

    while (page < MAX_PAGES) {
      page++;
      const url = new URL(base);
      url.searchParams.set('ajax', '1');
      url.searchParams.set('tab', TAB);
      if (token) url.searchParams.set('continue_token', token);
      // Steam expects the session id on ajax requests.
      if (sessionid) url.searchParams.set('sessionid', sessionid);

      const { json, finalUrl } = await fetchJson(url.toString());
      if (page === 1 && finalUrl) {
        const final = new URL(finalUrl);
        if (final.hostname === 'steamcommunity.com') base = final.origin + final.pathname;
      }
      if (!json || !json.success) { log.warning('Steam returned no more pages'); break; }

      const doc = new DOMParser().parseFromString(json.html || '', 'text/html');
      let tables = Array.from(doc.querySelectorAll('table.generic_kv_table'));
      if (!tables.length) tables = Array.from(doc.querySelectorAll('table'));
      for (const table of tables) {
        const row = parseTable(table);
        if (row.match_id) {
          if (seen.has(row.match_id)) continue;
          seen.add(row.match_id);
        }
        rows.push(row);
      }

      if (page % 5 === 0) log.progress(`Page ${page}: ${rows.length} matches`);

      // Steam ends the history by omitting continue_token or repeating the token it was sent.
      const next = json.continue_token || null;
      if (!next || next === token) { log.success(`Reached end of match history after ${page} pages`); break; }
      if (page >= MAX_PAGES) {
        log.warning(`Stopped at the ${MAX_PAGES} page limit while Steam still had more matches; the export may be incomplete.`);
        break;
      }
      token = next;
      await wait(PAGE_DELAY);
    }

    const filename = `casual_${sanitizeFilename(username)}.csv`;
    const blob = new Blob([buildCsv(rows)], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    log.success(`Done: ${filename} (${rows.length} matches)`);
  } catch (err) {
    log.error(`Fatal error: ${err.message}`);
    console.error(err);
  }
})();
