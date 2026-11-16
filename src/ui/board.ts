import { cellKey, exitDistance } from '../core/rules';
import { ArrowDef, DIR_VEC, GameState, GroupId, GROUP_SYMBOL, LevelDef } from '../core/types';

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

export interface BoardCallbacks {
  onActivate: (arrowId: string) => void;
  onHover: (arrowId: string | null) => void;
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
  private arrowNodes = new Map<string, SVGGElement>();
  private gateNodes = new Map<string, SVGGElement>();
  private timers = new Set<number>();
  private callbacks: BoardCallbacks = { onActivate: () => {}, onHover: () => {} };

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
      </linearGradient>`;
    this.svg.appendChild(defs);

    const cellsLayer = el('g', { 'aria-hidden': 'true' });
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        cellsLayer.appendChild(
          el('rect', {
            class: 'board-cell',
            x: x * CELL + 5,
            y: y * CELL + 5,
            width: CELL - 10,
            height: CELL - 10,
            rx: 14,
          }),
        );
      }
    }
    this.svg.appendChild(cellsLayer);

    this.gatesLayer = el('g');
    this.arrowsLayer = el('g');
    this.svg.appendChild(this.gatesLayer);
    this.svg.appendChild(this.arrowsLayer);
    container.appendChild(this.svg);
  }

  setCallbacks(cb: BoardCallbacks): void {
    this.callbacks = cb;
  }

  render(state: GameState): void {
    this.clearTimers();
    this.arrowsLayer.innerHTML = '';
    this.gatesLayer.innerHTML = '';
    this.arrowNodes.clear();
    this.gateNodes.clear();

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
      const node = this.buildArrow(arrow);
      this.arrowsLayer.appendChild(node);
      this.arrowNodes.set(id, node);
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

  private buildArrow(arrow: ArrowDef): SVGGElement {
    const cx = arrow.head.x * CELL + CELL / 2;
    const cy = arrow.head.y * CELL + CELL / 2;
    const kind = arrow.group ? arrow.group : 'normal';
    const mover = el('g', { class: 'arrow-mover', 'data-arrow-id': arrow.id });
    const node = el('g', {
      class: `arrow arrow--${kind}`,
      transform: `translate(${cx},${cy}) rotate(${DIR_DEG[arrow.dir]})`,
      tabindex: '0',
      role: 'button',
      'aria-label': `箭头，向${DIR_NAME[arrow.dir]}，长度 ${arrow.len}${
        arrow.group ? `，${GROUP_SYMBOL[arrow.group]} 开关` : ''
      }，头部在第 ${arrow.head.x + 1} 列第 ${arrow.head.y + 1} 行`,
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
    if (arrow.group) {
      const bx = -back / 2 - 24;
      shape.appendChild(el('circle', { class: 'arrow-badge', cx: bx, cy: 0, r: 10 }));
      const sym = el('text', { class: 'arrow-badge-sym', x: bx, y: 5 });
      sym.textContent = GROUP_SYMBOL[arrow.group];
      shape.appendChild(sym);
    }
    node.appendChild(shape);
    mover.appendChild(node);

    node.addEventListener('click', () => this.callbacks.onActivate(arrow.id));
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.callbacks.onActivate(arrow.id);
      }
    });
    node.addEventListener('pointerenter', () => this.callbacks.onHover(arrow.id));
    node.addEventListener('pointerleave', () => this.callbacks.onHover(null));
    node.addEventListener('focus', () => this.callbacks.onHover(arrow.id));
    node.addEventListener('blur', () => this.callbacks.onHover(null));
    return mover;
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
    const arrow = this.level.arrows.find((a) => a.id === arrowId)!;
    const mover = this.arrowNodes.get(arrowId);
    if (!mover) return Promise.resolve();
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

  destroy(): void {
    this.clearTimers();
  }
}