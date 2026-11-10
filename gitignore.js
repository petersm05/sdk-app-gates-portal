// Enough of git's .gitignore rules to upload only what git would commit:
// nested .gitignore files, negation, dir-only patterns, anchoring, *, ** and ?.
// A file inside an ignored folder stays ignored, as in git.
// Usage: const ignored = GatesIgnore.compile([{ dir: 'app', text: '<.gitignore contents>' }]); ignored('app/src/x.ts')
(function (root) {
  'use strict';

  function globToRegex(glob) {
    let out = '';
    for (let i = 0; i < glob.length; i++) {
      const c = glob[i];
      if (c === '*') {
        if (glob[i + 1] === '*') {
          // "**/" matches zero or more folders; a trailing "**" matches everything below.
          if (glob[i + 2] === '/') { out += '(?:.*/)?'; i += 2; }
          else { out += '.*'; i += 1; }
        } else out += '[^/]*';
      } else if (c === '?') out += '[^/]';
      else if (c === '\\' && i + 1 < glob.length) { out += glob[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
      else out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return out;
  }

  function compile(gitignores) {
    const rules = [];
    // Shallow files first, so a deeper .gitignore can override its parent.
    const sorted = [...gitignores].sort((a, b) => depth(a.dir) - depth(b.dir));
    for (const { dir, text } of sorted) {
      const base = dir ? `${dir.replace(/\/+$/, '')}/` : '';
      for (let line of text.split(/\r?\n/)) {
        line = line.replace(/(?<!\\)\s+$/, '');
        if (!line || line.startsWith('#')) continue;
        let negate = false;
        if (line.startsWith('!')) { negate = true; line = line.slice(1); }
        if (line.startsWith('\\#') || line.startsWith('\\!')) line = line.slice(1);
        let dirOnly = false;
        if (line.endsWith('/')) { dirOnly = true; line = line.replace(/\/+$/, ''); }
        const anchored = line.includes('/');
        line = line.replace(/^\//, '');
        const body = globToRegex(line);
        const re = new RegExp(`^${escape(base)}${anchored ? '' : '(?:.*/)?'}${body}$`);
        rules.push({ base, re, negate, dirOnly });
      }
    }

    const test = (path, isDir) => {
      let ignored = false;
      for (const r of rules) {
        if (!path.startsWith(r.base)) continue;
        if (r.dirOnly && !isDir) continue;
        if (r.re.test(path)) ignored = !r.negate;
      }
      return ignored;
    };

    return function isIgnored(path) {
      const parts = path.split('/');
      for (let i = 1; i < parts.length; i++) {
        if (test(parts.slice(0, i).join('/'), true)) return true;
      }
      return test(path, false);
    };
  }

  const depth = (dir) => (dir ? dir.split('/').length : 0);
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  root.GatesIgnore = { compile };
})(typeof window !== 'undefined' ? window : globalThis);
