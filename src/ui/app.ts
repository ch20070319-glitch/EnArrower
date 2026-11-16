import { GameSession } from '../core/session';
import { hint } from '../core/solver';
import { GROUP_SYMBOL } from '../core/types';
import { LEVELS, levelById } from '../levels/levels';
import {
  CurrentSave,
  SaveData,
  StorageLike,
  loadSave,
  recordCompletion,
  writeSave,
} from '../storage/save';
import { BoardView } from './board';

function $<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node as T;
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function detectStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    const probe = '__enarrower_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export class App {
  private storage: StorageLike | null;
  private save: SaveData;
  private session: GameSession | null = null;
  private board: BoardView | null = null;
  private locked = false;
  private inspectMode = false;
  private winShown = false;
  private storageWarned = false;
  private toastTimer = 0;

  constructor() {
    this.storage = detectStorage();
    const loaded = loadSave(this.storage);
    this.save = loaded.data;
    if (loaded.notice) this.toast(loaded.notice);

    $('btn-start').addEventListener('click', () => this.continueGame());
    $('btn-levels').addEventListener('click', () => this.showLevels());
    $('btn-levels-back').addEventListener('click', () => this.showHome());
    $('btn-game-back').addEventListener('click', () => {
      if (!this.locked) this.showLevels();
    });
    $('btn-undo').addEventListener('click', () => this.undo());
    $('btn-restart').addEventListener('click', () => this.restart());
    $('btn-hint').addEventListener('click', () => this.giveHint());
    $('btn-inspect').addEventListener('click', () => this.toggleInspect());
    $('btn-next').addEventListener('click', () => this.nextLevel());
    $('btn-replay').addEventListener('click', () => {
      if (this.session) this.startLevel(this.session.level.id);
    });
    $('btn-win-levels').addEventListener('click', () => this.showLevels());
    $('btn-win-undo').addEventListener('click', () => {
      this.hideWin();
      this.undo();
    });

    document.addEventListener('keydown', (e) => this.onGlobalKey(e));
    this.showHome();
  }

  /* ---------- 屏幕切换 ---------- */

  private showScreen(name: 'home' | 'levels' | 'game'): void {
    $('screen-home').hidden = name !== 'home';
    $('screen-levels').hidden = name !== 'levels';
    $('screen-game').hidden = name !== 'game';
    window.scrollTo({ top: 0 });
  }

  private showHome(): void {
    this.hideWin();
    this.showScreen('home');
    const cur = this.save.current;
    const level = cur ? levelById(cur.levelId) : undefined;
    $('btn-start').textContent = level ? `继续 · 第 ${level.index} 关` : '开始游戏';
    $('home-progress').textContent =
      this.save.completed.length > 0
        ? `已完成 ${this.save.completed.length} / ${LEVELS.length} 关`
        : `${LEVELS.length} 个原创关卡，从第一支箭头开始。`;
  }

  private showLevels(): void {
    this.hideWin();
    this.showScreen('levels');
    $('levels-progress').textContent = `${this.save.completed.length} / ${LEVELS.length}`;
    const grid = $('level-grid');
    grid.innerHTML = '';
    for (const level of LEVELS) {
      const done = this.save.completed.includes(level.id);
      const unlocked = this.save.unlocked.includes(level.id);
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = `level-tile ${
        done ? 'level-tile--done' : unlocked ? 'level-tile--open' : 'level-tile--locked'
      }`;
      tile.style.animationDelay = `${Math.min(level.index * 0.04, 0.4)}s`;
      tile.disabled = !unlocked;
      tile.setAttribute(
        'aria-label',
        `第 ${level.index} 关 ${level.name}，${done ? '已完成' : unlocked ? '可挑战' : '未解锁'}`,
      );
      tile.innerHTML = `
        <span class="level-num">${String(level.index).padStart(2, '0')}</span>
        <span class="level-name">${level.name}</span>
        <span class="level-state">${done ? '✓ 已完成' : unlocked ? '可挑战' : '未解锁'}</span>
        ${
          unlocked
            ? ''
            : '<svg class="level-lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
        }`;
      if (unlocked) tile.addEventListener('click', () => this.startLevel(level.id));
      grid.appendChild(tile);
    }
  }

  /* ---------- 关卡运行 ---------- */

  private continueGame(): void {
    const cur = this.save.current;
    if (cur && levelById(cur.levelId)) {
      this.startLevel(cur.levelId, cur);
      return;
    }
    const next = LEVELS.find((l) => this.save.unlocked.includes(l.id) && !this.save.completed.includes(l.id));
    this.startLevel((next ?? LEVELS[0]).id);
  }

  private startLevel(levelId: string, resume?: CurrentSave | null): void {
    const level = levelById(levelId);
    if (!level) return;
    this.board?.destroy();
    this.session =
      resume && resume.levelId === levelId
        ? new GameSession(level, resume.state, resume.history)
        : new GameSession(level);
    this.locked = false;
    this.inspectMode = false;
    $('btn-inspect').setAttribute('aria-pressed', 'false');
    this.hideWin();
    this.showScreen('game');

    $('game-title').textContent = `第 ${level.index} 关 · ${level.name}`;
    $('game-goal').textContent = level.goal;
    this.board = new BoardView($('board-wrap'), level);
    this.board.setCallbacks({
      onActivate: (id) => this.attemptMove(id),
      onHover: (id) => this.hoverPreview(id),
    });
    this.board.render(this.session.state);
    this.setStatus(level.goal, '');
    this.updateControls();
    this.persist();
    if (this.session.won) this.showWin();
  }

  private async attemptMove(arrowId: string): Promise<void> {
    if (this.locked || !this.session || !this.board) return;
    if (this.inspectMode) {
      this.inspectArrow(arrowId);
      return;
    }
    const check = this.session.check(arrowId);
    if (!check.ok) {
      this.board.flashBlocked(arrowId, check.blocker ?? { kind: 'arrow' });
      const msg =
        check.blocker?.kind === 'gate'
          ? `被挡住了：${GROUP_SYMBOL[check.blocker.group]} 闸门关闭中，先想办法开门。`
          : '被挡住了：先让挡路的箭头离场。不扣分，换个顺序试试。';
      this.setStatus(msg, 'warn');
      return;
    }

    this.locked = true;
    this.updateControls();
    this.board.clearPreview();
    await this.board.animateExit(arrowId, reducedMotion());

    const result = this.session.commitMove(arrowId);
    this.board.render(this.session.state);
    this.persist();
    this.updateControls();

    if (result.ok && this.session.won) {
      recordCompletion(this.save, this.session.level.id);
      this.persist();
      this.locked = false;
      this.showWin();
      return;
    }
    this.locked = false;
    this.setStatus(
      result.toggledGroup
        ? `${GROUP_SYMBOL[result.toggledGroup]} 机关已切换：同组闸门${
            this.session.state.open[result.toggledGroup] ? '开启' : '关闭'
          }。`
        : '箭头已离场。',
      'good',
    );
    this.updateControls();
  }

  private undo(): void {
    if (this.locked || !this.session || !this.board) return;
    if (!this.session.undo()) return;
    this.hideWin();
    this.board.render(this.session.state);
    this.persist();
    this.updateControls();
    this.setStatus('已撤销上一步，箭头和闸门都恢复了。', '');
  }

  private restart(): void {
    if (this.locked || !this.session || !this.board) return;
    this.session.restart();
    this.hideWin();
    this.board.render(this.session.state);
    this.persist();
    this.updateControls();
    this.setStatus('已重开本关，回到初始布局。', '');
  }

  private giveHint(): void {
    if (this.locked || !this.session || !this.board) return;
    const h = hint(this.session.level, this.session.state);
    if (h.kind === 'move') {
      this.board.flashHint(h.arrowId);
      this.setStatus('提示：试试高亮的这支箭头（不会自动移动）。', 'good');
    } else if (h.kind === 'dead-end') {
      this.setStatus('当前顺序已无法通关，请撤销或重开。', 'warn');
      for (const id of ['btn-undo', 'btn-restart']) {
        const btn = $(id);
        btn.classList.remove('btn--nudge');
        void btn.offsetWidth;
        btn.classList.add('btn--nudge');
      }
    }
  }

  /* ---------- 机关预览 ---------- */

  private toggleInspect(): void {
    if (this.locked || !this.session || !this.board) return;
    this.inspectMode = !this.inspectMode;
    $('btn-inspect').setAttribute('aria-pressed', String(this.inspectMode));
    this.board.clearPreview();
    this.setStatus(
      this.inspectMode
        ? '查看机关模式：点击箭头只预览机关，不会移动。再按一次退出。'
        : '已退出查看机关模式，点击箭头正常移动。',
      '',
    );
  }

  private inspectArrow(arrowId: string): void {
    if (!this.session || !this.board) return;
    const arrow = this.session.level.arrows.find((a) => a.id === arrowId);
    if (!arrow) return;
    if (!arrow.group) {
      this.board.clearPreview();
      this.setStatus('这是普通箭头，不控制闸门。', '');
      return;
    }
    const willOpen = !this.session.state.open[arrow.group];
    this.board.preview(arrow.group, willOpen, arrowId);
    this.setStatus(
      `${GROUP_SYMBOL[arrow.group]} 开关：离场后同组所有闸门将${willOpen ? '开启' : '关闭'}。预览不会移动箭头。`,
      'good',
    );
  }

  private hoverPreview(arrowId: string | null): void {
    if (this.locked || this.inspectMode || !this.session || !this.board) return;
    if (!arrowId) {
      this.board.clearPreview();
      return;
    }
    const arrow = this.session.level.arrows.find((a) => a.id === arrowId);
    if (arrow?.group) {
      this.board.preview(arrow.group, !this.session.state.open[arrow.group], arrowId);
    } else {
      this.board.clearPreview();
    }
  }

  /* ---------- 通关 ---------- */

  private showWin(): void {
    if (!this.session || this.winShown) return;
    this.winShown = true;
    const level = this.session.level;
    const next = LEVELS.find((l) => l.index === level.index + 1);
    const allDone = LEVELS.every((l) => this.save.completed.includes(l.id));
    $('win-detail').textContent = allDone
      ? `第 ${level.index} 关 · ${level.name} — 你已疏通全部 ${LEVELS.length} 关！`
      : next
        ? `第 ${level.index} 关 · ${level.name} — 已解锁第 ${next.index} 关「${next.name}」。`
        : `第 ${level.index} 关 · ${level.name}。`;
    const nextBtn = $<HTMLButtonElement>('btn-next');
    nextBtn.hidden = !next;
    nextBtn.textContent = next ? `下一关 · ${next.name}` : '下一关';
    $('win-overlay').hidden = false;
    this.setStatus('通关！所有箭头已离场。', 'good');
    (next ? $<HTMLButtonElement>('btn-next') : $<HTMLButtonElement>('btn-replay')).focus();
  }

  private hideWin(): void {
    this.winShown = false;
    $('win-overlay').hidden = true;
  }

  private nextLevel(): void {
    if (!this.session) return;
    const next = LEVELS.find((l) => l.index === this.session!.level.index + 1);
    if (next) this.startLevel(next.id);
  }

  /* ---------- 键盘 ---------- */

  private onGlobalKey(e: KeyboardEvent): void {
    if ($('screen-game').hidden) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const key = e.key.toLowerCase();
    if (key === 'z') this.undo();
    else if (key === 'r') this.restart();
    else if (key === 'h') this.giveHint();
    else if (e.key === 'Escape' && this.inspectMode) this.toggleInspect();
  }

  /* ---------- 状态与存档 ---------- */

  private updateControls(): void {
    if (!this.session) return;
    $<HTMLButtonElement>('btn-undo').disabled = this.locked || !this.session.canUndo;
    $<HTMLButtonElement>('btn-restart').disabled = this.locked;
    $<HTMLButtonElement>('btn-hint').disabled = this.locked;
    $<HTMLButtonElement>('btn-inspect').disabled = this.locked;
    $<HTMLButtonElement>('btn-game-back').disabled = this.locked;
    $('game-count').textContent = `${this.session.state.remaining.length} 支`;
  }

  private setStatus(text: string, tone: '' | 'warn' | 'good'): void {
    const node = $('status');
    node.textContent = text;
    node.className = `status${tone ? ` status--${tone}` : ''}`;
  }

  private persist(): void {
    this.save.current = this.session
      ? {
          levelId: this.session.level.id,
          state: this.session.state,
          history: this.session.history,
        }
      : null;
    const result = writeSave(this.storage, this.save);
    if (!result.ok && result.notice && !this.storageWarned) {
      this.storageWarned = true;
      this.toast(result.notice);
    }
  }

  private toast(message: string): void {
    const node = $('toast');
    node.textContent = message;
    node.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      node.hidden = true;
    }, 6000);
  }
}