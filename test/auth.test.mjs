import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createGameService } from '../service.mjs';

test('with email configured, codes are random and the 123456 fallback is refused', async () => {
  const sent = [];
  const handle = createGameService(new DatabaseSync(':memory:'), { sendEmail: async message => { sent.push(message); } });
  let cookie = '';
  const auth = async input => {
    const response = await handle(new Request('http://city.test/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(input) }));
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: response.status, data: await response.json() };
  };
  const signup = await auth({ type: 'sendCode', purpose: 'signup', email: 'ada@example.com', name: 'Ada', username: 'ada', adult: true });
  assert.equal(signup.status, 200);
  assert.equal(signup.data.fallback, false);
  assert.equal(sent.length, 1);
  assert.match(sent[0].code, /^\d{6}$/);
  if (sent[0].code !== '123456') assert.equal((await auth({ type: 'verifyCode', email: 'ada@example.com', code: '123456' })).status, 400, 'the fallback code does not work');
  assert.equal((await auth({ type: 'verifyCode', email: 'ada@example.com', code: sent[0].code })).status, 200);
});
