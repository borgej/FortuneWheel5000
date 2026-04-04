// Minimal Twitch IRC over WebSocket client as a fallback when tmi.js is unavailable
class TwitchWSChat {
  constructor(channel, { onMessage, onConnected, onDisconnected }) {
    this.channel = channel.startsWith('#') ? channel : `#${channel}`;
    this.onMessage = onMessage;
    this.onConnected = onConnected;
    this.onDisconnected = onDisconnected;
    this.ws = null;
    this.nick = `justinfan${Math.floor(Math.random()*1e8)}`; // anonymous
    this.heartbeat = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
        this.ws.addEventListener('open', () => {
          this._send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
          this._send('PASS SCHMOOPIIE'); // placeholder for anonymous
          this._send(`NICK ${this.nick}`);
          this._send(`JOIN ${this.channel}`);
          if (this.onConnected) this.onConnected();
          resolve();
          this._startHeartbeat();
        });
        this.ws.addEventListener('message', (ev) => this._handleRaw(ev.data));
        this.ws.addEventListener('close', () => { this._stopHeartbeat(); if (this.onDisconnected) this.onDisconnected(); });
        this.ws.addEventListener('error', (e) => { console.error('WS error', e); });
      } catch (e) {
        reject(e);
      }
    });
  }

  disconnect() { try { this._stopHeartbeat(); this.ws && this.ws.close(); } catch {} }
  _send(line) { try { this.ws && this.ws.send(`${line}\r\n`); } catch {} }

  _startHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => { try { this._send('PING :tmi.twitch.tv'); } catch {} }, 4 * 60 * 1000);
  }
  _stopHeartbeat() { if (this.heartbeat) { clearInterval(this.heartbeat); this.heartbeat = null; } }

  _handleRaw(data) {
    const lines = data.split('\r\n').filter(Boolean);
    for (const line of lines) {
      if (line.startsWith('PING')) { this._send(line.replace('PING', 'PONG')); continue; }
      let rest = line;
      let tags = {};
      if (rest[0] === '@') {
        const space = rest.indexOf(' ');
        const rawTags = rest.slice(1, space).split(';');
        rawTags.forEach(kv => { const [k,v] = kv.split('='); tags[k] = v; });
        rest = rest.slice(space + 1);
      }
      let prefix = '';
      if (rest[0] === ':') {
        const space = rest.indexOf(' ');
        prefix = rest.slice(1, space);
        rest = rest.slice(space + 1);
      }
      const cmdEnd = rest.indexOf(' ');
      const command = cmdEnd === -1 ? rest : rest.slice(0, cmdEnd);
      rest = cmdEnd === -1 ? '' : rest.slice(cmdEnd + 1);
      if (command === 'PRIVMSG') {
        const idx = rest.indexOf(' :');
        const message = idx === -1 ? '' : rest.slice(idx + 2);
        let username = tags['display-name'] || '';
        if (!username && prefix) {
          const excl = prefix.indexOf('!');
          if (excl > 0) username = prefix.slice(0, excl);
        }
        if (this.onMessage) this.onMessage({ username: (username||'').toLowerCase(), 'display-name': username }, message);
      }
    }
  }
}
