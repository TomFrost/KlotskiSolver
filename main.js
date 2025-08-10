(function(){
  const { BoardModel } = window.Klotski;
  const { BoardRenderer } = window.Klotski;
  const { animateMoves } = window.Klotski;
  const { clamp } = window.Klotski.utils;

  const canvas = document.getElementById('board');
  const statusEl = document.getElementById('status');
  const btnSolve = document.getElementById('btn-solve');
  const btnReset = document.getElementById('btn-reset');
  const btnClear = document.getElementById('btn-clear');
  const btnDelete = document.getElementById('btn-delete');
  const speedRange = document.getElementById('speed');
  const speedValue = document.getElementById('speed-value');

  const colsInput = document.getElementById('cols');
  const rowsInput = document.getElementById('rows');
  const goalXInput = document.getElementById('goal-x');
  const goalYInput = document.getElementById('goal-y');
  const applyBoardBtn = document.getElementById('btn-apply-board');

  // Puzzles UI
  const nameInput = document.getElementById('puzzle-name');
  const saveBtn = document.getElementById('btn-save-puzzle');
  const loadBtn = document.getElementById('btn-load-puzzle');
  const deleteBtn = document.getElementById('btn-delete-puzzle');
  const listEl = document.getElementById('puzzle-list');
  const exportBtn = document.getElementById('btn-export-json');
  const importInput = document.getElementById('file-import');
  const shareBtn = document.getElementById('btn-share-puzzle');
  const setDefaultBtn = document.getElementById('btn-set-default');
  const clearDefaultBtn = document.getElementById('btn-clear-default');
  const defaultDisplay = document.getElementById('default-display');

  const model = new BoardModel({ cols: Number(colsInput.value), rows: Number(rowsInput.value), goalX: Number(goalXInput.value), goalY: Number(goalYInput.value) });
  const renderer = new BoardRenderer(canvas, model);

  // Initialize Reset button as disabled
  btnReset.disabled = true;

  function setStatus(text) { statusEl.textContent = text || ''; }

  function resize() {
    renderer.resizeToContainer();
    renderer.draw(model.selectedId);
  }
  // No dynamic resize listener to keep canvas size stable
resize();

  // Update speed UI with persistence
const SPEED_KEY = 'klotski.speed.v1';
(function initSpeed(){
  const min = Number(speedRange.min), max = Number(speedRange.max);
  const persisted = Number(localStorage.getItem(SPEED_KEY));
  if (!Number.isNaN(persisted)) {
    speedRange.value = String(clamp(persisted, min, max));
  }
  speedValue.textContent = String(speedRange.value);
})();
speedRange.addEventListener('input', () => {
  speedValue.textContent = String(speedRange.value);
  localStorage.setItem(SPEED_KEY, String(speedRange.value));
});

  // Board settings
  applyBoardBtn.addEventListener('click', () => {
    model.setBoardSize(Number(colsInput.value), Number(rowsInput.value));
    model.setGoalPosition(Number(goalXInput.value), Number(goalYInput.value));
    setStatus('Board updated');
    renderer.draw(model.selectedId);
  });

  // Selection and drag handling
  let dragState = null; // { id, startX, startY, originX, originY }

  function hitTestPiece(px, py) {
    const { gridX, gridY, cellSize } = renderer.layout;
    const x = (px - gridX) / cellSize;
    const y = (py - gridY) / cellSize;
    // pick top-most by drawing order; reverse iterate
    for (let i = model.pieces.length - 1; i >= 0; i--) {
      const p = model.pieces[i];
      if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return p;
    }
    return null;
  }

  function onPointerDown(e) {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left; const py = e.clientY - rect.top;
    const piece = hitTestPiece(px, py);
    if (piece) {
      model.selectedId = piece.id;
      dragState = { id: piece.id, startX: px, startY: py, originX: piece.x, originY: piece.y };
      btnDelete.disabled = false;
      renderer.draw(model.selectedId);
    } else {
      model.selectedId = null;
      btnDelete.disabled = true;
      renderer.draw(model.selectedId);
    }
  }

  function onPointerMove(e) {
    if (!dragState) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left; const py = e.clientY - rect.top;
    const { cellSize } = renderer.layout;
    const piece = model.pieces.find(p => p.id === dragState.id);
    if (!piece) return;
    const dxPixels = px - dragState.startX; const dyPixels = py - dragState.startY;
    const dx = Math.round(dxPixels / cellSize); const dy = Math.round(dyPixels / cellSize);
    const target = { ...piece, x: dragState.originX + dx, y: dragState.originY + dy };
    let ghost = null;
    if (model.inBounds(target) && !model.collidesAny(target, piece.id)) {
      ghost = { x: target.x, y: target.y, w: target.w, h: target.h };
    }
    renderer.draw(model.selectedId, ghost);
  }

  function onPointerUp(e) {
    if (!dragState) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left; const py = e.clientY - rect.top;
    const { cellSize } = renderer.layout;
    const piece = model.pieces.find(p => p.id === dragState.id);
    const dxPixels = px - dragState.startX; const dyPixels = py - dragState.startY;
    const dx = Math.round(dxPixels / cellSize); const dy = Math.round(dyPixels / cellSize);
    if (dx !== 0 || dy !== 0) {
      const ok = model.tryMovePiece(piece.id, dx, dy);
      if (!ok) setStatus('Move blocked');
      else setStatus('');
    }
    dragState = null;
    renderer.draw(model.selectedId);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  // Palette drag-and-drop onto canvas (with canvas ghost)
  const palette = document.getElementById('palette');
  let dragType = null;
  let paletteDragging = false;
  let paletteGhost = null; // {x,y,w,h}

  // Replace native HTML5 DnD with pointer-based drag for palette
  Array.from(palette.querySelectorAll('.palette__item')).forEach(el => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const type = el.dataset.type;
      if (!type) return;
      dragType = type;
      paletteDragging = true;
      el.classList.add('dragging');

      // Build a small cursor-following preview
      let cursorPreview = document.createElement('div');
      cursorPreview.className = 'drag-cursor';
      const inner = document.createElement('div');
      inner.className = 'piece-mini piece-mini--' + dragType;
      const rect = document.createElement('div');
      rect.className = 'piece-mini__rect';
      inner.appendChild(rect);
      cursorPreview.appendChild(inner);
      document.body.appendChild(cursorPreview);

      const onMove = (ev) => {
        if (!paletteDragging) return;
        cursorPreview.style.left = (ev.clientX + 12) + 'px';
        cursorPreview.style.top = (ev.clientY + 12) + 'px';
        // When moving over canvas, show a snapping ghost; otherwise clear
        const rectc = canvas.getBoundingClientRect();
        const inside = ev.clientX >= rectc.left && ev.clientX <= rectc.right && ev.clientY >= rectc.top && ev.clientY <= rectc.bottom;
        if (inside) {
          const px = ev.clientX - rectc.left; const py = ev.clientY - rectc.top;
          const size = BoardModel.typeToSize(dragType);
          const grid = renderer.pixelToGrid(px, py);
          const candidate = { x: grid.x, y: grid.y, w: size.w, h: size.h };
          if (model.inBounds(candidate) && !model.collidesAny(candidate)) {
            paletteGhost = candidate;
          } else { paletteGhost = null; }
          renderer.draw(model.selectedId, paletteGhost);
        } else {
          if (paletteGhost) { paletteGhost = null; renderer.draw(model.selectedId); }
        }
      };

      const onUp = (ev) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        el.classList.remove('dragging');
        cursorPreview.remove(); cursorPreview = null;

        if (paletteDragging) {
          const rectc = canvas.getBoundingClientRect();
          const inside = ev.clientX >= rectc.left && ev.clientX <= rectc.right && ev.clientY >= rectc.top && ev.clientY <= rectc.bottom;
          if (inside) {
            const px = ev.clientX - rectc.left; const py = ev.clientY - rectc.top;
            const grid = renderer.pixelToGrid(px, py);
            const piece = model.createPiece(dragType, grid.x, grid.y);
            const ok = model.tryAddPiece(piece);
            if (!ok) setStatus('Cannot place piece here');
            else {
              setStatus(`Added ${piece.type} as ${piece.id}`);
              model.selectedId = piece.id; btnDelete.disabled = false;
            }
          }
        }
        paletteGhost = null;
        paletteDragging = false;
        dragType = null;
        renderer.draw(model.selectedId);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
    });
  });

  // Remove old HTML5 drag listeners if any

  // Remove any residual HTML5 drag handlers
  ['dragover','dragleave','drop'].forEach(type => {
    canvas.addEventListener(type, (e) => { if (paletteDragging) e.preventDefault(); }, { passive: false });
  });

  // Delete selected
  btnDelete.addEventListener('click', () => {
    if (!model.selectedId) return;
    const idx = model.pieces.findIndex(p => p.id === model.selectedId);
    if (idx >= 0) {
      model.pieces.splice(idx, 1);
      setStatus('Piece deleted');
    }
    model.selectedId = null;
    btnDelete.disabled = true;
    renderer.draw(model.selectedId);
  });

  // Clear and Reset
  btnClear.addEventListener('click', () => {
    model.clear();
    setStatus('Board cleared');
    btnDelete.disabled = true;
    btnReset.disabled = true; // Disable Reset when clearing
    renderer.draw(model.selectedId);
  });

  btnReset.addEventListener('click', () => {
    model.resetToLastSaved();
    setStatus('Reset to saved state');
    btnDelete.disabled = !!model.selectedId;
    btnReset.disabled = true; // Disable Reset after using it
    renderer.draw(model.selectedId);
  });

  // Puzzles helpers
  function refreshList() {
    const names = window.Klotski.Storage.listNames();
    listEl.innerHTML = '';
    names.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n; opt.textContent = n;
      listEl.appendChild(opt);
    });
    loadBtn.disabled = !listEl.value;
    deleteBtn.disabled = !listEl.value;
    defaultDisplay.value = window.Klotski.Storage.getDefaultName() || '';
  }

  function setFromState(state) {
    model.loadState(state);
    colsInput.value = String(model.cols);
    rowsInput.value = String(model.rows);
    goalXInput.value = String(model.goal.x);
    goalYInput.value = String(model.goal.y);
    btnReset.disabled = true; // Disable Reset when loading a new state
    renderer.draw(model.selectedId);
  }

  saveBtn.addEventListener('click', () => {
    const name = (nameInput.value || '').trim();
    if (!name) { setStatus('Enter a name to save'); return; }
    const state = model.getInitialState();
    window.Klotski.Storage.savePuzzle(name, state);
    refreshList();
    setStatus(`Saved "${name}"`);
  });

  listEl.addEventListener('change', () => {
    loadBtn.disabled = !listEl.value;
    deleteBtn.disabled = !listEl.value;
    nameInput.value = listEl.value || '';
  });

  loadBtn.addEventListener('click', () => {
    const name = listEl.value;
    if (!name) return;
    const state = window.Klotski.Storage.getPuzzle(name);
    if (state) {
      setFromState(state);
      setStatus(`Loaded "${name}"`);
    }
  });

  deleteBtn.addEventListener('click', () => {
    const name = listEl.value;
    if (!name) return;
    window.Klotski.Storage.deletePuzzle(name);
    refreshList();
    setStatus(`Deleted "${name}"`);
  });

  exportBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(model.getInitialState(), null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (nameInput.value || 'klotski-puzzle') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });

  importInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const state = JSON.parse(text);
      setFromState(state);
      setStatus('Imported from JSON');
    } catch (err) {
      setStatus('Import failed: ' + (err?.message || String(err)));
    } finally {
      importInput.value = '';
    }
  });

  shareBtn.addEventListener('click', async () => {
    const payload = encodeURIComponent(btoa(JSON.stringify(model.getInitialState())));
    const url = `${location.origin}${location.pathname}#${payload}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Shareable link copied');
    } catch {
      setStatus('Shareable link: ' + url);
    }
  });

  function tryLoadFromHash() {
    const hash = location.hash.replace(/^#/, '');
    if (!hash) return false;
    try {
      const state = JSON.parse(atob(decodeURIComponent(hash)));
      setFromState(state);
      setStatus('Loaded from link');
      return true;
    } catch { return false; }
  }

  setDefaultBtn.addEventListener('click', () => {
    const name = listEl.value || nameInput.value.trim();
    if (!name) { setStatus('Choose or enter a name'); return; }
    window.Klotski.Storage.setDefaultName(name);
    refreshList();
    setStatus(`Default set to "${name}"`);
  });

  clearDefaultBtn.addEventListener('click', () => {
    window.Klotski.Storage.clearDefaultName();
    refreshList();
    setStatus('Default cleared');
  });

  function tryLoadDefault() {
    const def = window.Klotski.Storage.getDefaultName();
    if (!def) return false;
    const state = window.Klotski.Storage.getPuzzle(def);
    if (!state) return false;
    setFromState(state);
    setStatus(`Loaded default "${def}"`);
    return true;
  }

  refreshList();
  if (!tryLoadFromHash()) tryLoadDefault();

  // Solve
  btnSolve.addEventListener('click', async () => {
    let solveSuccessful = false;
    try {
      setStatus('Preparing state...');
      const initial = model.getInitialState();
      model.saveStateSnapshot();
      renderer.draw(model.selectedId);

      setStatus('Calling user solver...');
      let moves = [];
      const solveStartTime = performance.now();

      if (typeof window.solve === 'function') {
        const result = window.solve(initial);
        moves = Array.isArray(result) ? result : await result;
      } else if (window.UserSolver && typeof window.UserSolver.solve === 'function') {
        const result = window.UserSolver.solve(initial);
        moves = Array.isArray(result) ? result : await result;
      } else {
        setStatus('No user solver found. Implement solve() in user-solver.js');
        return;
      }

      const solveEndTime = performance.now();
      const solveTimeMs = solveEndTime - solveStartTime;

      if (!Array.isArray(moves)) throw new Error('Solver did not return an array');
      setStatus(`Animating ${moves.length} moves...`);
      btnSolve.disabled = true; btnReset.disabled = true; btnClear.disabled = true; btnDelete.disabled = true; applyBoardBtn.disabled = true;
      await animateMoves({
        model,
        renderer,
        moves,
        msPerStep: Number(speedRange.value),
        onStatus: setStatus,
        getSpeed: () => Number(speedRange.value)
      });
      setStatus(`Done - ${moves.length} moves in ${(solveTimeMs / 1000).toFixed(3)}s`);
      solveSuccessful = true;
    } catch (err) {
      console.error(err);
      setStatus('Error: ' + (err?.message || String(err)));
    } finally {
      btnSolve.disabled = false; btnClear.disabled = false; btnDelete.disabled = !model.selectedId; applyBoardBtn.disabled = false;
      // Only enable Reset if the solve was successful
      if (solveSuccessful) {
        btnReset.disabled = false;
      }
      renderer.draw(model.selectedId);
    }
  });
})();
