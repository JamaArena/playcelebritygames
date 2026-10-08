import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createGameService } from '../service.mjs';

test('accounts are a username and password; older accounts set a password while signed in', async () => {
  const db = new DatabaseSync(':memory:');
  const handle = createGameService(db);
  const browser = () => {
    let cookie = '';
    return async input => {
      const response = await handle(new Request('http://city.test/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(input) }));
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      return { status: response.status, data: await response.json() };
    };
  };
  const ada = browser(), laptop = browser();
  assert.equal((await ada({ type: 'signup', username: 'ada', password: 'adaada88', adult: true })).status, 200);
  const stored = db.prepare('SELECT email, password_hash FROM accounts WHERE username = ?').get('ada');
  assert.match(stored.password_hash, /^scrypt\$/, 'passwords are stored hashed');
  assert.ok(!stored.password_hash.includes('adaada88'));
  assert.equal(stored.email.includes('@'), false, 'no email is needed');
  assert.equal((await laptop({ type: 'login', username: 'ada', password: 'adaada89' })).status, 400);
  assert.equal((await laptop({ type: 'login', username: 'ada', password: 'adaada88' })).status, 200);
  // An account from the email-code days: it cannot be claimed by username alone, and sets a password while signed in.
  db.prepare("INSERT INTO accounts(player_id, email, username, name, created) VALUES ('old-player', 'old@example.com', 'oldie', 'Oldie', 1)").run();
  db.prepare("INSERT INTO players VALUES ('old-player', 'null', ?, 1)").run('x'.repeat(64));
  assert.equal((await laptop({ type: 'login', username: 'oldie', password: 'anything1' })).status, 400);
  const changed = await ada({ type: 'setPassword', current: 'wrong', password: 'newpass88' });
  assert.equal(changed.status, 400, 'changing a password needs the current one');
  assert.equal((await ada({ type: 'setPassword', current: 'adaada88', password: 'newpass88' })).status, 200);
  assert.equal((await laptop({ type: 'login', username: 'ada', password: 'newpass88' })).status, 200);
});
