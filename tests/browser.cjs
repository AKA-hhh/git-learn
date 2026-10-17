const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const artifacts = path.join(__dirname, 'artifacts');
const legacy = fs.readFileSync(path.join(__dirname, 'fixtures', 'legacy-session.json'), 'utf8');
const results = [];
fs.mkdirSync(artifacts, {recursive: true});

function launchOptions() {
  const candidates = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'];
  const executablePath = candidates.find(candidate => candidate && fs.existsSync(candidate));
  return {headless: true, ...(executablePath ? {executablePath} : {})};
}

function serve() {
  const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8'};
  const server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/favicon.ico') {response.writeHead(204).end(); return;}
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + path.sep) || !fs.statSync(file).isFile()) throw Error('Not found');
      response.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
      fs.createReadStream(file).pipe(response);
    } catch {response.writeHead(404).end();}
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function command(page, line, error = false) {
  const previous = await page.evaluate(() => GitAtlas.session.history.length);
  const input = await page.locator('#mobile-command-input').isVisible()
    ? page.locator('#mobile-command-input') : page.locator('#command-input');
  await input.fill(line);
  await input.press('Enter');
  await page.waitForFunction(count => GitAtlas.session.history.length > count, previous);
  const entry = await page.evaluate(() => GitAtlas.session.history.at(-1));
  assert.equal(entry.error, error, line + ': ' + entry.output);
  return entry;
}

async function newFile(page, name, content) {
  await page.locator('#new-file').click();
  await page.locator('#file-path').fill(name);
  await page.locator('#file-content').fill(content);
  await page.locator('#file-form button[type="submit"]').click();
  await page.locator('#file-dialog').waitFor({state: 'hidden'});
}

async function closeDialog(page, id) {
  await page.locator('#' + id + ' [data-close="' + id + '"]').first().click();
  await page.locator('#' + id).waitFor({state: 'hidden'});
}

async function withPage(browser, url, action, options = {}) {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
  if (options.legacy) {
    await context.addInitScript(raw => {
      if (!sessionStorage.getItem('legacy-fixture-loaded')) {
        localStorage.setItem('git-atlas-v1', raw);
        sessionStorage.setItem('legacy-fixture-loaded', 'yes');
      }
    }, legacy);
  }
  const page = await context.newPage();
  const errors = [], failedAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failedAssets.push(request.url() + ': ' + request.failure()?.errorText));
  page.on('response', response => {if (response.status() >= 400) failedAssets.push(response.url() + ': ' + response.status());});
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.GitAtlas && document.querySelectorAll('#zones .zone').length === 4);
    await action(page);
    assert.deepEqual(errors, [], 'Browser runtime errors');
    assert.deepEqual(failedAssets, [], 'Missing assets');
  } catch (error) {
    await page.screenshot({path: path.join(artifacts, 'failure-' + Date.now() + '.png'), fullPage: true}).catch(() => {});
    throw error;
  } finally {await context.close();}
}

async function lessons(page) {
  const before = await page.evaluate(() => StateManager.encode(GitAtlas.simulator.state));
  const summary = await page.evaluate(() => {
    LessonDemo.cache.clear();
    return LessonExampleData.map(example => {
      const prepared = LessonDemo.prepare(example);
      return {id: example.id, steps: example.steps.length, states: prepared.states.length};
    });
  });
  assert.equal(summary.length, 22);
  assert.equal(summary.reduce((sum, item) => sum + item.steps, 0), 96);
  assert.ok(summary.every(item => item.states === item.steps + 1));
  assert.equal(await page.evaluate(() => StateManager.encode(GitAtlas.simulator.state)), before, 'Lessons must not change the main repository');
  await page.locator('#open-lessons').click();
  assert.equal(await page.locator('#lessons-dialog').isVisible(), true);
  await page.locator('[data-demo-action="advance"]').click();
  await page.locator('[data-demo-phase="after"][aria-pressed="true"]').waitFor();
  await closeDialog(page, 'lessons-dialog');
  return {examples: summary.length, steps: 96};
}

