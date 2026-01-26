import {
  Component,
  signal,
  viewChildren,
  ElementRef,
  effect,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  CdkDrag,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import { DATA } from './data';

@Component({
  selector: 'app-assembly-v1-driller',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  template: `
    <div class="driller-wrapper" cdkDropListGroup>
      <svg class="connector-layer">
        <defs>
          <marker
            id="arrow-grey"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 3 0 L 7 5 L 3 10" fill="none" stroke-width="2" stroke="#ced4da"></path>
          </marker>
          <marker
            id="arrow-green"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 3 0 L 7 5 L 3 10" fill="none" stroke-width="2" stroke="green"></path>
          </marker>
          <marker
            id="arrow-red"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 3 0 L 7 5 L 3 10" fill="none" stroke-width="2" stroke="#d32f2f"></path>
          </marker>
        </defs>

        @if (!isDragging()) {
          @for (line of connections(); track $index) {
            <path
              [attr.d]="line.path"
              [attr.stroke]="line.invalid ? '#d32f2f' : line.active ? 'green' : '#ced4da'"
              stroke-width="2"
              fill="none"
              [attr.marker-end]="
                line.invalid
                  ? 'url(#arrow-red)'
                  : line.active
                    ? 'url(#arrow-green)'
                    : 'url(#arrow-grey)'
              "
            />
          }
        }
      </svg>

      @for (col of columns(); track $index; let i = $index) {
        <div class="column-container">
          <div class="column-header">Level {{ i + 1 }}</div>

          <div
            cdkDropList
            class="drop-list"
            [cdkDropListData]="{ parentId: i === 0 ? null : selectedIds()[i - 1], index: i }"
            [cdkDropListEnterPredicate]="canEnter"
            (cdkDropListDropped)="onDrop($event)"
          >
            @if (!col.length) {
              <button class="add-btn">+ Add</button>
            }

            @for (item of col; track item.assemblyId || item.extractedImgId || item.id) {
              <div
                #itemRef
                cdkDrag
                [cdkDragData]="item"
                [attr.data-id]="item.assemblyId || item.extractedImgId || item.id"
                (cdkDragStarted)="isDragging.set(true)"
                (cdkDragEnded)="
                  isDragging.set(false); invalidHoverId.set(null); clearInvalidReason()
                "
                class="draggable-item"
                [class.invalid-drop]="
                  invalidHoverId() === (item.assemblyId || item.extractedImgId || item.id)
                "
                [class.folder]="item.assemblyName"
                [class.active]="
                  selectedIds().includes(item.assemblyId || item.extractedImgId || item.id)
                "
                [class.error-item]="hasValidationError(item, i)"
                (click)="selectItem(item, i)"
              >
                <div class="item-content">
                  @if (item.assemblyName) {
                    <span>📂 {{ item.assemblyName }}</span>
                  } @else if (item.extractedImgId) {
                    <span>🖼️ {{ item.drawingName }}</span>
                  } @else if (item.tableName) {
                    <span>📊 {{ item.tableName }}</span>
                  }

                  @if (hasValidationError(item, i)) {
                    <span class="error-badge" [title]="getValidationError(item, i)">⚠️</span>
                  }
                </div>

                @if (!item.assemblyName) {
                  <button
                    class="delete-btn"
                    (click)="deleteAsset(item, selectedIds()[i - 1]); $event.stopPropagation()"
                  >
                    ×
                  </button>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .driller-wrapper {
        display: flex;
        gap: 4rem;
        padding: 40px;
        min-height: 85vh;
        position: relative;
        overflow-x: auto;
        background: #f8f9fa;
        font-family: 'Inter', system-ui, sans-serif;
      }
      .connector-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
      }
      .column-container {
        flex: 0 0 280px;
        z-index: 1;
      }
      .column-header {
        padding: 12px;
        text-align: center;
        font-weight: 700;
        background: #fff;
        border: 1px solid #dee2e6;
        border-bottom: 2px solid #228be6;
        border-radius: 8px 8px 0 0;
        color: #495057;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .drop-list {
        padding: 12px;
        min-height: 500px;
        background: rgba(255, 255, 255, 0.5);
        border: 1px solid #dee2e6;
        border-top: none;
        border-radius: 0 0 8px 8px;
      }
      .draggable-item {
        padding: 12px;
        margin-bottom: 10px;
        background: white;
        border-radius: 8px;
        border: 1px solid #e9ecef;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
        transition: all 0.2s ease;
      }
      .draggable-item:hover {
        border-color: #228be6;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
      }
      .draggable-item.active {
        border: 2px solid #228be6;
        background: #e7f5ff;
      }
      .draggable-item.error-item {
        border: 2px solid #ffa94d;
        background: #fff4e6;
      }
      .item-content {
        display: flex;
        align-items: center;
        gap: 12px;
        overflow: hidden;
      }
      .error-badge {
        font-size: 1rem;
        cursor: help;
      }
      .asset-icon {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        font-size: 1.1rem;
      }
      .img-icon {
        background: #fff4e6;
      }
      .tab-icon {
        background: #e7f5ff;
      }
      .asset-info {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .name {
        font-size: 0.9rem;
        font-weight: 600;
        color: #343a40;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }
      .sub {
        font-size: 0.7rem;
        color: #868e96;
      }
      .delete-btn {
        background: #fff5f5;
        border: none;
        color: #fa5252;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        opacity: 0;
        transition: opacity 0.2s;
      }
      .draggable-item:hover .delete-btn {
        opacity: 1;
      }
      .cdk-drag-preview {
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        opacity: 0.9;
      }
      .cdk-drag-placeholder {
        opacity: 0.1;
      }
      .invalid-drop {
        border: 2px dashed #d32f2f !important;
        background: rgba(211, 47, 47, 0.08);
        cursor: not-allowed;
      }

      .add-btn {
        width: 100%;
        padding: 6px;
        margin: 4px 0;
        border: 1px dashed #999;
        background: #fafafa;
        cursor: pointer;
      }
    `,
  ],
})
export class Drillerv1Component {
  @Output() onStructureChange = new EventEmitter<any>();

