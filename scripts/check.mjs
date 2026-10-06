import { spawnSync } from 'node:child_process';
for (const file of ['server.mjs', 'service.mjs', 'storage.mjs', 'game.mjs', 'public/app.js', 'public/content.js', 'public/camera.js', 'public/movement.js', 'public/world.js', 'netlify/functions/game.mts']) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