async function fileWorkflow(page) {
  const originalHead = await page.evaluate(() => GitAtlas.simulator.head());
  await command(page, 'git checkout -b feature');
  assert.equal(await page.locator('#terminal-branch').textContent(), 'feature');
  await newFile(page, 'draft.txt', 'feature draft');
  await command(page, 'git switch main');
  assert.equal(await page.evaluate(() => GitAtlas.simulator.state.workingTree['draft.txt']), 'feature draft');
  assert.equal(await page.evaluate(() => GitAtlas.simulator.head()), originalHead);
  assert.equal(await page.evaluate(() => GitAtlas.simulator.tree()['draft.txt']), undefined);
  await command(page, 'git switch feature');
  await command(page, 'git add draft.txt');
  await command(page, 'git commit -m "feature file"');
  await command(page, 'git switch main');
  assert.equal(await page.evaluate(() => GitAtlas.simulator.state.workingTree['draft.txt']), undefined);
  await command(page, 'git switch feature');
  await page.locator('[data-zone="working"] [data-file="draft.txt"]').click();
  await page.locator('#file-view-editor').fill('edited draft');
  await page.locator('#file-view-path').fill('notes/feature.txt');
  await page.locator('#file-view-save').click();
  await page.locator('#file-view-dialog').waitFor({state: 'hidden'});
  assert.deepEqual(await page.evaluate(() => ({work: GitAtlas.simulator.state.workingTree['notes/feature.txt'], index: GitAtlas.simulator.state.index['draft.txt']})), {work: 'edited draft', index: 'feature draft'});
  await command(page, 'git add -A');
  await command(page, 'git commit -m "rename draft"');
  await page.locator('[data-zone="working"] [data-file="notes/feature.txt"]').click();
  await page.locator('#file-view-delete').click();
  await page.locator('#file-view-dialog').waitFor({state: 'hidden'});
  await command(page, 'git restore notes/feature.txt');
  assert.equal(await page.evaluate(() => GitAtlas.simulator.state.workingTree['notes/feature.txt']), 'edited draft');
  await command(page, 'git help merge');
  assert.match(await page.locator('#terminal-output').textContent(), /git merge/);
  await command(page, 'git status');
  const count = await page.evaluate(() => GitAtlas.session.history.length);
  await page.locator('#open-history').click();
  await page.locator('#history-search').fill('git status');
  await page.locator('[data-history-tab]').first().click();
  assert.equal(await page.evaluate(() => GitAtlas.session.history.length), count, 'Selecting history must not replay it');
  assert.equal(await page.locator('#history-detail [data-replay]').count(), 1);
  await closeDialog(page, 'history-dialog');
  await page.locator('#command-input').press('ArrowUp');
  assert.equal(await page.locator('#command-input').inputValue(), 'git status');
  await page.locator('#graph [data-commit]').last().press('Enter');
  assert.equal(await page.locator('#commit-inspector-dialog').isVisible(), true);
  assert.ok((await page.locator('#commit-inspector-meta').textContent()).length > 0);
  await closeDialog(page, 'commit-inspector-dialog');
  await page.locator('#open-repository-info').click();
  assert.equal(await page.locator('#repository-info-dialog').isVisible(), true);
  await closeDialog(page, 'repository-info-dialog');
}

async function conflictWorkflow(page) {
  await page.evaluate(() => Scenarios.select('conflict'));
  const ours = await page.evaluate(() => GitAtlas.simulator.state.workingTree['README.md']);
  await command(page, 'git merge feature');
  assert.deepEqual(await page.evaluate(() => GitAtlas.simulator.state.conflicts), ['README.md']);
  await newFile(page, 'valuable.txt', 'keep this unrelated draft');
  await command(page, 'git merge --abort');
  assert.equal(await page.evaluate(() => GitAtlas.simulator.state.workingTree['valuable.txt']), 'keep this unrelated draft');
  assert.equal(await page.evaluate(() => GitAtlas.simulator.state.workingTree['README.md']), ours);
  await command(page, 'git merge feature');
  await command(page, 'git checkout HEAD -- README.md');
  assert.deepEqual(await page.evaluate(() => GitAtlas.simulator.state.conflicts), []);
  await command(page, 'git commit -m "resolve using ours"');
  assert.equal(await page.evaluate(() => GitAtlas.simulator.state.commits.get(GitAtlas.simulator.head()).parents.length), 2);
}

async function persistence(page) {
  await command(page, 'git config --global user.name "Browser Learner"');
  await command(page, 'git checkout -b saved-branch');
  await newFile(page, 'saved.txt', 'draft survives reload');
  await page.locator('#theme-toggle').click();
  const before = JSON.parse(await page.evaluate(() => localStorage.getItem('git-atlas-v1')));
  await page.reload();
  await page.waitForFunction(() => window.GitAtlas);
  const after = JSON.parse(await page.evaluate(() => localStorage.getItem('git-atlas-v1')));
  assert.deepEqual(after, before, 'Complete v1 session round trip');
  assert.equal(await page.locator('#terminal-branch').textContent(), 'saved-branch');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
}

