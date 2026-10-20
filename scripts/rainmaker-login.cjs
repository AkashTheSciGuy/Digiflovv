'use strict';
const URL = 'https://api.rainmaker.espressif.com/v1/';
function createRainMakerLogin({ fetcher = fetch, onError = () => {} } = {}) {
  async function call(path, body, token) {
    const operation = path.startsWith('logout2') ? 'revoke' : body.verification_code ? 'verify' : body.refreshtoken ? 'refresh' : 'start';
    let response;
    try { response = await fetcher(URL + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
      body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(12000)
    }); } catch (error) {
      onError({ service: 'RainMakerLogin', operation, failure: error?.name === 'TimeoutError' ? 'timeout' : 'transport' });
      throw new Error('RainMaker sign-in unavailable');
    }
    if (!response.ok) {
      let code;
      try { const body = await response.json(); const candidate = String(body.error_code ?? body.code ?? ''); if (/^\d{1,6}$/.test(candidate)) code = candidate; } catch { /* Ignore provider body content. */ }
      onError({ service: 'RainMakerLogin', operation, status: response.status, ...(code ? { code } : {}) });
      throw new Error('RainMaker sign-in unavailable');
    }
    return response.json();
  }
  return {
    async start(email) {
      const result = await call('login2', { user_name: email });
      if (result.status !== 'success' || typeof result.session !== 'string' || result.session.length < 10 || result.session.length > 16000) {
        onError({ service: 'RainMakerLogin', operation: 'start', failure: 'session-not-issued' });
        throw new Error('RainMaker sign-in unavailable');
      }
      return result.session;
    },
    async verify(email, session, code) {
      const result = await call('login2', { user_name: email, session, verification_code: code });
      if (result.status !== 'success' || typeof result.refreshtoken !== 'string' || result.refreshtoken.length < 100 || result.refreshtoken.length > 6000 || /\s/.test(result.refreshtoken))
        throw new Error('RainMaker sign-in unavailable');
      return result.refreshtoken;
    },
    async revoke(refreshToken) {
      const result = await call('login2', { refreshtoken: refreshToken });
      if (typeof result.accesstoken !== 'string') throw new Error('RainMaker sign-in unavailable');
      await call('logout2?logout_all=false', { refreshtoken: refreshToken }, result.accesstoken);
    }
  };
}
module.exports = { createRainMakerLogin };
