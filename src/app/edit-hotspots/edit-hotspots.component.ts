import {
  Component,
  signal,
  viewChild,
  ElementRef,
  inject,
  OnInit,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IAssemblyItem, IHotspotDetail } from '../final-setup/data.model';

@Component({
  selector: 'app-edit-hotspots',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './edit-hotspots.component.html',
  styleUrl: './edit-hotspots.component.scss',
})
export class EditHotspotsComponent implements OnInit, AfterViewInit {
  private dialogRef = inject(MatDialogRef<EditHotspotsComponent>);
  readonly assemblyItem: IAssemblyItem = inject(MAT_DIALOG_DATA);

  imageCanvas = viewChild<ElementRef<HTMLCanvasElement>>('imageCanvas');
  overlayCanvas = viewChild<ElementRef<HTMLCanvasElement>>('overlayCanvas');
  tableScrollEl = viewChild<ElementRef<HTMLElement>>('tableScroll');

  // ── Reactive state ────────────────────────────────────────────────────────
  hotspots = signal<IHotspotDetail[]>([]);
  hoveredRowIndex = signal<number | null>(null);
  imageLoaded = signal(false);
  isDrawingMode = signal(false);
  drawingForRow = signal<number | null>(null);

  // ── Private canvas / drawing state ────────────────────────────────────────
  private img: HTMLImageElement | null = null;
  private scale = 1;
  private naturalW = 0;
  private naturalH = 0;
  private drawStart: { x: number; y: number } | null = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit() {
    this.hotspots.set(structuredClone(this.assemblyItem.hotspotDetails ?? []));
  }

  ngAfterViewInit() {
    this.loadImage();
  }

  // ── Image loading ──────────────────────────────────────────────────────────
  private buildUrl(): string {
    const { extractedImgId, extractedImgVersion } = this.assemblyItem;
    return `https://api2.cdsvisual.net/v1/files/a256ecb3-7c33-43f9-9922-fc61f1967883?v=2`;
  }

  private loadImage() {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      this.img = img;
      this.naturalW = img.naturalWidth;
      this.naturalH = img.naturalHeight;
      this.imageLoaded.set(true);
      requestAnimationFrame(() => {
        this.fitAndDraw();
      });
    };

    img.onerror = () => {
      const fallback = this.assemblyItem.imageUrl;
      if (fallback && img.src !== fallback) {
        img.src = fallback;
      }
    };

