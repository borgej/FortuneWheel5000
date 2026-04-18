// World of Warships API — called directly from the browser.
// Requires a Wargaming app of type "Mobile" (no IP restriction).
// The application_id is read from APP_CONFIG.wowsAppId (injected at build/serve time).
const WoWS = (() => {
  const BASES = {
    eu:   'https://api.worldofwarships.eu',
    na:   'https://api.worldofwarships.com',
    asia: 'https://api.worldofwarships.asia',
    ru:   'https://api.worldofwarships.ru',
  };

  function _base(region) { return BASES[region] || BASES.eu; }
  function _appId() { return (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.wowsAppId) || ''; }

  async function _get(region, endpoint, params) {
    const appId = _appId();
    if (!appId || appId === '__WOWS_APP_ID__') throw new Error('WoWS App ID not configured.');
    const qs = new URLSearchParams({ ...params, application_id: appId });
    const r = await fetch(`${_base(region)}/wows/${endpoint}?${qs}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (j.status !== 'ok') throw new Error(j.error?.message || j.error?.code || 'WoWS API error');
    return j.data;
  }

  // Resolves a username to { account_id, nickname }, or throws if not found.
  async function lookupPlayer(username, region) {
    const data = await _get(region, 'account/list/', { search: username, type: 'exact', fields: 'account_id,nickname' });
    if (!Array.isArray(data) || !data.length) throw new Error(`Player "${username}" not found on ${region.toUpperCase()}`);
    return data[0];
  }

  // Returns array of ship_id numbers the player has battle statistics for.
  // Returns null if the player's statistics are hidden (hidden_profile).
  // accessToken: optional Wargaming OAuth token — enables in_garage=1 filter.
  async function fetchPlayerShipIds(accountId, region, accessToken) {
    const params = { account_id: accountId, fields: 'ship_id' };
    if (accessToken) { params.access_token = accessToken; params.in_garage = 1; }
    const data = await _get(region, 'ships/stats/', params);
    const ships = data[String(accountId)];
    if (ships === null) return null; // explicitly null = hidden profile
    if (!ships) return [];
    return ships.map(s => s.ship_id);
  }

  // Returns the Wargaming OAuth login URL for the given region.
  // After login WG redirects to redirectUri with ?status=ok&access_token=...&account_id=...&nickname=...&expires_at=...
  function authLoginUrl(region, redirectUri) {
    const params = new URLSearchParams({
      application_id: _appId(),
      redirect_uri:   redirectUri,
      expires_at:     1209600, // 14 days
    });
    return `${_base(region)}/wows/auth/login/?${params}`;
  }

  // Returns { pvp, rank_solo } stats for one ship, or null if unavailable.
  async function fetchShipStats(accountId, shipId, region) {
    const data = await _get(region, 'ships/stats/', {
      account_id: accountId,
      ship_id:    String(shipId),
      fields:     'pvp.wins,pvp.battles,rank_solo.wins,rank_solo.battles',
      extra:      'rank_solo',
    });
    const ships = data[String(accountId)];
    if (!ships || !ships.length) return null;
    return ships[0];
  }

  // Returns array of { ship_id, name, tier, type, nation } for the given IDs.
  async function fetchShipDetails(shipIds, region) {
    const all = [];
    for (let i = 0; i < shipIds.length; i += 100) {
      const batch = shipIds.slice(i, i + 100);
      const data = await _get(region, 'encyclopedia/ships/', {
        ship_id:  batch.join(','),
        fields:   'ship_id,name,tier,type,nation,images',
        language: 'en',
      });
      all.push(...Object.values(data).filter(Boolean));
    }
    return all;
  }

  const SHIP_TYPE_LABELS = {
    AirCarrier: 'CV',
    Battleship: 'Battleship',
    Cruiser:    'Cruiser',
    Destroyer:  'Destroyer',
    Submarine:  'Submarine',
  };

  const NATION_LABELS = {
    usa:          'USA',
    japan:        'Japan',
    ussr:         'USSR',
    germany:      'Germany',
    uk:           'UK',
    france:       'France',
    italy:        'Italy',
    pan_asia:     'Pan-Asia',
    europe:       'Europe',
    netherlands:  'Netherlands',
    spain:        'Spain',
    commonwealth: 'Commonwealth',
    pan_america:  'Pan-America',
    common:       'Common',
  };

  return { lookupPlayer, fetchPlayerShipIds, fetchShipDetails, fetchShipStats, authLoginUrl, SHIP_TYPE_LABELS, NATION_LABELS };
})();
