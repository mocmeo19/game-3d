/** Coarse walkability grid + A* so bots can route around shelters, crates and trees. */

export interface P2 {
  x: number;
  z: number;
}

export class NavGrid {
  // Keep pathfinding work bounded as the survival map grows.
  readonly cell: number;
  readonly n: number;
  private readonly walk: Uint8Array;
  /** Open cell centres can still have a thin wall or fence between them: `east` / `south` say whether the step to that neighbour is free. */
  private readonly east: Uint8Array;
  private readonly south: Uint8Array;
  /** Which connected area each open cell belongs to: a goal in another area cannot be reached, so the search is skipped. */
  private readonly region: Int32Array;
  // search buffers, reused between paths (a stamp tells which entries belong to the current search)
  private readonly gv: Float32Array;
  private readonly came: Int32Array;
  private readonly open: Uint32Array;
  private readonly shut: Uint32Array;
  private stamp = 0;

  /** `cellSize` overrides the default cell (a coarse 2 m+ grid keeps the search bounded; a finer one finds narrow gaps and thin walls). */
  constructor(private readonly half: number, private readonly isBlocked: (x: number, z: number) => boolean, cellSize?: number) {
    this.cell = cellSize ?? Math.max(2, Math.ceil((half * 2) / 110));
    this.n = Math.floor((half * 2) / this.cell);
    const n = this.n;
    this.walk = new Uint8Array(n * n);
    this.east = new Uint8Array(n * n);
    this.south = new Uint8Array(n * n);
    this.gv = new Float32Array(n * n);
    this.came = new Int32Array(n * n);
    this.open = new Uint32Array(n * n);
    this.shut = new Uint32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) this.walk[j * n + i] = isBlocked(this.cx(i), this.cx(j)) ? 0 : 1;
    const free = (x0: number, z0: number, x1: number, z1: number) => {
      for (const t of [0.25, 0.5, 0.75]) if (isBlocked(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false;
      return true;
    };
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        if (!this.walk[k]) continue;
        if (i + 1 < n && this.walk[k + 1]) this.east[k] = free(this.cx(i), this.cx(j), this.cx(i + 1), this.cx(j)) ? 1 : 0;
        if (j + 1 < n && this.walk[k + n]) this.south[k] = free(this.cx(i), this.cx(j), this.cx(i), this.cx(j + 1)) ? 1 : 0;
      }
    this.region = this.labelRegions();
  }