    img.src = this.buildUrl();
  }

  private fitAndDraw() {
    const ic = this.imageCanvas()?.nativeElement;
    const oc = this.overlayCanvas()?.nativeElement;
    if (!ic || !oc || !this.img) return;

    const wrapper = ic.parentElement!;
    this.scale = Math.min(wrapper.clientWidth / this.naturalW, wrapper.clientHeight / this.naturalH);
    const w = Math.round(this.naturalW * this.scale);
    const h = Math.round(this.naturalH * this.scale);

    ic.width = oc.width = w;
    ic.height = oc.height = h;

    const ctx = ic.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.img, 0, 0, w, h);

    this.paintOverlay();
  }

  // ── Overlay drawing ────────────────────────────────────────────────────────
  private paintOverlay(
    liveRect: { x: number; y: number; w: number; h: number } | null = null,
  ) {
    const oc = this.overlayCanvas()?.nativeElement;
    if (!oc) return;
    const ctx = oc.getContext('2d')!;
    ctx.clearRect(0, 0, oc.width, oc.height);

    const s = this.scale;
    const rowHovered = this.hoveredRowIndex();
    const drawingRow = this.drawingForRow();

    this.hotspots().forEach((h, i) => {
      const coords = h.hotspotCoords;
      if (!coords?.length || !coords[0] || !coords[1]) return;

      const x = coords[0][0] * s;
      const y = coords[0][1] * s;
      const bw = (coords[1][0] - coords[0][0]) * s;
      const bh = (coords[1][1] - coords[0][1]) * s;

      const isHit = i === rowHovered;
      const isBeingDrawn = i === drawingRow;

      ctx.save();
      ctx.fillStyle = isBeingDrawn
        ? 'rgba(76,175,80,0.15)'
        : isHit
          ? 'rgba(255,107,0,0.25)'
          : 'rgba(33,150,243,0.15)';
      ctx.strokeStyle = isBeingDrawn ? '#4CAF50' : isHit ? '#ff6b00' : '#2196F3';
      ctx.lineWidth = isHit || isBeingDrawn ? 3 : 2;

      ctx.fillRect(x, y, bw, bh);
      ctx.strokeRect(x, y, bw, bh);

      // Label
      const labelSize = Math.max(10, Math.round(13 * s));
      ctx.fillStyle = isBeingDrawn ? '#2e7d32' : isHit ? '#ff6b00' : '#1565C0';
      ctx.font = `bold ${labelSize}px sans-serif`;
      ctx.fillText(h.hotspotString, x + 4, y + labelSize + 2);
      ctx.restore();
    });

    // Live drawing rectangle
    if (liveRect) {
      ctx.save();
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.fillStyle = 'rgba(76,175,80,0.15)';
      ctx.fillRect(liveRect.x, liveRect.y, liveRect.w, liveRect.h);
      ctx.strokeRect(liveRect.x, liveRect.y, liveRect.w, liveRect.h);
      ctx.restore();
    }
  }

  // ── Canvas mouse events ────────────────────────────────────────────────────
  onCanvasMouseDown(event: MouseEvent) {
    if (!this.isDrawingMode()) return;
    const rect = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    this.drawStart = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  onCanvasMouseMove(event: MouseEvent) {
    const canvas = event.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;

    // Drawing mode: show live rect
    if (this.isDrawingMode() && this.drawStart) {
      const lx = Math.min(this.drawStart.x, mx);
      const ly = Math.min(this.drawStart.y, my);
      this.paintOverlay({
        x: lx,
        y: ly,
        w: Math.abs(mx - this.drawStart.x),
        h: Math.abs(my - this.drawStart.y),
      });
      return;
    }

    // Hover mode: hit-test hotspots
    const s = this.scale;
    let found: number | null = null;
    this.hotspots().every((h, i) => {
      const coords = h.hotspotCoords;
      if (!coords?.length || !coords[0] || !coords[1]) return true;
      const x = coords[0][0] * s;
      const y = coords[0][1] * s;
      const bw = (coords[1][0] - coords[0][0]) * s;
      const bh = (coords[1][1] - coords[0][1]) * s;
      if (mx >= x && mx <= x + bw && my >= y && my <= y + bh) {
        found = i;
        return false;
      }
      return true;
    });

    this.hoveredRowIndex.set(found);
    this.paintOverlay();
    if (found !== null) this.scrollToRow(found);
  }

  onCanvasMouseUp(event: MouseEvent) {
    if (!this.isDrawingMode() || !this.drawStart) return;
    const canvas = event.currentTarget as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const rowIdx = this.drawingForRow();

    if (rowIdx !== null) {
      const s = this.scale;
      const x1 = Math.round(Math.min(this.drawStart.x, mx) / s);
      const y1 = Math.round(Math.min(this.drawStart.y, my) / s);
      const x2 = Math.round(Math.max(this.drawStart.x, mx) / s);
      const y2 = Math.round(Math.max(this.drawStart.y, my) / s);

      this.hotspots.update((hs) => {
        const copy = [...hs];
        copy[rowIdx] = {
          ...copy[rowIdx],
          hotspotCoords: [
            [x1, y1],
            [x2, y2],
          ],
        };
        return copy;
      });
    }

    this.drawStart = null;
    this.isDrawingMode.set(false);
    this.drawingForRow.set(null);
    this.paintOverlay();
  }

  onCanvasMouseLeave() {
    if (this.isDrawingMode()) return;
    this.hoveredRowIndex.set(null);
    this.paintOverlay();
  }

  private scrollToRow(index: number): void {
    const scroll = this.tableScrollEl()?.nativeElement;
    if (!scroll) return;
    const row = scroll.querySelector<HTMLElement>(`[data-row="${index}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ── Table row hover events ─────────────────────────────────────────────────
  onRowHover(i: number) {
    this.hoveredRowIndex.set(i);
    this.paintOverlay();
  }

  onRowLeave() {
    this.hoveredRowIndex.set(null);
    this.paintOverlay();
  }

  // ── Field updates ──────────────────────────────────────────────────────────
  updateField(index: number, field: keyof IHotspotDetail, value: string) {
    this.hotspots.update((hs) => {
      const copy = [...hs];
      (copy[index] as unknown as Record<string, unknown>)[field as string] = value;
      return copy;
    });
  }

  // ── Row actions ────────────────────────────────────────────────────────────
  addRow() {
    this.hotspots.update((hs) => [
      ...hs,
      {
        hotspotString: String(hs.length + 1),
        partId: null,
        hotspotCoords: [],
        partDescription: null,
        qty: '',
      },
    ]);
  }

  addRowAfter(index: number) {
    this.hotspots.update((hs) => {
      const copy = [...hs];
      copy.splice(index + 1, 0, {
        hotspotString: String(copy.length + 1),
        partId: null,
        hotspotCoords: [],
        partDescription: null,
        qty: '',
      });
      return copy;
    });
    this.paintOverlay();
  }

  deleteRow(index: number) {
    if (this.drawingForRow() === index) {
      this.cancelDrawing();
    }
    this.hotspots.update((hs) => hs.filter((_, i) => i !== index));
    this.paintOverlay();
  }

  startDrawCoords(rowIndex: number) {
    this.drawStart = null;
    this.drawingForRow.set(rowIndex);
    this.isDrawingMode.set(true);
    this.paintOverlay();
  }

  cancelDrawing() {
    this.drawStart = null;
    this.isDrawingMode.set(false);
    this.drawingForRow.set(null);
    this.paintOverlay();
  }

  coordsLabel(h: IHotspotDetail): string {
    const c = h.hotspotCoords;
    if (!c?.length || !c[0] || !c[1]) return '—';
    return `[${c[0][0]},${c[0][1]}]→[${c[1][0]},${c[1][1]}]`;
  }

  // ── Dialog actions ─────────────────────────────────────────────────────────
  save() {
    const result: IAssemblyItem = { ...this.assemblyItem, hotspotDetails: this.hotspots() };
    this.dialogRef.close(result);
  }

  cancel() {
    this.dialogRef.close(null);
  }

  // ── Static opener helper ──────────────────────────────────────────────────
  static open(dialog: import('@angular/material/dialog').MatDialog, data: IAssemblyItem) {
    return dialog.open<EditHotspotsComponent, IAssemblyItem, IAssemblyItem | null>(
      EditHotspotsComponent,
      {
        data,
        disableClose: true,
        width: '90vw',
        height: '90vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        panelClass: 'edit-hotspots-dialog',
      },
    );
  }
}
