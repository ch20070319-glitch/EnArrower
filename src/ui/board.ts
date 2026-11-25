import { cellKey, cellsOf, effectiveArrow, exitDistance, headDirOf, relayOf } from '../core/rules';
import { ArrowDef, Cell, DIR_VEC, GameState, GroupId, GROUP_SYMBOL, LevelDef } from '../core/types';

const CELL = 100;
const DIR_DEG: Record<string, number> = { right: 0, down: 90, left: 180, up: 270 };
const DIR_NAME: Record<string, string> = { up: '上', down: '下', left: '左', right: '右' };

const SVG_NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function pathD(pts: { x: number; y: number }[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

export interface BoardCallbacks {
  onActivate: (arrowId: string) => void;
  onHover: (arrowId: string | null) => void;
  onTurn: (arrowId: string) => void;
}

/**
 * SVG 棋盘视图。规则状态一律来自 GameState，DOM 只做呈现。
 * 动画使用 viewBox 网格单位，窗口尺寸变化不影响位移与碰撞结果。
 */
export class BoardView {
  readonly svg: SVGSVGElement;
  private level: LevelDef;
  private arrowsLayer: SVGGElement;
  private gatesLayer: SVGGElement;
  private relayLayer: SVGGElement;
  private lampLayer: SVGGElement;
  private arrowNodes = new Map<string, SVGGElement>();
  private gateNodes = new Map<string, SVGGElement>();
  private relayNodes = new Map<string, SVGLineElement>();
  private lampNodes = new Map<string, SVGGElement>();
  private cellNodes = new Map<string, SVGRectElement>();
  private timers = new Set<number>();
  private state: GameState | null = null;
  private selectedId: string | null = null;
  private callbacks: BoardCallbacks = { onActivate: () => {}, onHover: () => {}, onTurn: () => {} };

  constructor(container: HTMLElement, level: LevelDef) {
    this.level = level;
    container.innerHTML = '';
    const w = level.width * CELL;
    const h = level.height * CELL;
    this.svg = el('svg', {
      viewBox: `0 0 ${w} ${h}`,
      class: 'board-svg',
      role: 'group',
      'aria-label': `棋盘，宽 ${level.width} 格，高 ${level.height} 格`,
    });

    const defs = el('defs');
    defs.innerHTML = `
      <linearGradient id="grad-teal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5cb3a0"/><stop offset="0.55" stop-color="#3e8e7e"/><stop offset="1" stop-color="#2c6b5e"/>
      </linearGradient>
      <linearGradient id="grad-amber" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f0bc63"/><stop offset="0.55" stop-color="#d9932c"/><stop offset="1" stop-color="#b0741a"/>
      </linearGradient>
      <linearGradient id="grad-violet" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ab8ce0"/><stop offset="0.55" stop-color="#8a63c9"/><stop offset="1" stop-color="#68459f"/>
      </linearGradient>
      <linearGradient id="grad-coral" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e88a76"/><stop offset="0.55" stop-color="#d96a5b"/><stop offset="1" stop-color="#b04a3e"/>
      </linearGradient>`;
    this.svg.appendChild(defs);

    const cellsLayer = el('g', { 'aria-hidden': 'true' });
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        const rect = el('rect', {
          class: 'board-cell',
          x: x * CELL + 5,
          y: y * CELL + 5,
          width: CELL - 10,
          height: CELL - 10,
          rx: 14,
        });
        this.cellNodes.set(`${x},${y}`, rect);
        cellsLayer.appendChild(rect);
      }
    }
    this.svg.appendChild(cellsLayer);

    this.gatesLayer = el('g');
    this.relayLayer = el('g', { 'aria-hidden': 'true' });
    this.lampLayer = el('g');
    this.arrowsLayer = el('g');
    this.svg.appendChild(this.gatesLayer);
    this.svg.appendChild(this.relayLayer);
    this.svg.appendChild(this.lampLayer);
    this.svg.appendChild(this.arrowsLayer);
    container.appendChild(this.svg);
  }

  setCallbacks(cb: BoardCallbacks): void {
    this.callbacks = cb;
  }

  render(state: GameState): void {
    this.clearTimers();
    this.state = state;
    this.arrowsLayer.innerHTML = '';
    this.gatesLayer.innerHTML = '';
    this.relayLayer.innerHTML = '';
    this.lampLayer.innerHTML = '';
    this.arrowNodes.clear();
    this.gateNodes.clear();
    this.relayNodes.clear();
    this.lampNodes.clear();

    for (const c of this.level.lamps ?? []) {
      const key = cellKey(c);
      const lit = (state.lit ?? []).includes(key);
      const node = el('g', {
        class: `lamp ${lit ? 'lamp--lit' : ''}`,
        transform: `translate(${c.x * CELL + CELL / 2},${c.y * CELL + CELL / 2})`,
        role: 'img',
        'aria-label': `灯，${lit ? '已点亮' : '未点亮'}，第 ${c.x + 1} 列第 ${c.y + 1} 行`,
      });
      node.appendChild(el('circle', { class: 'lamp-glow', cx: 0, cy: 0, r: 30 }));
      node.appendChild(
        el('path', { class: 'lamp-house', d: 'M -18 2 L 0 -16 L 18 2 L 18 20 L -18 20 Z' }),
      );
      node.appendChild(el('rect', { class: 'lamp-door', x: -5, y: 8, width: 10, height: 12, rx: 2 }));
      this.lampLayer.appendChild(node);
      this.lampNodes.set(key, node);
    }

    for (const m of this.level.mechanisms) {
      const open = !!state.open[m.group];
      for (const g of m.gates) {
        const node = this.buildGate(g.x, g.y, m.group, open);
        this.gatesLayer.appendChild(node);
        this.gateNodes.set(cellKey(g), node);
      }
    }
    for (const id of state.remaining) {
      const arrow = this.level.arrows.find((a) => a.id === id)!;
      const node = this.buildArrow(arrow, state);
      this.arrowsLayer.appendChild(node);
      this.arrowNodes.set(id, node);
    }
    for (const r of this.level.relays ?? []) {
      if (!state.remaining.includes(r.leader) || !state.remaining.includes(r.follower)) continue;
      const a = this.level.arrows.find((x) => x.id === r.leader)!;
      const b = this.level.arrows.find((x) => x.id === r.follower)!;
      const line = el('line', {
        class: 'relay-link',
        x1: a.head.x * CELL + CELL / 2,
        y1: a.head.y * CELL + CELL / 2,
        x2: b.head.x * CELL + CELL / 2,
        y2: b.head.y * CELL + CELL / 2,
        'data-leader': r.leader,
        'data-follower': r.follower,
      });
      this.relayLayer.appendChild(line);
      this.relayNodes.set(r.leader, line);
    }
    if (this.selectedId && this.arrowNodes.has(this.selectedId)) {
      this.arrowNode(this.selectedId)?.classList.add('is-selected');
    }
  }

  private buildGate(x: number, y: number, group: GroupId, open: boolean): SVGGElement {
    const cx = x * CELL + CELL / 2;
    const cy = y * CELL + CELL / 2;
    const node = el('g', {
      class: `gate gate--${group} ${open ? 'gate--open' : 'gate--closed'}`,
      transform: `translate(${cx},${cy})`,
      'data-group': group,
      role: 'img',
      'aria-label': `${GROUP_SYMBOL[group]} 闸门，${open ? '开启' : '关闭'}，第 ${x + 1} 列第 ${y + 1} 行`,
    });
    node.appendChild(el('rect', { x: -34, y: -34, width: 68, height: 68, rx: 14 }));
    node.appendChild(el('rect', { class: 'gate-inner', x: -24, y: -24, width: 48, height: 48, rx: 9 }));
    const sym = el('text', { x: 0, y: 10 });
    sym.textContent = GROUP_SYMBOL[group];
    node.appendChild(sym);
    const label = el('text', { class: 'gate-label', x: 0, y: -44 });
    node.appendChild(label);
    return node;
  }

  private buildArrow(def: ArrowDef, state: GameState): SVGGElement {
    if (def.path) return this.buildPolyArrow(def);
    const arrow = effectiveArrow(def, state);
    const cx = arrow.head.x * CELL + CELL / 2;
    const cy = arrow.head.y * CELL + CELL / 2;
    const kind = def.reversible ? 'reversible' : def.group ? def.group : 'normal';
    const relay = relayOf(this.level, def.id);
    const relayNote = relay
      ? relay.leader === def.id
        ? `，接力领头（带 ${relay.follower} 一起离场）`
        : `，接力跟随（点 ${relay.leader} 启动）`
      : '';
    const mover = el('g', { class: 'arrow-mover', 'data-arrow-id': arrow.id });
    const node = el('g', {
      class: `arrow arrow--${kind}`,
      transform: `translate(${cx},${cy}) rotate(${DIR_DEG[arrow.dir]})`,
      tabindex: '0',
      role: 'button',
      'aria-label': (def.reversible
        ? `可调头箭头，当前向${DIR_NAME[arrow.dir]}，长度 ${arrow.len}：点箭身选中后发射，点尾部 ⇄ 徽记直接调头`
        : `箭头，向${DIR_NAME[arrow.dir]}，长度 ${arrow.len}${
            arrow.group ? `，${GROUP_SYMBOL[arrow.group]} 开关` : ''
          }，头部在第 ${arrow.head.x + 1} 列第 ${arrow.head.y + 1} 行`) +
        relayNote +
        (def.id === this.level.escort ? '，护送目标 ★' : ''),
    });
    const shape = el('g', { class: 'arrow-shape' });
    const back = (arrow.len - 1) * CELL;
    shape.appendChild(
      el('rect', { class: 'arrow-hit', x: -back - 50, y: -50, width: back + 100, height: 100 }),
    );
    shape.appendChild(
      el('rect', { class: 'arrow-body', x: -back - 44, y: -10, width: back + 40, height: 20, rx: 10 }),
    );
    shape.appendChild(
      el('rect', { class: 'arrow-sheen', x: -back - 38, y: -6.5, width: back + 28, height: 4, rx: 2 }),
    );
    shape.appendChild(el('path', { class: 'arrow-head', d: 'M 40 0 L -8 -22 L -8 22 Z' }));
    if (def.reversible) {
      // 第三轮：⇄ 徽记即调头按钮，独占尾格命中区；箭身其余格仍为选中/发射命中区。
      const turn = el('g', {
        class: 'arrow-turn',
        tabindex: '0',
        role: 'button',
        'aria-label': `调头按钮：当前向${DIR_NAME[arrow.dir]}，点击原地翻转 180 度`,
      });
      turn.appendChild(el('circle', { class: 'arrow-turn-hit', cx: -back, cy: 0, r: 50 }));
      turn.appendChild(el('circle', { class: 'arrow-badge arrow-badge--turn', cx: -back, cy: 0, r: 16 }));
      const sym = el('text', { class: 'arrow-badge-sym arrow-badge-sym--turn', x: -back, y: 6 });
      sym.textContent = '⇄';
      turn.appendChild(sym);
      turn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.callbacks.onTurn(arrow.id);
      });
      turn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          this.callbacks.onTurn(arrow.id);
        }
      });
      shape.appendChild(turn);
    } else if (arrow.group || def.id === this.level.escort) {
      const bx = -back / 2 - 24;
      const isEscort = def.id === this.level.escort && !arrow.group;
      shape.appendChild(
        el('circle', { class: `arrow-badge${isEscort ? ' arrow-badge--escort' : ''}`, cx: bx, cy: 0, r: 10 }),
      );
      const sym = el('text', { class: 'arrow-badge-sym', x: bx, y: 5 });
      sym.textContent = arrow.group ? GROUP_SYMBOL[arrow.group] : '★';
      shape.appendChild(sym);
    }
    node.appendChild(shape);
    mover.appendChild(node);
    this.bindArrowEvents(node, arrow.id);
    return mover;
  }

  /** 折线箭头：箭身为尾→头的圆角描线路径，箭头沿末段朝向；命中区为整格并集。 */
  private buildPolyArrow(arrow: ArrowDef): SVGGElement {
    const cells = cellsOf(arrow);
    const pts = cells.map((c) => ({ x: c.x * CELL + CELL / 2, y: c.y * CELL + CELL / 2 }));
    const kind = arrow.group ? arrow.group : 'normal';
    const mover = el('g', { class: 'arrow-mover', 'data-arrow-id': arrow.id });
    const node = el('g', {
      class: `arrow arrow--${kind} arrow--poly`,
      tabindex: '0',
      role: 'button',
      'aria-label': `折线箭头，出口向${DIR_NAME[headDirOf(arrow)]}，箭身 ${cells.length} 格${
        arrow.group ? `，${GROUP_SYMBOL[arrow.group]} 开关` : ''
      }，头部在第 ${arrow.head.x + 1} 列第 ${arrow.head.y + 1} 行`,
    });
    const shape = el('g', { class: 'arrow-shape' });
    for (const c of cells) {
      shape.appendChild(
        el('rect', { class: 'arrow-hit', x: c.x * CELL, y: c.y * CELL, width: CELL, height: CELL }),
      );
    }
    const d = pathD(pts);
    shape.appendChild(el('path', { class: 'arrow-body-poly', d }));
    shape.appendChild(el('path', { class: 'arrow-sheen-poly', d }));
    const head = pts[pts.length - 1];
    shape.appendChild(
      el('path', {
        class: 'arrow-head',
        d: 'M 40 0 L -8 -22 L -8 22 Z',
        transform: `translate(${head.x},${head.y}) rotate(${DIR_DEG[headDirOf(arrow)]})`,
      }),
    );
    if (arrow.group) {
      const mid = pts[Math.floor((pts.length - 1) / 2)];
      shape.appendChild(el('circle', { class: 'arrow-badge', cx: mid.x, cy: mid.y, r: 10 }));
      const sym = el('text', { class: 'arrow-badge-sym', x: mid.x, y: mid.y + 5 });
      sym.textContent = GROUP_SYMBOL[arrow.group];
      shape.appendChild(sym);
    }
    node.appendChild(shape);
    mover.appendChild(node);
    this.bindArrowEvents(node, arrow.id);
    return mover;
  }

  private bindArrowEvents(node: SVGGElement, id: string): void {
    node.addEventListener('click', () => this.callbacks.onActivate(id));
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.callbacks.onActivate(id);
      }
    });
    node.addEventListener('pointerenter', () => this.callbacks.onHover(id));
    node.addEventListener('pointerleave', () => this.callbacks.onHover(null));
    node.addEventListener('focus', () => this.callbacks.onHover(id));
    node.addEventListener('blur', () => this.callbacks.onHover(null));
  }

  arrowNode(id: string): SVGGElement | null {
    return this.arrowNodes.get(id)?.querySelector<SVGGElement>('.arrow') ?? null;
  }

  private later(fn: () => void, ms: number): void {
    const t = window.setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  private clearTimers(): void {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers.clear();
  }

  flashBlocked(arrowId: string, blocker: { kind: string; arrowId?: string; cell?: { x: number; y: number } }): void {
    const shape = this.arrowNode(arrowId)?.querySelector('.arrow-shape');
    if (shape) {
      shape.classList.remove('is-shaking');
      void (shape as SVGElement).getBoundingClientRect();
      shape.classList.add('is-shaking');
      this.later(() => shape.classList.remove('is-shaking'), 450);
    }
    let target: Element | null = null;
    if (blocker.kind === 'arrow' && blocker.arrowId) {
      target = this.arrowNode(blocker.arrowId);
    } else if (blocker.cell) {
      target = this.gateNodes.get(cellKey(blocker.cell)) ?? null;
    }
    if (target) {
      target.classList.add('is-blocker');
      this.later(() => target!.classList.remove('is-blocker'), 1300);
    }
  }

  flashHint(arrowId: string): void {
    const node = this.arrowNode(arrowId);
    if (!node) return;
    node.classList.add('is-hint');
    this.later(() => node.classList.remove('is-hint'), 3100);
  }

  /** 徽记调头后的原地脉冲反馈（不位移）。 */
  flashTurn(arrowId: string): void {
    const node = this.arrowNode(arrowId);
    if (!node) return;
    node.classList.add('is-turning');
    this.later(() => node.classList.remove('is-turning'), 360);
  }

  /** 点击接力跟随箭：只高亮领头与虚线连接，不移动。 */
  flashRelay(leaderId: string): void {
    this.flashHint(leaderId);
    const link = this.relayNodes.get(leaderId);
    if (link) {
      link.classList.add('is-active');
      this.later(() => link.classList.remove('is-active'), 1300);
    }
  }

  preview(group: GroupId, willOpen: boolean, sourceId?: string): void {
    this.clearPreview();
    for (const node of this.gateNodes.values()) {
      if (node.getAttribute('data-group') === group) {
        node.classList.add('is-preview');
        const label = node.querySelector('.gate-label');
        if (label) label.textContent = willOpen ? '将开启' : '将关闭';
      }
    }
    if (sourceId) this.arrowNode(sourceId)?.classList.add('is-preview-source');
  }

  clearPreview(): void {
    for (const node of this.gateNodes.values()) node.classList.remove('is-preview');
    for (const node of this.arrowNodes.values()) {
      node.querySelector('.arrow')?.classList.remove('is-preview-source');
    }
  }

  /**
   * 连续平移离场动画：尾部完全出界后才 resolve。
   * 完成逻辑只执行一次；rAF 之外有兜底定时器，后台标签页也不会永久锁死。
   */
  animateExit(arrowId: string, reducedMotion: boolean): Promise<void> {
    const def = this.level.arrows.find((a) => a.id === arrowId)!;
    const arrow = this.state ? effectiveArrow(def, this.state) : def;
    const mover = this.arrowNodes.get(arrowId);
    if (!mover) return Promise.resolve();
    if (arrow.path) return this.animatePolyExit(arrow, mover, reducedMotion);
    mover.querySelector('.arrow')?.classList.add('is-exiting');
    const v = DIR_VEC[arrow.dir];
    const dist = (exitDistance(this.level, arrow) + 0.25) * CELL;
    const duration = reducedMotion ? 40 : Math.min(450, Math.max(250, 230 + dist * 0.24));

    return new Promise((resolve) => {
      let finished = false;
      let raf = 0;
      const finish = () => {
        if (finished) return;
        finished = true;
        cancelAnimationFrame(raf);
        window.clearTimeout(safety);
        mover.setAttribute('transform', `translate(${v.x * dist},${v.y * dist})`);
        resolve();
      };
      const safety = window.setTimeout(finish, duration + 300);
      if (reducedMotion) {
        finish();
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        if (finished) return;
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        mover.setAttribute('transform', `translate(${v.x * dist * eased},${v.y * dist * eased})`);
        if (t < 1) raf = requestAnimationFrame(tick);
        else finish();
      };
      raf = requestAnimationFrame(tick);
    });
  }

  /**
   * 折线绳随离场：每个箭身格沿「自身→前一段→…→头部出口射线」的路线依次跟出，
   * 弯折处逐渐展开；路线与 checkMove/sweptCells 完全一致。完成守卫与兜底定时器同直箭头。
   */
  private animatePolyExit(
    arrow: ArrowDef,
    mover: SVGGElement,
    reducedMotion: boolean,
  ): Promise<void> {
    const cells = cellsOf(arrow);
    const v = DIR_VEC[headDirOf(arrow)];
    const route = cells.map((c) => ({ x: c.x * CELL + CELL / 2, y: c.y * CELL + CELL / 2 }));
    const head = route[route.length - 1];
    const ray = exitDistance(this.level, arrow) - (cells.length - 1);
    for (let i = 1; i <= ray + 2; i++) {
      route.push({ x: head.x + v.x * CELL * i, y: head.y + v.y * CELL * i });
    }
    const pointAt = (t: number): { x: number; y: number } => {
      const idx = Math.max(0, Math.min(route.length - 2, Math.floor(t)));
      const f = Math.max(0, Math.min(1, t - idx));
      const a = route[idx];
      const b = route[idx + 1];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    };
    const node = mover.querySelector<SVGGElement>('.arrow')!;
    node.classList.add('is-exiting');
    const body = node.querySelector<SVGPathElement>('.arrow-body-poly')!;
    const sheen = node.querySelector<SVGPathElement>('.arrow-sheen-poly')!;
    const headNode = node.querySelector<SVGPathElement>('.arrow-head')!;
    const badge = node.querySelector<SVGCircleElement>('.arrow-badge');
    const badgeSym = node.querySelector<SVGTextElement>('.arrow-badge-sym');
    const midIdx = Math.floor((cells.length - 1) / 2);
    const dist = exitDistance(this.level, arrow) + 0.25;
    const duration = reducedMotion ? 40 : Math.min(450, Math.max(250, 230 + dist * CELL * 0.24));
    const draw = (s: number): void => {
      const pts = cells.map((_, i) => pointAt(i + s));
      const d = pathD(pts);
      body.setAttribute('d', d);
      sheen.setAttribute('d', d);
      const hp = pts[pts.length - 1];
      const ahead = pointAt(cells.length - 1 + s + 0.01);
      const deg = (Math.atan2(ahead.y - hp.y, ahead.x - hp.x) * 180) / Math.PI;
      headNode.setAttribute('transform', `translate(${hp.x},${hp.y}) rotate(${deg})`);
      if (badge && badgeSym) {
        const mp = pts[midIdx];
        badge.setAttribute('cx', String(mp.x));
        badge.setAttribute('cy', String(mp.y));
        badgeSym.setAttribute('x', String(mp.x));
        badgeSym.setAttribute('y', String(mp.y + 5));
      }
    };
    return new Promise((resolve) => {
      let finished = false;
      let raf = 0;
      const finish = () => {
        if (finished) return;
        finished = true;
        cancelAnimationFrame(raf);
        window.clearTimeout(safety);
        draw(dist);
        resolve();
      };
      const safety = window.setTimeout(finish, duration + 300);
      if (reducedMotion) {
        finish();
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        if (finished) return;
        const t = Math.min(1, (now - start) / duration);
        draw(dist * (1 - Math.pow(1 - t, 3)));
        if (t < 1) raf = requestAnimationFrame(tick);
        else finish();
      };
      raf = requestAnimationFrame(tick);
    });
  }

  /** ⇄ 箭头选中态：与提示/阻挡高亮互不干扰。 */
  setSelected(id: string | null): void {
    if (this.selectedId) this.arrowNode(this.selectedId)?.classList.remove('is-selected');
    this.selectedId = id;
    if (id) this.arrowNode(id)?.classList.add('is-selected');
  }

  /** 出口方向预览：高亮路线经过的格子（与碰撞判定同一条射线）。 */
  previewRay(cells: Cell[]): void {
    this.clearRay();
    for (const c of cells) this.cellNodes.get(cellKey(c))?.classList.add('is-ray');
  }

  clearRay(): void {
    for (const node of this.cellNodes.values()) node.classList.remove('is-ray');
  }

  destroy(): void {
    this.clearTimers();
  }
}