  /** Flood-fills the open cells with the same steps the search takes, one label per connected area (-1 for blocked cells). */
  private labelRegions() {
    const n = this.n;
    const region = new Int32Array(n * n).fill(-1);
    const queue = new Int32Array(n * n);
    let label = 0;
    for (let seed = 0; seed < n * n; seed++) {
      if (!this.walk[seed] || region[seed] >= 0) continue;
      region[seed] = label;
      let head = 0;
      let tail = 0;
      queue[tail++] = seed;
      while (head < tail) {
        const k = queue[head++];
        const i = k % n;
        const j = Math.floor(k / n);
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            if ((!di && !dj) || !this.canStep(i, j, di, dj)) continue;
            const nk = (j + dj) * n + i + di;
            if (region[nk] >= 0) continue;
            region[nk] = label;
            queue[tail++] = nk;
          }
      }
      label++;
    }
    return region;
  }

  /** Is this spot inside a wall or obstacle (for bots steering around what is right in front of them). */
  blockedAt(x: number, z: number) {
    return this.isBlocked(x, z);
  }

  /** A step from cell (i, j) to its neighbour (i + di, j + dj) crosses no wall (diagonals need both side steps free). */
  private canStep(i: number, j: number, di: number, dj: number) {
    const n = this.n;
    const ni = i + di;
    const nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= n || nj >= n || !this.walk[nj * n + ni]) return false;
    const edgeX = (a: number, b: number, bj: number) => (a < b ? this.east[bj * n + a] : this.east[bj * n + b]) === 1;
    const edgeZ = (aj: number, bj: number, bi: number) => (aj < bj ? this.south[aj * n + bi] : this.south[bj * n + bi]) === 1;
    if (!di) return edgeZ(j, nj, i) === true;
    if (!dj) return edgeX(i, ni, j) === true;
    // diagonal: go east/west then north/south, or the other way round, both ways must be free
    return this.walk[j * n + ni] === 1 && this.walk[nj * n + i] === 1 && edgeX(i, ni, j) && edgeZ(j, nj, ni) && edgeZ(j, nj, i) && edgeX(i, ni, nj);
  }

  private cx(i: number) {
    return -this.half + (i + 0.5) * this.cell;
  }
  private idx(p: P2) {
    const i = Math.max(0, Math.min(this.n - 1, Math.floor((p.x + this.half) / this.cell)));
    const j = Math.max(0, Math.min(this.n - 1, Math.floor((p.z + this.half) / this.cell)));
    return j * this.n + i;
  }
  walkable(p: P2) {
    return this.walk[this.idx(p)] === 1;
  }

  /** Closest walkable cell index to a cell (searching outward a few rings). */
  private nearestOpen(k: number) {
    if (this.walk[k]) return k;
    const i0 = k % this.n;
    const j0 = Math.floor(k / this.n);
    for (let r = 1; r < 8; r++)
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = i0 + di;
          const j = j0 + dj;
          if (i >= 0 && j >= 0 && i < this.n && j < this.n && this.walk[j * this.n + i]) return j * this.n + i;
        }
    return -1;
  }

  /** A straight walk between two points stays on open cells. */
  clear(a: P2, b: P2) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(d / (this.cell * 0.4));
    const n = this.n;
    let prev = this.idx(a);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      if (!this.walkable(p)) return false;
      const k = this.idx(p);
      if (k !== prev) {
        // every change of cell must be a free step (a sample can skip a cell: walk it through its neighbours)
        let i = prev % n;
        let j = Math.floor(prev / n);
        const ti = k % n;
        const tj = Math.floor(k / n);
        while (i !== ti || j !== tj) {
          const di = Math.sign(ti - i);
          const dj = Math.sign(tj - j);
          if (!this.canStep(i, j, di, dj)) return false;
          i += di;
          j += dj;
        }
        prev = k;
      }
    }
    return true;
  }

  /** Waypoints from `from` to `to` (start excluded), string-pulled. Empty when unreachable. */
  path(from: P2, to: P2): P2[] {
    const n = this.n;
    const start = this.nearestOpen(this.idx(from));
    const goal = this.nearestOpen(this.idx(to));
    if (start < 0 || goal < 0 || this.region[start] !== this.region[goal]) return [];
    if (start === goal) return [to];
    const stamp = ++this.stamp;
    const g = this.gv;
    const came = this.came;
    const open = this.open;
    const shut = this.shut;
    const heap: [number, number][] = [];
    const push = (f: number, k: number) => {
      heap.push([f, k]);
      for (let i = heap.length - 1; i > 0; ) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        for (let i = 0; ; ) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    const gi = goal % n;
    const gj = Math.floor(goal / n);
    const h = (k: number) => {
      const dx = Math.abs((k % n) - gi);
      const dz = Math.abs(Math.floor(k / n) - gj);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    g[start] = 0;
    open[start] = stamp;
    came[start] = -1;
    push(h(start), start);
    let found = false;
    while (heap.length) {
      const [, k] = pop();
      if (shut[k] === stamp) continue;
      if (k === goal) {
        found = true;
        break;
      }
      shut[k] = stamp;
      const i = k % n;
      const j = Math.floor(k / n);
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
          const nk = nj * n + ni;
          if (!this.walk[nk] || shut[nk] === stamp) continue;
          // no cutting corners past a blocked cell and no stepping through a wall between two open cells
          if (!this.canStep(i, j, di, dj)) continue;
          const cost = g[k] + (di && dj ? 1.414 : 1);
          if (open[nk] !== stamp || cost < g[nk]) {
            open[nk] = stamp;
            g[nk] = cost;
            came[nk] = k;
            push(cost + h(nk), nk);
          }
        }
    }
    if (!found) return [];
    const cells: P2[] = [];
    for (let k = goal; k !== start && k >= 0; k = came[k]) cells.push({ x: this.cx(k % n), z: this.cx(Math.floor(k / n)) });
    cells.reverse();
    if (this.walkable(to)) cells[cells.length - 1] = to;
    const out: P2[] = [];
    let anchor = from;
    for (let a = 0; a < cells.length; ) {
      let b = cells.length - 1;
      while (b > a && !this.clear(anchor, cells[b])) b--;
      out.push(cells[b]);
      anchor = cells[b];
      a = b + 1;
    }
    return out;
  }
}
