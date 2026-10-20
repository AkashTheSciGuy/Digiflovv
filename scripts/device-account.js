'use strict';
(async () => {
  const result = document.getElementById('connection-result');
  try {
    const config = window.DIGIFLOVV_AUTH_CONFIG;
    const client = window.DigiFlovvCreateClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) return;
    const headers = { Authorization: `Bearer ${data.session.access_token}` };
    const response = await fetch('/api/device-account', { headers, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Unavailable');
    const account = await response.json();
    document.getElementById('connection-account').textContent = account.userId;
    result.textContent = account.linked ? 'Your account has an explicit device link.' : 'Your account is verified. Device linking is pending.';
    if (account.linked) {
      const devicesResponse = await fetch('/api/devices', { headers, signal: AbortSignal.timeout(20000) });
      if (!devicesResponse.ok) throw new Error('Unavailable');
      const { devices } = await devicesResponse.json();
      document.getElementById('connection-devices').textContent = devices.map(device => `${device.name}: ${device.online ? 'Online' : 'Offline'} (RainMaker reported)`).join('; ') || 'No accessible RainMaker devices found.';
    }
  } catch {
    result.textContent = 'The local connection check is unavailable. Keep the local server running and reload to retry.';
  }
})();
