// ---------------------------------------------------------------------------
// Cookie helpers — used for settings and consent (localStorage kept for large
// gameplay data: participants, history, excluded winners)
// ---------------------------------------------------------------------------
function mwSetCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(typeof value === 'string' ? value : JSON.stringify(value)) + '; expires=' + expires + '; path=/; SameSite=Lax';
}
function mwGetCookie(name) {
  const match = document.cookie.split('; ').find(function(r){ return r.startsWith(name + '='); });
  if (!match) return null;
  const raw = decodeURIComponent(match.slice(name.length + 1));
  // Guard: if a previous bug stored "[object Object]", clear and return null
  if (raw === '[object Object]' || raw === 'undefined') { mwRemoveCookie(name); return null; }
  try { return JSON.parse(raw); } catch { return raw; }
}
function mwRemoveCookie(name) {
  document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
}
