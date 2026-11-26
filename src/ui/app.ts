import { GameSession } from '../core/session';
import {
  allLampsLit,
  applyMove,
  checkRelay,
  effectiveArrow,
  relayOf,
  stateKey,
  sweptCells,
} from '../core/rules';
import { hint } from '../core/solver';
import { Dir, GROUP_SYMBOL, LevelDef } from '../core/types';
import {
  CHAPTERS,
  DISPLAY_ORDER,
  LEVELS,
  TUTORIAL_LEVEL,
  displayNumber,
  levelById,
  nextLevelId,
  orderedLevels,
} from '../levels/levels';
import {
  CurrentSave,
  SaveData,
  StorageLike,
  loadSave,
  recordCompletion,
  recordLampBest,
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

const DIR_NAME: Record<Dir, string> = { up: '上', down: '下', left: '左', right: '右' };

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

function resolveLevel(id: string): LevelDef | undefined {
  return id === TUTORIAL_LEVEL.id ? TUTORIAL_LEVEL : levelById(id);
}

export class App {
  private storage: StorageLike | null;
  private save: SaveData;
  private session: GameSession | null = null;
  private board: BoardView | null = null;
  private locked = false;
  private inspectMode = false;
  private selectedId: string | null = null;
  private winShown = false;
  private storageWarned = false;
  private toastTimer = 0;
  private homeAction: () => void = () => {};
  /** 分级提示：同一局面第一次给观察线索，第二次才给具体操作；局面变化即重置。 */
  private hintKey: string | null = null;
  private hintStage = 0;

  constructor() {
    this.storage = detectStorage();
    const loaded = loadSave(this.storage);
    this.save = loaded.data;
    if (loaded.notice) this.toast(loaded.notice);

    $('btn-start').addEventListener('click', () => this.homeAction());
    $('btn-levels').addEventListener('click', () => this.showLevels());
    $('btn-levels-back').addEventListener('click', () => this.showHome());
    $('btn-tutorial-replay').addEventListener('click', () => this.startLevel(TUTORIAL_LEVEL.id));
    $('btn-tutorial-skip').addEventListener('click', () => this.skipTutorial());
    $('btn-game-back').addEventListener('click', () => {
      if (!this.locked) this.showLevels();
    });
    $('btn-undo').addEventListener('click', () => this.undo());
    $('btn-restart').addEventListener('click', () => this.restart());
    $('btn-hint').addEventListener('click', () => this.giveHint());
    $('btn-inspect').addEventListener('click', () => this.toggleInspect());
    $('btn-fire').addEventListener('click', () => this.fireSelected());
    $('btn-sel-close').addEventListener('click', () => this.clearSelection());
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

  private formalDoneCount(): number {
    return this.save.completed.filter((id) => levelById(id) !== undefined).length;
  }

  /** 首页主按钮五态：文字与点击去向一致。 */
  private showHome(): void {
    this.hideWin();
    this.showScreen('home');
    const cur = this.save.current;
    const curLevel = cur ? resolveLevel(cur.levelId) : undefined;
    const doneCount = this.formalDoneCount();
    const btn = $('btn-start');
    if (cur && curLevel) {
      if (curLevel.id === TUTORIAL_LEVEL.id) {
        btn.textContent = '继续新手教学';
        this.homeAction = () => this.startLevel(cur.levelId, cur);
      } else if (this.save.completed.includes(curLevel.id)) {
        btn.textContent = `继续重玩第 ${displayNumber(curLevel)} 关`;
        this.homeAction = () => this.startLevel(cur.levelId, cur);
      } else {
        btn.textContent = `继续第 ${displayNumber(curLevel)} 关`;
        this.homeAction = () => this.startLevel(cur.levelId, cur);
      }
    } else if (doneCount === LEVELS.length) {
      btn.textContent = '回顾关卡';
      this.homeAction = () => this.showLevels();
    } else if (doneCount === 0 && !this.save.tutorialDone) {
      btn.textContent = '开始游戏';
      this.homeAction = () => this.startLevel(TUTORIAL_LEVEL.id);
    } else {
      const next = orderedLevels().find(
        (l) => this.save.unlocked.includes(l.id) && !this.save.completed.includes(l.id),
      );
      if (next) {
        btn.textContent = `进入第 ${displayNumber(next)} 关`;
        this.homeAction = () => this.startLevel(next.id);
      } else {
        btn.textContent = '回顾关卡';
        this.homeAction = () => this.showLevels();
      }
    }
    $('home-progress').textContent =
      doneCount > 0
        ? `已完成 ${doneCount} / ${LEVELS.length} 关`
        : `${LEVELS.length} 个原创关卡，从第一支箭头开始。`;
  }

  private showLevels(): void {
    this.hideWin();
    this.showScreen('levels');
    $('levels-progress').textContent = `${this.formalDoneCount()} / ${LEVELS.length}`;
    const root = $('level-grid');
    root.innerHTML = '';
    let pos = 0;
    for (const chapter of CHAPTERS) {
      const section = document.createElement('section');
      section.className = 'chapter';
      section.setAttribute('data-chapter', chapter.id);
      const title = document.createElement('h3');
      title.className = 'chapter-title';
      title.textContent = chapter.title;
      const blurb = document.createElement('p');
      blurb.className = 'chapter-blurb';
      blurb.textContent = chapter.blurb;
      const grid = document.createElement('div');
      grid.className = 'level-grid';
      for (const level of orderedLevels().filter((l) => l.chapter === chapter.id)) {
        pos++;
        const done = this.save.completed.includes(level.id);
        const unlocked = this.save.unlocked.includes(level.id);
        const lampBest = (this.save.lampBest ?? []).includes(level.id);
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.setAttribute('data-level-id', level.id);
        tile.className = `level-tile ${
          done ? 'level-tile--done' : unlocked ? 'level-tile--open' : 'level-tile--locked'
        }`;
        tile.style.animationDelay = `${Math.min(pos * 0.04, 0.4)}s`;
        tile.disabled = !unlocked;
        tile.setAttribute(
          'aria-label',
          `第 ${displayNumber(level)} 关 ${level.name}，${done ? '已完成' : unlocked ? '可挑战' : '未解锁'}${
            lampBest ? '，曾点亮全部小屋' : ''
          }`,
        );
        tile.innerHTML = `
          <span class="level-num">${String(displayNumber(level)).padStart(2, '0')}</span>
          <span class="level-name">${level.name}</span>
          <span class="level-state">${done ? '✓ 已完成' : unlocked ? '可挑战' : '未解锁'}</span>
          ${lampBest ? '<span class="level-best">小屋全亮</span>' : ''}
          ${
            unlocked
              ? ''
              : '<svg class="level-lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
          }`;
        if (unlocked) tile.addEventListener('click', () => this.startLevel(level.id));
        grid.appendChild(tile);
      }
      section.appendChild(title);
      section.appendChild(blurb);
      section.appendChild(grid);
      root.appendChild(section);
    }
  }

  /* ---------- 关卡运行 ---------- */

  private skipTutorial(): void {
    if (this.locked || !this.session || this.session.level.id !== TUTORIAL_LEVEL.id) return;
    this.save.tutorialDone = true;
    this.startLevel(DISPLAY_ORDER[0]);
  }

  private startLevel(levelId: string, resume?: CurrentSave | null): void {
    const level = resolveLevel(levelId);
    if (!level) return;
    this.board?.destroy();
    this.session =
      resume && resume.levelId === levelId
        ? new GameSession(level, resume.state, resume.history)
        : new GameSession(level);
    this.locked = false;
    this.inspectMode = false;
    this.selectedId = null;
    this.hintKey = null;
    this.hintStage = 0;
    $('sel-bar').hidden = true;
    $('btn-inspect').setAttribute('aria-pressed', 'false');
    $('btn-tutorial-skip').hidden = level.id !== TUTORIAL_LEVEL.id;
    this.hideWin();
    this.showScreen('game');

    $('game-title').textContent =
      level.id === TUTORIAL_LEVEL.id ? level.name : `第 ${displayNumber(level)} 关 · ${level.name}`;
    $('game-goal').textContent = level.goal;
    const intro = $('game-intro');
    intro.textContent = level.intro ?? '';
    intro.hidden = !level.intro;
    $('board-wrap').classList.toggle('board-wrap--tall', level.height > level.width);
    this.board = new BoardView($('board-wrap'), level);
    this.board.setCallbacks({
      onActivate: (id) => this.onArrowActivate(id),
      onHover: (id) => this.hoverPreview(id),
      onTurn: (id) => this.turnById(id),
    });
    this.board.render(this.session.state);
    // 状态栏只反馈玩家操作：入场时留空，目标与玩法说明各自独立显示。
    this.setStatus('', '');
    this.updateControls();
    this.persist();
    if (this.session.won) this.showWin();
  }

  /** 普通箭头单击即离场；⇄ 箭头单击只选中；接力跟随只高亮领头，领头启动整队接力。 */
  private onArrowActivate(id: string): void {
    if (this.locked || !this.session || !this.board) return;
    const def = this.session.level.arrows.find((a) => a.id === id);
    if (def?.reversible && !this.inspectMode) {
      this.selectArrow(id);
      return;
    }
    const relay = relayOf(this.session.level, id);
    if (relay && !this.inspectMode) {
      if (relay.follower === id) {
        this.board.flashRelay(relay.leader);
        this.setStatus(`这是接力跟随箭 ${id}：请点击领头的 ${relay.leader} 启动接力。`, '');
        return;
      }
      void this.attemptRelay(id);
      return;
    }
    void this.attemptMove(id);
  }

  /** 接力：预演双方 → A 动画 → 结算 A 机关 → B 动画 → 单次提交；失败双方原地不动。 */
  private async attemptRelay(leaderId: string): Promise<void> {
    if (this.locked || !this.session || !this.board) return;
    const relay = this.session.level.relays?.find((r) => r.leader === leaderId);
    if (!relay) return;
    const check = checkRelay(this.session.level, this.session.state, leaderId);
    if (!check.ok) {
      const who = check.failedId ?? leaderId;
      this.board.flashRelayBlocked(leaderId, who, check.blocker ?? { kind: 'arrow' });
      const msg =
        check.blocker?.kind === 'gate'
          ? `接力没启动：${who} 被 ${GROUP_SYMBOL[check.blocker.group]} 闸门挡住，整队留在原地。先开门再试。`
          : `接力没启动：${who} 被箭头挡住，整队留在原地。先疏通它的路。`;
      this.setStatus(msg, 'warn');
      return;
    }

    this.locked = true;
    this.updateControls();
    this.board.clearPreview();
    this.board.clearRay();
    this.board.holdRelayLink(leaderId);
    await this.board.animateExit(relay.leader, reducedMotion());
    const mid = applyMove(this.session.level, this.session.state, relay.leader).state;
    this.board.render(mid);
    await this.board.animateExit(relay.follower, reducedMotion());

    const result = this.session.commitRelay(leaderId);
    this.board.render(this.session.state);
    this.board.clearRelayHold();
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
        ? `接力完成：${relay.leader} 带着 ${relay.follower} 一起离场，${GROUP_SYMBOL[result.toggledGroup]} 机关已切换。`
        : `接力完成：${relay.leader} 带着 ${relay.follower} 一起离场。`,
      'good',
    );
    this.updateControls();
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
    this.board.clearRay();
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

  /* ---------- ⇄ 可调头箭头 ---------- */

  private selectArrow(arrowId: string): void {
    if (!this.session || !this.board) return;
    this.selectedId = arrowId;
    this.board.setSelected(arrowId);
    this.updateSelBar();
    this.setStatus('已选中 ⇄ 箭头：看清出口方向；点箭尾 ⇄ 徽记调头，或在此发射。', '');
  }

  private clearSelection(): void {
    this.selectedId = null;
    $('sel-bar').hidden = true;
    this.board?.setSelected(null);
    this.board?.clearRay();
  }

  private updateSelBar(): void {
    if (!this.session || !this.board || !this.selectedId) return;
    const def = this.session.level.arrows.find((a) => a.id === this.selectedId);
    if (!def) return;
    const eff = effectiveArrow(def, this.session.state);
    $('sel-bar').hidden = false;
    $('sel-label').textContent = `⇄ 当前向${DIR_NAME[eff.dir]}`;
    this.board.previewRay(sweptCells(this.session.level, eff));
  }

  /** 第三轮：点击箭尾 ⇄ 徽记直接调头（无需先选中），一步可撤销。 */
  private turnById(arrowId: string): void {
    if (this.locked || !this.session || !this.board || this.inspectMode) return;
    const result = this.session.commitTurn(arrowId);
    if (!result.ok) return;
    this.board.render(this.session.state);
    if (this.selectedId === arrowId) this.updateSelBar();
    this.persist();
    this.updateControls();
    const eff = effectiveArrow(
      this.session.level.arrows.find((a) => a.id === arrowId)!,
      this.session.state,
    );
    this.board.flashTurn(arrowId);
    this.setStatus(`已调头 ${arrowId}：现在向${DIR_NAME[eff.dir]}。点箭身选中后发射。`, 'good');
  }

  private fireSelected(): void {
    if (this.locked || !this.selectedId) return;
    const id = this.selectedId;
    this.clearSelection();
    void this.attemptMove(id);
  }

  private undo(): void {
    if (this.locked || !this.session || !this.board) return;
    if (!this.session.undo()) return;
    this.hideWin();
    this.clearSelection();
    this.board.render(this.session.state);
    this.persist();
    this.updateControls();
    this.setStatus('已撤销上一步，箭头和闸门都恢复了。', '');
  }

  private restart(): void {
    if (this.locked || !this.session || !this.board) return;
    this.session.restart();
    this.hideWin();
    this.clearSelection();
    this.board.render(this.session.state);
    this.persist();
    this.updateControls();
    this.setStatus('已重开本关，回到初始布局。', '');
  }

  /** 分级提示：同一局面第一次只给观察线索，第二次才指出具体操作；局面变化后重新分级。 */
  private giveHint(): void {
    if (this.locked || !this.session || !this.board) return;
    const level = this.session.level;
    const key = stateKey(this.session.state);
    if (key !== this.hintKey) {
      this.hintKey = key;
      this.hintStage = 0;
    }
    const h = hint(level, this.session.state);
    if (h.kind === 'dead-end') {
      this.setStatus('当前顺序已无法通关，请撤销或重开。', 'warn');
      for (const id of ['btn-undo', 'btn-restart']) {
        const btn = $(id);
        btn.classList.remove('btn--nudge');
        void btn.offsetWidth;
        btn.classList.add('btn--nudge');
      }
      return;
    }
    if (h.kind === 'won') return;
    if (this.hintStage === 0) {
      this.hintStage = 1;
      this.setStatus(this.observationClue(h), '');
      return;
    }
    if (h.kind === 'move') {
      this.board.flashHint(h.arrowId);
      const arrow = level.arrows.find((a) => a.id === h.arrowId)!;
      const text = arrow.group
        ? `提示：先让开关 ${h.arrowId} 离场，它会切换 ${arrow.group === 'diamond' ? '◇' : '○'} 闸门（不会自动移动）。`
        : level.escort === h.arrowId
          ? `提示：护送 ★ 箭头 ${h.arrowId} 离场即可通关（不会自动移动）。`
          : `提示：让箭头 ${h.arrowId} 沿当前朝向离场（不会自动移动）。`;
      this.setStatus(text, 'good');
    } else if (h.kind === 'turn') {
      this.board.flashHint(h.arrowId);
      this.setStatus(`提示：先将 ⇄ 箭头 ${h.arrowId} 调头，再考虑发射。`, 'good');
    } else if (h.kind === 'relay') {
      this.board.flashRelay(h.arrowId);
      this.setStatus(`提示：启动接力 ${h.arrowId}，它会带着跟随箭一起离场。`, 'good');
    }
  }

  private observationClue(h: ReturnType<typeof hint>): string {
    const level = this.session!.level;
    if (h.kind === 'relay') {
      const relay = level.relays?.find((r) => r.leader === h.arrowId);
      return `观察：虚线连着的两支是一队，搭档 ${relay?.follower ?? ''} 也需要一条畅通的路。再看看谁挡着它。`;
    }
    if (h.kind === 'turn') {
      return '观察：⇄ 箭头可以原地调头。看看另一个方向的出口是不是更畅通。';
    }
    if (h.kind === 'move') {
      const arrow = level.arrows.find((a) => a.id === h.arrowId)!;
      if (arrow.group) {
        return `观察：带 ${GROUP_SYMBOL[arrow.group]} 的开关离场会切换同组闸门。先看清哪些门还关着。`;
      }
      if (level.escort === h.arrowId) {
        return '观察：★ 是护送目标，把它送出棋盘就赢，其他箭头可以留在场上。';
      }
      if (arrow.path) {
        return '观察：折线箭头像绳子，头部先出、弯折处依次跟出；出口射线畅通才能走。';
      }
      return '观察：找找哪支箭头的出口方向上没有其他箭头或关闭的闸门。';
    }
    return '观察：看看棋盘上还剩什么。';
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
      if (this.selectedId) this.updateSelBar();
      else this.board.clearRay();
      return;
    }
    const arrow = this.session.level.arrows.find((a) => a.id === arrowId);
    if (arrow?.group) {
      this.board.preview(arrow.group, !this.session.state.open[arrow.group], arrowId);
    } else if (arrow?.reversible) {
      this.board.previewRay(sweptCells(this.session.level, effectiveArrow(arrow, this.session.state)));
    } else {
      this.board.clearPreview();
    }
  }

  /* ---------- 通关 ---------- */

  private showWin(): void {
    if (!this.session || this.winShown) return;
    this.winShown = true;
    const level = this.session.level;
    const isTutorial = level.id === TUTORIAL_LEVEL.id;
    const nextId = isTutorial ? DISPLAY_ORDER[0] : nextLevelId(level.id);
    const next = nextId ? levelById(nextId) : undefined;
    const allDone = LEVELS.every((l) => this.save.completed.includes(l.id));
    const label = isTutorial ? level.name : `第 ${displayNumber(level)} 关 · ${level.name}`;
    $('win-detail').textContent = isTutorial
      ? `教学完成！移走挡路的箭头，道路就通了。接下来进入第 1 关「${next?.name ?? ''}」。`
      : allDone
        ? `${label} — 你已疏通全部 ${LEVELS.length} 关！`
        : next
          ? `${label} — 已解锁第 ${displayNumber(next)} 关「${next.name}」。`
          : `${label}。`;
    const nextBtn = $<HTMLButtonElement>('btn-next');
    nextBtn.hidden = !next;
    nextBtn.textContent = next ? `下一关 · ${next.name}` : '下一关';
    const lampCount = level.lamps?.length ?? 0;
    if (lampCount > 0) {
      const litCount = this.session.state.lit.length;
      if (allLampsLit(level, this.session.state)) {
        recordLampBest(this.save, level.id);
        this.persist();
        $('win-detail').textContent += ' 可选挑战达成：小屋全部点亮！';
      } else {
        $('win-detail').textContent += ` 还有 ${lampCount - litCount} 盏灯没亮（可选挑战，不影响通关）。`;
      }
    }
    if (isTutorial) {
      // 教学完成后不再占据「进行中」存档，首页直接进入正式第 1 关。
      this.save.current = null;
      writeSave(this.storage, this.save);
    }
    $('win-overlay').hidden = false;
    this.setStatus(
      level.escort ? '通关！★ 箭头已送出棋盘。' : '通关！所有箭头已离场。',
      'good',
    );
    (next ? $<HTMLButtonElement>('btn-next') : $<HTMLButtonElement>('btn-replay')).focus();
  }

  private hideWin(): void {
    this.winShown = false;
    $('win-overlay').hidden = true;
  }

  private nextLevel(): void {
    if (!this.session) return;
    const id = this.session.level.id;
    const nextId = id === TUTORIAL_LEVEL.id ? DISPLAY_ORDER[0] : nextLevelId(id);
    if (nextId) this.startLevel(nextId);
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
    else if (e.key === 'Escape') {
      if (this.selectedId) this.clearSelection();
      else if (this.inspectMode) this.toggleInspect();
    }
  }

  /* ---------- 状态与存档 ---------- */

  private updateControls(): void {
    if (!this.session) return;
    $<HTMLButtonElement>('btn-undo').disabled = this.locked || !this.session.canUndo;
    $<HTMLButtonElement>('btn-restart').disabled = this.locked;
    $<HTMLButtonElement>('btn-hint').disabled = this.locked;
    $<HTMLButtonElement>('btn-inspect').disabled = this.locked;
    $<HTMLButtonElement>('btn-game-back').disabled = this.locked;
    $<HTMLButtonElement>('btn-fire').disabled = this.locked;
    $('game-count').textContent = `${this.session.state.remaining.length} 支`;
    this.updateOptionalGoal();
  }

  /** 点灯是可选挑战：进度即时更新（点亮/撤销/重开），漏灯照样通关。 */
  private updateOptionalGoal(): void {
    if (!this.session) return;
    const level = this.session.level;
    const lamps = level.lamps ?? [];
    const node = $('game-optional');
    if (lamps.length === 0) {
      node.hidden = true;
      return;
    }
    const lit = this.session.state.lit.length;
    node.hidden = false;
    node.textContent = `可选 · 点亮小屋 ${lit}/${lamps.length}`;
    node.classList.toggle('subbar-optional--done', allLampsLit(level, this.session.state));
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