  itemRefs = viewChildren<ElementRef>('itemRef');

  isDragging = signal(false);
  invalidHoverId = signal<string | null>(null);
  invalidReason: string | null = null;

  rawFileData: any = DATA;

  columns = signal<any[][]>([]);
  selectedIds = signal<string[]>([]);
  connections = signal<{ path: string; active: boolean; invalid?: boolean }[]>([]);

  parentMap = new Map<string, string | null>();
  validationErrors = new Map<string, string>();

  constructor() {
    this.refreshView();
    this.buildParentMap();

    if (this.rawFileData.rootIds.length) {
      this.selectItem(this.rawFileData.nodes[this.rawFileData.rootIds[0]], 0);
    }

    effect((onCleanup) => {
      this.columns();
      this.selectedIds();
      const t = setTimeout(() => this.calculateArrows(), 60);
      onCleanup(() => clearTimeout(t));
    });
  }

  /* ================= DROP VALIDATION ================= */

  canEnter = (drag: CdkDrag, drop: CdkDropList): boolean => {
    const item = drag.data;
    const target = drop.data;
    const itemId = item.assemblyId || item.extractedImgId || item.id;

    if (!target?.parentId) {
      if (!item.assemblyId) {
        this.setInvalidReason(itemId, 'Only folders allowed at root');
        return false;
      }
      return true;
    }

    if (item.assemblyId && this.isDescendantFast(itemId, target.parentId)) {
      this.setInvalidReason(itemId, 'Cannot drop into its own descendant');
      return false;
    }

    this.clearInvalidReason();
    return true;
  };

