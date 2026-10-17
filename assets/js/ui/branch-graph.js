    /* BranchGraph: parent edges, reference badges and independent pan/zoom. */
    const BranchGraph = {
      /* Horizontal commit DAG. The surrounding app supplies $, escapeHTML, sim, session, and view. */
      color(branch) {
        const colors = session?.theme === 'dark'
          ? ['#94d2b0', '#d7b86e', '#c2a8dc', '#8db8d8', '#e1a38e', '#a5c794', '#d78fbd']
          : ['#348469', '#a57829', '#81639e', '#497c9c', '#ae6654', '#5d815f', '#ad5d88'];
        let n = 0;
        for (const ch of String(branch || 'main')) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
        return branch === 'main' ? colors[0] : colors[1 + n % (colors.length - 1)];
      },
      truncate(value, max = 28) {
        const text = String(value ?? '');
        return text.length > max ? text.slice(0, max - 1) + '…' : text;
      },
      refsFor(commit, state) {
        const refs = [];
        const current = typeof sim?.branch === 'function' ? sim.branch() : 'main';
        for (const [name, hash] of Object.entries(state.refs?.branches || {})) {
          if (hash === commit.hash) refs.push(current === name ? 'HEAD → ' + name : name);
        }
        for (const [name, hash] of Object.entries(state.refs?.tags || {})) {
          if (hash === commit.hash) refs.push('tag: ' + name);
        }
        for (const [name, hash] of Object.entries(state.refs?.remoteTracking || {})) {
          if (hash === commit.hash) refs.push(name);
        }
        if (current === '(detached)' && typeof sim?.head === 'function' && sim.head() === commit.hash) refs.unshift('HEAD (detached)');
        return refs;
      },
      render() {
        const graph = $('graph');
        if (!graph) return;
        const state = sim?.state;
        const commits = state?.commits instanceof Map ? [...state.commits.values()] : [];
        if (!commits.length) {
          graph.setAttribute('width', '640');
          graph.setAttribute('height', '180');
          graph.removeAttribute('viewBox');
          graph.removeAttribute('preserveAspectRatio');
          this.bounds = {width: 640, height: 180};
          graph.setAttribute('preserveAspectRatio', 'xMinYMid meet');
          graph.innerHTML = '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="var(--muted)" font-size="12">第一次 commit，将点亮这张地图。</text>';
          this.transform();
          return;
        }

        const byHash = new Map(commits.map(c => [c.hash, c]));
        const depth = new Map();
        const depthOf = (hash, trail = new Set()) => {
          if (depth.has(hash)) return depth.get(hash);
          if (trail.has(hash)) return 0;
          const commit = byHash.get(hash);
          if (!commit) {depth.set(hash, 0); return 0}
          const next = new Set(trail); next.add(hash);
          const parents = Array.isArray(commit.parents) ? commit.parents : [];
          const value = parents.length ? 1 + Math.max(...parents.map(parent => depthOf(parent, next))) : 0;
          depth.set(hash, value);
          return value;
        };
        for (const commit of commits) depthOf(commit.hash);

        const ordered = [...commits].sort((a, b) => {
          const d = (depth.get(a.hash) || 0) - (depth.get(b.hash) || 0);
          if (d) return d;
          const ta = Date.parse(a.timestamp || '') || 0, tb = Date.parse(b.timestamp || '') || 0;
          return ta - tb || String(a.hash).localeCompare(String(b.hash));
        });
        const lanes = [];
        for (const commit of ordered) {
          const lane = commit.branch || 'main';
          if (!lanes.includes(lane)) lanes.push(lane);
        }
        if (!lanes.includes('main')) lanes.unshift('main');
        const laneIndex = new Map(lanes.map((lane, index) => [lane, index]));
        const marginX = 100, marginY = 76, gapX = 210, laneGap = 86, minGap = 118, labelWidth = 180;
        const positions = new Map();
        for (const commit of ordered) {
          const lane = commit.branch || 'main';
          const laneNumber = laneIndex.get(lane) ?? 0;
          let x = marginX + (depth.get(commit.hash) || 0) * gapX;
          const parents = (commit.parents || []).map(hash => positions.get(hash)).filter(Boolean);
          if (parents.length) x = Math.max(x, ...parents.map(parent => parent.x + minGap));
          let collision = true;
          while (collision) {
            collision = false;
            for (const prior of positions.values()) {
              if (prior.lane === laneNumber && Math.abs(prior.x - x) < minGap) {x = prior.x + minGap; collision = true}
            }
          }
          positions.set(commit.hash, {x, y: marginY + laneNumber * laneGap, lane: laneNumber});
        }

        const maxX = Math.max(...[...positions.values()].map(point => point.x));
        const width = Math.max(640, maxX + labelWidth + marginX);
        const height = Math.max(180, marginY + (lanes.length - 1) * laneGap + 86);
        graph.setAttribute('width', String(width));
        graph.setAttribute('height', String(height));
        graph.removeAttribute('viewBox');
        graph.removeAttribute('preserveAspectRatio');
        this.bounds = {width, height};
        graph.setAttribute('preserveAspectRatio', 'xMinYMid meet');

        let laneMarkup = '';
        for (const lane of lanes) {
          const y = marginY + (laneIndex.get(lane) || 0) * laneGap;
          laneMarkup += `<line x1="${marginX - 28}" y1="${y}" x2="${width - marginX / 2}" y2="${y}" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 8" opacity=".55"/>`;
          laneMarkup += `<text x="14" y="${y + 4}" font-size="10" font-family="Consolas,monospace" fill="${this.color(lane)}">${escapeHTML(this.truncate(lane, 14))}</text>`;
        }

        let edges = '';
        for (const commit of ordered) {
          const point = positions.get(commit.hash), color = this.color(commit.branch || 'main');
          for (const parentHash of commit.parents || []) {
            const parent = positions.get(parentHash);
            if (!parent) continue;
            const bend = Math.max(34, Math.min(92, (point.x - parent.x) * .34));
            edges += `<path d="M${point.x},${point.y} C${point.x - bend},${point.y} ${parent.x + bend},${parent.y} ${parent.x},${parent.y}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity=".72"/>`;
          }
        }

        const active = view.commit, head = typeof sim?.head === 'function' ? sim.head() : null;
        let nodes = '';
        for (const commit of ordered) {
          const point = positions.get(commit.hash), color = this.color(commit.branch || 'main');
          const refs = this.refsFor(commit, state);
          const selected = active === commit.hash, isHead = head === commit.hash;
          const refText = refs.join(' · ') || commit.branch || 'main';
          const message = this.truncate(commit.message || '(no message)', 26);
          const hash = this.truncate(commit.hash || '', 16) + (commit.parents?.length > 1 ? ' · merge' : '');
          nodes += `<g class="graph-node${isHead ? ' is-head' : ''}${selected ? ' is-selected' : ''}" data-commit="${escapeHTML(commit.hash)}" role="button" tabindex="0" aria-pressed="${selected}" aria-haspopup="dialog" aria-label="${escapeHTML((isHead ? '当前 HEAD，' : '') + (selected ? '已选择，' : '') + (commit.hash || '') + ' ' + (commit.message || '') + '，查看提交快照')}">
        <title>${escapeHTML((commit.hash || '') + ' ' + (commit.message || '') + (refs.length ? ' · ' + refs.join(' · ') : ''))}</title>
        <text x="${point.x}" y="${point.y - 28}" text-anchor="middle" font-family="Consolas,monospace" font-size="10" fill="${isHead ? 'var(--graph-head-label)' : color}" font-weight="${isHead ? 700 : 400}">${escapeHTML(this.truncate(refText, 30))}</text>
        <circle class="node-hit-area" cx="${point.x}" cy="${point.y}" r="19" fill="transparent"/>
        ${isHead ? `<circle class="head-halo" cx="${point.x}" cy="${point.y}" r="12" fill="var(--graph-head-halo)"/>` : ''}
        ${selected ? `<circle class="selection-ring" cx="${point.x}" cy="${point.y}" r="17" fill="none" stroke="var(--graph-selected)" stroke-width="2" stroke-dasharray="4 3"/>` : ''}
        <circle class="commit-dot" cx="${point.x}" cy="${point.y}" r="${isHead ? 8 : commit.parents?.length > 1 ? 6.5 : 5.5}" fill="${isHead ? 'var(--graph-head)' : 'var(--surface)'}" stroke="${isHead ? 'var(--graph-head-border)' : color}" stroke-width="${isHead ? 2 : 2.7}"/>
        ${commit.parents?.length > 1 ? `<circle cx="${point.x}" cy="${point.y}" r="2" fill="${isHead ? 'var(--graph-head-border)' : color}"/>` : ''}
        <text x="${point.x}" y="${point.y + 22}" text-anchor="middle" font-size="12" fill="var(--ink)">${escapeHTML(message)}</text>
        <text x="${point.x}" y="${point.y + 37}" text-anchor="middle" font-family="Consolas,monospace" font-size="10" fill="var(--muted)">${escapeHTML(hash)}</text>
      </g>`;
        }
        graph.innerHTML = `<g id="graph-layer">${laneMarkup}${edges}${nodes}</g>`;
        this.transform();
      },
      transform() {
        const layer = $('graph-layer'), g = view.graph || (view.graph = {x: 0, y: 0, scale: 1});
        if (layer) layer.setAttribute('transform', `translate(${g.x || 0} ${g.y || 0}) scale(${g.scale || 1})`);
      },
      zoom(factor) {
        const graph = $('graph'), g = view.graph || (view.graph = {x: 0, y: 0, scale: 1});
        if (!graph) return;
        const rect = graph.getBoundingClientRect(), old = g.scale || 1;
        const next = Math.max(.25, Math.min(3, old * factor)), ratio = next / old;
        g.x = rect.width / 2 - (rect.width / 2 - (g.x || 0)) * ratio;
        g.y = rect.height / 2 - (rect.height / 2 - (g.y || 0)) * ratio;
        g.scale = next;
        this.transform();
      },
      fit() {
        const graph = $('graph'), layer = $('graph-layer'), g = view.graph || (view.graph = {x: 0, y: 0, scale: 1});
        if (!graph || !layer) return;
        const rect = graph.getBoundingClientRect(), bounds = this.bounds || {width: 640, height: 180};
        const width = bounds.width, height = bounds.height;
        const scale = Math.max(.25, Math.min(1, rect.width / width, rect.height / height));
        g.scale = scale; g.x = (rect.width - width * scale) / 2; g.y = (rect.height - height * scale) / 2;
        this.transform();
      }
    };






