(function(){
  /** Canvas renderer for the Klotski board */
  class BoardRenderer {
    constructor(canvas, model) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.model = model;
      this.devicePixelRatio = window.devicePixelRatio || 1;
      this.gridPadding = 12; // px around grid
      // Map type to color from CSS variables
      const gcs = getComputedStyle(document.documentElement);
      this.colorByType = {
        '2x2': gcs.getPropertyValue('--color-2x2').trim() || '#fde68a',
        '2x1': gcs.getPropertyValue('--color-2x1').trim() || '#bae6fd',
        '1x2': gcs.getPropertyValue('--color-1x2').trim() || '#bbf7d0',
        '1x1': gcs.getPropertyValue('--color-1x1').trim() || '#fecaca',
      };
    }

      resizeToContainer() {
    // Use current CSS size as the logical size, then set the buffer to DPR-scaled size
    const cssWidth = this.canvas.clientWidth || this.canvas.width;
    const cssHeight = this.canvas.clientHeight || this.canvas.height;
    const scale = this.devicePixelRatio;

    // Ensure CSS size is explicitly set so it doesn't track the intrinsic pixel size
    this.canvas.style.width = cssWidth + 'px';
    this.canvas.style.height = cssHeight + 'px';

    // Match the backing store to DPR for crisp rendering
    this.canvas.width = Math.floor(cssWidth * scale);
    this.canvas.height = Math.floor(cssHeight * scale);

    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

    draw(selectedId = null, draggingGhost = null, animation = null) {
      const ctx = this.ctx;
      const { cols, rows, goal } = this.model;
      const cw = this.canvas.clientWidth || this.canvas.width / (window.devicePixelRatio || 1);
      const ch = this.canvas.clientHeight || this.canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, cw, ch);

      const pad = this.gridPadding;
      const gridWidth = cw - pad * 2;
      const gridHeight = ch - pad * 2;
      const cellSize = Math.min(gridWidth / cols, gridHeight / rows);
      const gridX = (cw - cellSize * cols) / 2;
      const gridY = (ch - cellSize * rows) / 2;

      // Store for hit tests
      this.layout = { gridX, gridY, cellSize };

      // Draw grid background
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-bg') || '#f3f4f6';
      ctx.fillRect(gridX, gridY, cellSize * cols, cellSize * rows);

      // Draw grid lines
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-color') || '#d1d5db';
      ctx.lineWidth = 1;
      for (let c = 0; c <= cols; c++) {
        const x = gridX + c * cellSize;
        ctx.beginPath(); ctx.moveTo(x, gridY); ctx.lineTo(x, gridY + rows * cellSize); ctx.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        const y = gridY + r * cellSize;
        ctx.beginPath(); ctx.moveTo(gridX, y); ctx.lineTo(gridX + cols * cellSize, y); ctx.stroke();
      }

      // Goal zone highlight
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--goal') || '#f59e0b';
      ctx.globalAlpha = 0.15;
      ctx.fillRect(gridX + goal.x * cellSize, gridY + goal.y * cellSize, goal.w * cellSize, goal.h * cellSize);
      ctx.globalAlpha = 1;

      // Draw pieces
      this.model.pieces.forEach((p, idx) => {
        if (animation && animation.id === p.id) {
          return; // skip default draw; will draw animated at interpolated position below
        }
        const x = gridX + p.x * cellSize;
        const y = gridY + p.y * cellSize;
        const w = p.w * cellSize;
        const h = p.h * cellSize;

        const fill = this.colorByType[p.type] || '#e5e7eb';
      ctx.fillStyle = fill;
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--piece-border') || '#111827';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const radius = Math.max(6, Math.min(w, h) * 0.12);
        this.#roundRect(ctx, x + 2, y + 2, w - 4, h - 4, radius);
        ctx.fill();
        ctx.stroke();

        // ID label
        ctx.fillStyle = '#111827';
        ctx.font = `${Math.floor(cellSize * 0.35)}px ui-sans-serif, system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.id, x + w / 2, y + h / 2);

        if (p.id === selectedId) {
          ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--selected') || '#10b981';
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
        }
      });

      // Animated moving piece overlay
      if (animation) {
        const p = this.model.pieces.find(pp => pp.id === animation.id);
        if (p) {
          const { gridX, gridY, cellSize } = this.layout;
          const ax = animation.from.x + (animation.to.x - animation.from.x) * (animation.t ?? 0);
          const ay = animation.from.y + (animation.to.y - animation.from.y) * (animation.t ?? 0);
          const px = gridX + ax * cellSize;
          const py = gridY + ay * cellSize;
          const pw = p.w * cellSize;
          const ph = p.h * cellSize;
          const fill = this.colorByType[p.type] || '#e5e7eb';
          const ctx2 = this.ctx;
          ctx2.fillStyle = fill;
          ctx2.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--piece-border') || '#111827';
          ctx2.lineWidth = 2;
          ctx2.beginPath();
          const radius = Math.max(6, Math.min(pw, ph) * 0.12);
          this.#roundRect(ctx2, px + 2, py + 2, pw - 4, ph - 4, radius);
          ctx2.fill();
          ctx2.stroke();
          // ID label
          ctx2.fillStyle = '#111827';
          ctx2.font = `${Math.floor(cellSize * 0.35)}px ui-sans-serif, system-ui`;
          ctx2.textAlign = 'center';
          ctx2.textBaseline = 'middle';
          ctx2.fillText(p.id, px + pw / 2, py + ph / 2);
        }
      }

      // Dragging ghost overlay
      if (draggingGhost) {
        const { x, y, w, h } = draggingGhost;
        const gx = gridX + x * cellSize;
        const gy = gridY + y * cellSize;
        ctx.save();
        ctx.strokeStyle = '#10b981';
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(gx + 2, gy + 2, w * cellSize - 4, h * cellSize - 4);
        ctx.restore();
      }
    }

    gridToPixel(x, y) {
      const { gridX, gridY, cellSize } = this.layout;
      return { x: gridX + x * cellSize, y: gridY + y * cellSize };
    }

    pixelToGrid(px, py) {
      const { gridX, gridY, cellSize } = this.layout;
      const gx = Math.floor((px - gridX) / cellSize);
      const gy = Math.floor((py - gridY) / cellSize);
      return { x: gx, y: gy };
    }

    #roundRect(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  window.Klotski = window.Klotski || {};
  window.Klotski.BoardRenderer = BoardRenderer;
})();