  onDrop(event: CdkDragDrop<any>) {
    this.isDragging.set(false);
    this.invalidHoverId.set(null);
    this.clearInvalidReason();

    const item = event.item.data;
    const itemId = item.assemblyId || item.extractedImgId || item.id;
    const source = event.previousContainer.data;
    const target = event.container.data;

    if (!this.canEnter({ data: item } as CdkDrag, { data: target } as CdkDropList)) return;

    if (event.previousContainer === event.container) {
      const orderArray = target.parentId
        ? this.rawFileData.nodes[target.parentId].itemOrder
        : this.rawFileData.rootIds;

      // Sort items to maintain folders first
      const sortedOrder = this.sortItemsInOrder(orderArray, target.parentId);

      if (target.parentId) {
        this.rawFileData.nodes[target.parentId].itemOrder = sortedOrder;
      } else {
        this.rawFileData.rootIds = sortedOrder;
      }

      this.emitChange(target.parentId, 'REORDER');
    } else {
      this.removeFromModel(source.parentId, itemId, item);
      this.addToModel(target.parentId, itemId, item, event.currentIndex);
      this.emitChange(source.parentId, 'TRANSFER_OUT');
      this.emitChange(target.parentId, 'TRANSFER_IN');
    }

    this.refreshView();
  }

  /* ================= SORTING LOGIC ================= */

  private sortItemsInOrder(itemIds: string[], parentId: string | null): string[] {
    const items = itemIds.map((id) => {
      const node = this.rawFileData.nodes[id];
      if (node) return { id, type: 'folder', item: node };

      if (parentId) {
        const parent = this.rawFileData.nodes[parentId];
        const image = parent?.images?.find((i: any) => i.extractedImgId === id);
        if (image) return { id, type: 'image', item: image };

        const table = parent?.tables?.find((t: any) => t.id === id);
        if (table) return { id, type: 'table', item: table };
      }

      return { id, type: 'unknown', item: null };
    });

    // Sort: folders first, then images, then tables
    const typeOrder = { folder: 0, image: 1, table: 2, unknown: 3 };
    items.sort(
      (a, b) =>
        typeOrder[a.type as keyof typeof typeOrder] - typeOrder[b.type as keyof typeof typeOrder],
    );

    return items.map((i) => i.id);
  }

  /* ================= VALIDATION ================= */

  private validateNode(node: any): void {
    if (!node.assemblyId) return;

    const hasImages = node.images && node.images.length > 0;
    const hasTables = node.tables && node.tables.length > 0;

    if (hasTables && !hasImages) {
      node.tables.forEach((table: any) => {
        this.validationErrors.set(table.id, 'Table exists without any image');
      });
    } else {
      node.tables?.forEach((table: any) => {
        this.validationErrors.delete(table.id);
      });
    }
  }

  hasValidationError(item: any, colIdx: number): boolean {
    const id = item.id || item.extractedImgId;
    return id ? this.validationErrors.has(id) : false;
  }

  getValidationError(item: any, colIdx: number): string {
    const id = item.id || item.extractedImgId;
    return id ? this.validationErrors.get(id) || '' : '';
  }

  /* ================= PERFORMANCE ================= */

  buildParentMap() {
    this.parentMap.clear();
    Object.values(this.rawFileData.nodes).forEach((n: any) => {
      if (n.childIds) n.childIds.forEach((id: string) => this.parentMap.set(id, n.assemblyId));
    });
    this.rawFileData.rootIds.forEach((id: string) => this.parentMap.set(id, null));
  }

  private isDescendantFast(sourceId: string, targetId: string): boolean {
    let current: string | null = targetId;
    while (current) {
      if (current === sourceId) return true;
      current = this.parentMap.get(current) ?? null;
    }
    return false;
  }

  /* ================= UI HELPERS ================= */

  setInvalidReason(id: string, reason: string) {
    this.invalidHoverId.set(id);
    this.invalidReason = reason;
  }

  clearInvalidReason() {
    this.invalidReason = null;
  }

  /* ================= VIEW / DATA ================= */

  refreshView() {
    this.buildParentMap();
    this.validationErrors.clear();

    const cols: any[][] = [];

    // Sort root level items
    const sortedRootIds = this.sortItemsInOrder(this.rawFileData.rootIds, null);
    this.rawFileData.rootIds = sortedRootIds;
    cols.push(sortedRootIds.map((id: string) => this.rawFileData.nodes[id]));

    this.selectedIds().forEach((parentId) => {
      const node = this.rawFileData.nodes[parentId];
      if (!node) return;

      // Validate node
      this.validateNode(node);

      // Sort items in this node
      const sortedOrder = this.sortItemsInOrder(node.itemOrder || [], parentId);
      node.itemOrder = sortedOrder;

      const col = sortedOrder
        .map(
          (id: string) =>
            this.rawFileData.nodes[id] ||
            node.images.find((i: any) => i.extractedImgId === id) ||
            node.tables.find((t: any) => t.id === id),
        )
        .filter(Boolean);

      if (col.length) cols.push(col);
    });

    // Validate all nodes
    Object.values(this.rawFileData.nodes).forEach((node: any) => {
      this.validateNode(node);
    });

    this.columns.set(cols);
  }

