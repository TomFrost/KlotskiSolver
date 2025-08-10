(function(){
  const { BoardModel } = window.Klotski;
  const { BoardRenderer } = window.Klotski;
  const { animateMoves, AnimationPlayer } = window.Klotski;
  const { clamp } = window.Klotski.utils;

  const canvas = document.getElementById('board');
  const statusEl = document.getElementById('status');

  const btnReset = document.getElementById('btn-reset');
  const btnClear = document.getElementById('btn-clear');
  const btnDelete = document.getElementById('btn-delete');
  const speedRange = document.getElementById('speed');
  const speedValue = document.getElementById('speed-value');

  // Playback controls
  const playbackControls = document.getElementById('playback-controls');
  const btnRewind = document.getElementById('btn-rewind');
  const btnStepBack = document.getElementById('btn-step-back');
  const btnPlayPause = document.getElementById('btn-play-pause');
  const btnStepForward = document.getElementById('btn-step-forward');
  const btnJumpEnd = document.getElementById('btn-jump-end');

  // Animation player instance
  let animationPlayer = null;

  // Track if puzzle has been solved
  let puzzleIsSolved = false;

  // Puzzles UI
  const saveBtn = document.getElementById('btn-save-puzzle');
  const loadBtn = document.getElementById('btn-load-puzzle');
  const deleteBtn = document.getElementById('btn-delete-puzzle');
  const listEl = document.getElementById('puzzle-list');
  const exportBtn = document.getElementById('btn-export-json');
  const importInput = document.getElementById('file-import');
  const shareBtn = document.getElementById('btn-share-puzzle');
  const setDefaultBtn = document.getElementById('btn-set-default');
  const clearDefaultBtn = document.getElementById('btn-clear-default');

  // Modal elements
  const saveModal = document.getElementById('save-modal');
  const saveModalClose = document.getElementById('save-modal-close');
  const savePuzzleName = document.getElementById('save-puzzle-name');
  const saveNewBtn = document.getElementById('btn-save-new');
  const saveOverwriteBtn = document.getElementById('btn-save-overwrite');

  // Track current loaded puzzle for overwrite functionality
  let currentLoadedPuzzle = null;
  let hasUnsavedChanges = false;

  const model = new BoardModel({ cols: 4, rows: 5, goalX: 1, goalY: 3 });
  const renderer = new BoardRenderer(canvas, model);

  // Initialize Reset button as disabled
  btnReset.disabled = true;

  // Initialize playback controls as disabled
  updatePlaybackButtons();

  // Function to update save button state
  function updateSaveButton() {
    saveBtn.disabled = !hasUnsavedChanges;
  }

  function setStatus(text) { statusEl.textContent = text || ''; }

  // Playback control functions
  function enablePlaybackControls() {
    // Future: Could enable/show playback UI here
  }

  function disablePlaybackControls() {
    // Future: Could disable/hide playback UI here
  }

  function updatePlaybackButtons() {
    if (!animationPlayer) {
      btnRewind.disabled = true;
      btnStepBack.disabled = true;
      btnPlayPause.disabled = false; // Keep play button enabled for solving
      btnStepForward.disabled = true;
      btnJumpEnd.disabled = true;

      // Set play button to blue if puzzle hasn't been solved
      if (!puzzleIsSolved) {
        btnPlayPause.classList.add('solve-mode');
        btnPlayPause.title = 'Solve puzzle';
      } else {
        btnPlayPause.classList.remove('solve-mode');
        btnPlayPause.title = 'Play/Pause';
      }

      disablePlaybackControls();
      return;
    }

    const progress = animationPlayer.getProgress();
    const isAtStart = progress === 0;
    const isAtEnd = progress === 1;
    const isPlaying = animationPlayer.isPlaying && !animationPlayer.isPaused;

    // Check if we're truly at the very beginning (step 0, substep 0)
    const isAtVeryBeginning = animationPlayer.currentStep === 0 && animationPlayer.currentSubStep === 0;

    btnRewind.disabled = isAtVeryBeginning;
    btnStepBack.disabled = isAtVeryBeginning;
    btnPlayPause.disabled = isAtEnd;
    btnStepForward.disabled = isAtEnd;
    btnJumpEnd.disabled = isAtEnd;

    // Update play/pause button text
    btnPlayPause.textContent = isPlaying ? '⏸' : '▶';
    btnPlayPause.title = isPlaying ? 'Pause' : 'Play';

    // Remove solve mode styling when we have an animation player
    btnPlayPause.classList.remove('solve-mode');

    enablePlaybackControls();
  }

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
      else {
        setStatus('');
        hasUnsavedChanges = true;
        updateSaveButton();
        // Reset puzzle solved state when pieces are moved
        puzzleIsSolved = false;
        animationPlayer = null;
        updatePlaybackButtons();
      }
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
              hasUnsavedChanges = true;
              updateSaveButton();
              // Reset puzzle solved state when pieces are added
              puzzleIsSolved = false;
              animationPlayer = null;
              updatePlaybackButtons();
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
      hasUnsavedChanges = true;
      updateSaveButton();
      // Reset puzzle solved state when pieces are deleted
      puzzleIsSolved = false;
      animationPlayer = null;
      updatePlaybackButtons();
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
    hasUnsavedChanges = true;
    updateSaveButton();
    // Reset puzzle solved state
    puzzleIsSolved = false;
    // Disable playback controls when clearing
    animationPlayer = null;
    updatePlaybackButtons();
    renderer.draw(model.selectedId);
  });

  btnReset.addEventListener('click', () => {
    model.resetToLastSaved();
    setStatus('Reset to saved state');
    btnDelete.disabled = !!model.selectedId;
    btnReset.disabled = true; // Disable Reset after using it
    // Reset puzzle solved state
    puzzleIsSolved = false;
    // Disable playback controls when resetting
    animationPlayer = null;
    updatePlaybackButtons();
    renderer.draw(model.selectedId);
  });

  // Puzzles helpers
  function refreshList() {
    const names = window.Klotski.Storage.listNames();
    const defaultName = window.Klotski.Storage.getDefaultName();
    listEl.innerHTML = '';
    names.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = defaultName === n ? `★ ${n}` : n;
      listEl.appendChild(opt);
    });
    loadBtn.disabled = !listEl.value;
    deleteBtn.disabled = !listEl.value;

    // Update default buttons
    const selectedName = listEl.value;
    const isDefault = selectedName === defaultName;
    setDefaultBtn.disabled = !selectedName || isDefault;
    clearDefaultBtn.disabled = !selectedName || !isDefault;
  }

  function setFromState(state) {
    model.loadState(state);
    btnReset.disabled = true; // Disable Reset when loading a new state
    // Reset puzzle solved state
    puzzleIsSolved = false;
    // Disable playback controls when loading a new state
    animationPlayer = null;
    updatePlaybackButtons();
    renderer.draw(model.selectedId);
  }

  // Modal functions
  function showSaveModal() {
    saveModal.classList.add('show');
    savePuzzleName.focus();
    savePuzzleName.value = currentLoadedPuzzle || '';
    saveOverwriteBtn.disabled = !currentLoadedPuzzle;
  }

  function hideSaveModal() {
    saveModal.classList.remove('show');
    savePuzzleName.value = '';
  }

  // Save button in header
  saveBtn.addEventListener('click', () => {
    showSaveModal();
  });

  // Modal close
  saveModalClose.addEventListener('click', hideSaveModal);
  saveModal.addEventListener('click', (e) => {
    if (e.target === saveModal) hideSaveModal();
  });

  // Save new
  saveNewBtn.addEventListener('click', () => {
    const name = savePuzzleName.value.trim();
    if (!name) { setStatus('Enter a name to save'); return; }
    const state = model.getInitialState();
    window.Klotski.Storage.savePuzzle(name, state);
    refreshList();
    hideSaveModal();
    currentLoadedPuzzle = name;
    hasUnsavedChanges = false;
    updateSaveButton();
    setStatus(`Saved "${name}"`);
  });

  // Save overwrite
  saveOverwriteBtn.addEventListener('click', () => {
    if (!currentLoadedPuzzle) return;
    const state = model.getInitialState();
    window.Klotski.Storage.savePuzzle(currentLoadedPuzzle, state);
    refreshList();
    hideSaveModal();
    hasUnsavedChanges = false;
    updateSaveButton();
    setStatus(`Updated "${currentLoadedPuzzle}"`);
  });

  // Enter key in modal
  savePuzzleName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (currentLoadedPuzzle && saveOverwriteBtn.disabled === false) {
        saveOverwriteBtn.click();
      } else {
        saveNewBtn.click();
      }
    } else if (e.key === 'Escape') {
      hideSaveModal();
    }
  });

    listEl.addEventListener('change', () => {
    loadBtn.disabled = !listEl.value;
    deleteBtn.disabled = !listEl.value;

    // Update default buttons when selection changes
    const selectedName = listEl.value;
    const defaultName = window.Klotski.Storage.getDefaultName();
    const isDefault = selectedName === defaultName;
    setDefaultBtn.disabled = !selectedName || isDefault;
    clearDefaultBtn.disabled = !selectedName || !isDefault;
  });

  // Set default button
  setDefaultBtn.addEventListener('click', () => {
    const name = listEl.value;
    if (!name) return;
    window.Klotski.Storage.setDefaultName(name);
    setStatus(`Set "${name}" as default`);
    refreshList();
  });

  // Clear default button
  clearDefaultBtn.addEventListener('click', () => {
    const name = listEl.value;
    if (!name) return;
    window.Klotski.Storage.clearDefaultName();
    setStatus(`Removed "${name}" as default`);
    refreshList();
  });

  loadBtn.addEventListener('click', () => {
    const name = listEl.value;
    if (!name) return;
    const state = window.Klotski.Storage.getPuzzle(name);
    if (state) {
      setFromState(state);
      currentLoadedPuzzle = name;
      hasUnsavedChanges = false;
      updateSaveButton();
      setStatus(`Loaded "${name}"`);
    }
  });

  deleteBtn.addEventListener('click', () => {
    const name = listEl.value;
    if (!name) return;
    window.Klotski.Storage.deletePuzzle(name);
    if (currentLoadedPuzzle === name) {
      currentLoadedPuzzle = null;
    }
    refreshList();
    setStatus(`Deleted "${name}"`);
  });

  exportBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(model.getInitialState(), null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (currentLoadedPuzzle || 'klotski-puzzle') + '.json';
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
      currentLoadedPuzzle = null; // Imported puzzles are not from saves
      hasUnsavedChanges = false;
      updateSaveButton();
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
      currentLoadedPuzzle = null; // Hash loads are not from saves
      hasUnsavedChanges = false;
      updateSaveButton();
      setStatus('Loaded from link');
      return true;
    } catch { return false; }
  }

  function tryLoadDefault() {
    const def = window.Klotski.Storage.getDefaultName();
    if (!def) return false;
    const state = window.Klotski.Storage.getPuzzle(def);
    if (!state) return false;
    setFromState(state);
    currentLoadedPuzzle = def;
    hasUnsavedChanges = false;
    updateSaveButton();
    setStatus(`Loaded default "${def}"`);
    return true;
  }

  refreshList();
  if (!tryLoadFromHash()) tryLoadDefault();

    // Helper function to auto-pause if currently playing and wait for it to complete
  async function autoPauseIfPlaying() {
    if (animationPlayer && animationPlayer.isPlaying && !animationPlayer.isPaused) {
      animationPlayer.pause();

      // Wait for the pause to actually take effect
      let waitCount = 0;
      const maxWait = 100; // Max 1 second wait (100 * 10ms)

      while ((animationPlayer.pendingPause || animationPlayer.isPlaying) && !animationPlayer.isPaused && waitCount < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 10));
        waitCount++;
      }

      return true;
    }
    return false;
  }

  // Playback control event listeners
  btnRewind.addEventListener('click', async () => {
    if (animationPlayer) {
      await autoPauseIfPlaying();
      animationPlayer.reset();
      updatePlaybackButtons();
    }
  });

  btnStepBack.addEventListener('click', async () => {
    if (animationPlayer) {
      await autoPauseIfPlaying();
      animationPlayer.stepBackward();
      updatePlaybackButtons();
    }
  });

  btnPlayPause.addEventListener('click', async () => {
    // If no animation player and puzzle not solved, trigger solve
    if (!animationPlayer && !puzzleIsSolved) {
      await solvePuzzle();
      return;
    }

    if (!animationPlayer) return;

    if (animationPlayer.isPlaying && !animationPlayer.isPaused) {
      animationPlayer.pause();
    } else if (animationPlayer.isPaused) {
      animationPlayer.resume();
    } else {
      animationPlayer.play();
    }
    updatePlaybackButtons();
  });

  btnStepForward.addEventListener('click', async () => {
    if (animationPlayer) {
      await autoPauseIfPlaying();
      animationPlayer.stepForward();
      updatePlaybackButtons();
    }
  });

  btnJumpEnd.addEventListener('click', async () => {
    if (animationPlayer) {
      await autoPauseIfPlaying();
      animationPlayer.jumpToEnd();
      updatePlaybackButtons();
    }
  });

  // Solve function
  async function solvePuzzle() {
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

      if (moves === null) {
        setStatus('This puzzle has no solution');
        return;
      }
      if (!Array.isArray(moves)) throw new Error('Solver did not return an array');
      setStatus(`Solution found - ${moves.length} moves in ${(solveTimeMs / 1000).toFixed(3)}s`);

      // Create animation player
      animationPlayer = new AnimationPlayer({
        model,
        renderer,
        moves,
        msPerStep: Number(speedRange.value),
        onStatus: setStatus,
        getSpeed: () => Number(speedRange.value),
        onProgress: () => updatePlaybackButtons(),
        onComplete: () => {
          setStatus(`Animation complete - ${moves.length} moves`);
          updatePlaybackButtons();
        }
      });

      console.log('Animation player created with', moves.length, 'moves');

      // Mark puzzle as solved
      puzzleIsSolved = true;

      // Enable playback controls and start auto-play
      updatePlaybackButtons();
      animationPlayer.play();

      solveSuccessful = true;
    } catch (err) {
      console.error(err);
      setStatus('Error: ' + (err?.message || String(err)));
    } finally {
      btnClear.disabled = false;
      btnDelete.disabled = !model.selectedId;
      // Only enable Reset if the solve was successful
      if (solveSuccessful) {
        btnReset.disabled = false;
      }
      renderer.draw(model.selectedId);
    }
  }
})();