async function stashSafety(page) {
  await page.locator('#reset-repo').click();
  await page.locator('#reset-template-empty').check();
  await page.locator('#confirm-reset').click();
  await command(page, 'git init');
  await newFile(page, 'base.txt', 'base');
  await command(page, 'git add base.txt');
  await command(page, 'git commit -m base');
  await newFile(page, 'dir/file.txt', 'saved');
  await command(page, 'git add dir/file.txt');
  await command(page, 'git stash push');
  await newFile(page, 'dir', 'valuable unrelated file');
  const before = await page.evaluate(() => StateManager.encode(GitAtlas.simulator.state));
  await command(page, 'git stash pop', true);
  assert.equal(await page.evaluate(() => StateManager.encode(GitAtlas.simulator.state)), before, 'Rejected stash is atomic and retains the saved entry');
  assert.equal(await page.evaluate(() => GitAtlas.simulator.state.workingTree.dir), 'valuable unrelated file');
  assert.equal(await page.evaluate(() => GitAtlas.simulator.state.stash.length), 1);
}

async function legacySession(page) {
  assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('git-atlas-v1'))), JSON.parse(legacy), 'Original-format session loads unchanged');
  assert.deepEqual(await page.evaluate(() => GitAtlas.simulator.state.conflicts), ['README.md']);
  await command(page, 'git merge --abort');
  assert.equal(await page.evaluate(() => GitAtlas.simulator.state.workingTree['during-conflict.txt']), 'keep this draft');
  await command(page, 'git stash pop');
  assert.equal(await page.evaluate(() => GitAtlas.simulator.state.workingTree['legacy-note.txt']), 'original draft');
  assert.equal(await page.evaluate(() => GitAtlas.simulator.state.stash.length), 0);
}

async function layouts(page, transport) {
  const viewports = [{name: 'desktop', width: 1440, height: 1000}, {name: 'wide', width: 1920, height: 1080},
    {name: 'mobile', width: 390, height: 844}, {name: 'small', width: 320, height: 700}];
  for (const viewport of viewports) {
    await page.setViewportSize({width: viewport.width, height: viewport.height});
    for (const theme of ['light', 'dark']) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('#theme-toggle').click();
      await page.screenshot({path: path.join(artifacts, transport + '-' + viewport.name + '-' + theme + '.png'), fullPage: true});
      const overflow = await page.evaluate(() => ({page: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth}));
      assert.ok(overflow.page <= overflow.viewport + 1, JSON.stringify({viewport, theme, overflow}));
      assert.equal(await page.locator('#zones .zone').count(), 4);
      assert.ok(await page.locator('#graph [data-commit]').count() > 0);
    }
    await command(page, 'git status');
    await page.locator('#open-reference').click();
    assert.equal(await page.locator('#reference-dialog').isVisible(), true);
    const dialog = await page.locator('#reference-dialog').boundingBox();
    assert.ok(dialog.x >= -1 && dialog.x + dialog.width <= viewport.width + 1);
    await closeDialog(page, 'reference-dialog');
  }
  return {viewports: 4, themes: 2};
}

async function main() {
  const server = await serve();
  let browser;
  try {
    browser = await chromium.launch(launchOptions());
    const urls = {file: pathToFileURL(path.join(root, 'index.html')).href, http: 'http://127.0.0.1:' + server.address().port + '/'};
    for (const [transport, url] of Object.entries(urls)) {
      const checks = [['lessons', lessons], ['file-workflow', fileWorkflow], ['conflicts', conflictWorkflow], ['stash-safety', stashSafety],
        ['persistence', persistence], ['legacy-session', legacySession], ['layouts', page => layouts(page, transport)]];
      for (const [name, check] of checks) {
        try {
          let detail;
          await withPage(browser, url, async page => {detail = await check(page);}, {legacy: name === 'legacy-session'});
          results.push({transport, name, passed: true, ...detail});
          console.log('PASS ' + transport + ': ' + name + (detail ? ' ' + JSON.stringify(detail) : ''));
        } catch (error) {
          results.push({transport, name, passed: false, error: error.stack || String(error)});
          console.error('FAIL ' + transport + ': ' + name + '\n' + (error.stack || error));
        }
      }
    }
    fs.writeFileSync(path.join(artifacts, 'browser-results.json'), JSON.stringify(results, null, 2) + '\n');
    assert.ok(results.every(result => result.passed), results.filter(result => !result.passed).length + ' browser checks failed');
    console.log(results.length + ' browser checks passed; screenshots in tests/artifacts/.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {console.error(error); process.exitCode = 1;});