  selectItem(item: any, colIdx: number) {
    const id = item.assemblyId || item.extractedImgId || item.id;
    const sel = this.selectedIds().slice(0, colIdx);
    sel[colIdx] = id;
    this.selectedIds.set(sel);
    this.refreshView();
  }

  /* ================= MUTATIONS ================= */

  deleteAsset(asset: any, parentId: string) {
    if (!parentId) return;
    const node = this.rawFileData.nodes[parentId];
    const assetId = asset.extractedImgId || asset.id;

    node.itemOrder = node.itemOrder.filter((id: string) => id !== assetId);
    node.images = node.images.filter((i: any) => i.extractedImgId !== assetId);
    node.tables = node.tables.filter((t: any) => t.id !== assetId);

    this.emitChange(parentId, 'DELETE');
    this.refreshView();
  }

  private removeFromModel(parentId: string | null, itemId: string, item: any) {
    if (parentId) {
      const node = this.rawFileData.nodes[parentId];
      node.itemOrder = node.itemOrder.filter((id: string) => id !== itemId);
      node.childIds = node.childIds.filter((id: string) => id !== itemId);
    } else {
      this.rawFileData.rootIds = this.rawFileData.rootIds.filter((id: string) => id !== itemId);
    }
  }

  private addToModel(parentId: string | null, itemId: string, item: any, index: number) {
    if (parentId) {
      const node = this.rawFileData.nodes[parentId];
      node.itemOrder.splice(index, 0, itemId);
      if (item.assemblyId) {
        node.childIds.push(itemId);
      }
    } else {
      this.rawFileData.rootIds.splice(index, 0, itemId);
    }

    // Re-sort after adding
    if (parentId) {
      const node = this.rawFileData.nodes[parentId];
      node.itemOrder = this.sortItemsInOrder(node.itemOrder, parentId);
    } else {
      this.rawFileData.rootIds = this.sortItemsInOrder(this.rawFileData.rootIds, null);
    }
  }

  /* ================= SVG ================= */

  calculateArrows() {
    const lines: any[] = [];
    const els = this.itemRefs();
    const active = this.selectedIds();
    const dragging = this.isDragging();

    active.forEach((pid, i) => {
      const pEl = els.find((e) => e.nativeElement.dataset.id === pid)?.nativeElement;
      const next = this.columns()[i + 1];
      if (!pEl || !next) return;

      const p = pEl.getBoundingClientRect();
      const wrap = pEl.closest('.driller-wrapper')!.getBoundingClientRect();
      const sx = p.right - wrap.left;
      const sy = p.top - wrap.top + p.height / 2;

      next.forEach((c) => {
        const cid = c.assemblyId || c.extractedImgId || c.id;
        const cEl = els.find((e) => e.nativeElement.dataset.id === cid)?.nativeElement;
        if (!cEl) return;

        const r = cEl.getBoundingClientRect();
        const ex = r.left - wrap.left;
        const ey = r.top - wrap.top + r.height / 2;

        lines.push({
          path: `M ${sx} ${sy} C ${sx + (ex - sx) / 2} ${sy}, ${sx + (ex - sx) / 2} ${ey}, ${ex} ${ey}`,
          active: active[i + 1] === cid,
          invalid: dragging && this.invalidHoverId() === cid,
        });
      });
    });

    this.connections.set(lines);
  }

  private emitChange(nodeId: string | null, action: string) {
    this.onStructureChange.emit({
      nodeId: nodeId || 'ROOT',
      action,
      timestamp: new Date().toISOString(),
    });
  }
}
