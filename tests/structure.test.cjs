const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = () => fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('entry page loads local styles and ordered classic scripts without inline code', () => {
  const source = html();
  assert.equal(/<style\b/i.test(source), false, 'styles live in external assets');
  assert.equal(/<script\b(?![^>]*\bsrc=)/i.test(source), false, 'scripts live in external assets');
  const scripts = [...source.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"[^>]*>/gi)];
  const styles = [...source.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/gi)];
  assert.ok(scripts.length > 3, 'scripts are split by responsibility');
  assert.ok(styles.length > 1, 'styles are split by responsibility');
  assert.equal(scripts[0][2], 'assets/js/engine/git-sim.js');
  assert.equal(scripts.at(-1)[2], 'assets/js/app.js');
  for (const match of scripts) {
    assert.match(match[0], /\bdefer\b/);
    assert.doesNotMatch(match[0], /\btype="module"/);
  }
  for (const relative of [...scripts.map(match => match[2]), ...styles.map(match => match[1])]) {
    assert.match(relative, /^assets\//);
    assert.ok(fs.statSync(path.join(root, relative)).isFile(), relative);
  }
});

test('index.html is the only visible file in the root directory', () => {
  const files = fs.readdirSync(root, {withFileTypes: true})
    .filter(entry => entry.isFile() && !entry.name.startsWith('.'))
    .map(entry => entry.name);
  assert.deepEqual(files, ['index.html']);
  assert.ok(fs.existsSync(path.join(root, '.gitignore')));
  assert.ok(fs.existsSync(path.join(root, 'docs', 'README.md')));
  assert.ok(fs.existsSync(path.join(root, 'docs', 'LICENSE')));
});
