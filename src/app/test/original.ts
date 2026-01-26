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
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { DATA } from './data';

@Component({
  selector: 'app-assembly-org-driller',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  template: `
    <div class="driller-wrapper" cdkDropListGroup>
      <!-- SVG Connector Layer for S-Curves -->
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
            <path
              d="M 3 0 L 7 5 L 3 10"
              fill="none"
              stroke-width="2"
              stroke-linecap="round"
              stroke="#ced4da"
            ></path>
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
        </defs>
        @if (!isDragging()) {
          @for (line of connections(); track $index) {
            <path
              [attr.d]="line.path"
              [attr.stroke]="line.active ? 'green' : '#ced4da'"
              stroke-width="2"
              fill="none"
              [attr.marker-end]="line.active ? 'url(#arrow-green)' : 'url(#arrow-grey)'"
            />
          }
        }
      </svg>

      <!-- Dynamic Columns -->
      @for (col of columns(); track $index; let i = $index) {
        <div class="column-container">
          <div class="column-header">Level {{ i + 1 }}</div>

          <div
            cdkDropList
            [cdkDropListData]="{ parentId: i === 0 ? null : selectedIds()[i - 1], index: i }"
            (cdkDropListDropped)="onDrop($event)"
            class="drop-list"
          >
            @for (item of col; track item.assemblyId || item.extractedImgId || item.id) {
              <div
                #itemRef
                [attr.data-id]="item.assemblyId || item.extractedImgId || item.id"
                cdkDrag
                [cdkDragData]="item"
                (cdkDragStarted)="isDragging.set(true)"
                (cdkDragEnded)="isDragging.set(false)"
                class="draggable-item"
                [class.folder]="item.assemblyName"
                [class.active]="
                  selectedIds().includes(item.assemblyId || item.extractedImgId || item.id)
                "
                (click)="selectItem(item, i)"
              >
                <div class="item-content">
                  @if (item.assemblyName) {
                    <span>📂 {{ item.assemblyName }}</span>
                  } @else if (item.extractedImgId) {
                    <div class="asset-icon img-icon">🖼️</div>
                    <div class="asset-info">
                      <span class="name">{{ item.drawingName }}</span>
                      <span class="sub">Image Asset</span>
                    </div>
                  } @else if (item.tableName) {
                    <div class="asset-icon tab-icon">📊</div>
                    <div class="asset-info">
                      <span class="name">{{ item.tableName }}</span>
                      <span class="sub">Table Data</span>
                    </div>
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
      .item-content {
        display: flex;
        align-items: center;
        gap: 12px;
        overflow: hidden;
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
        flexdirection: column;
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
    `,
  ],
})
export class DrillerOrgComponent {
  /**
   * Tracks and emits structure changes (reordering, transfers, deletions)
   */
  @Output() onStructureChange = new EventEmitter<any>();

  itemRefs = viewChildren<ElementRef>('itemRef');
  isDragging = signal(false);

  // Initial Data State based on your provided JSON
  rawFileData: any = DATA;

  columns = signal<any[][]>([]);
  selectedIds = signal<string[]>([]);
  connections = signal<{ path: string; active: boolean }[]>([]);

  constructor() {
    this.refreshView();
    // Default drill into first root
    if (this.rawFileData.rootIds.length) {
      this.selectItem(this.rawFileData.nodes[this.rawFileData.rootIds[0]], 0);
    }

    effect((onCleanup) => {
      this.columns();
      this.selectedIds();
      const timeout = setTimeout(() => this.calculateArrows(), 60);
      onCleanup(() => clearTimeout(timeout));
    });
  }

  private emitChange(nodeId: string | null, action: string) {
    this.onStructureChange.emit({
      nodeId: nodeId || 'ROOT',
      action,
      newOrder: nodeId ? this.rawFileData.nodes[nodeId].itemOrder : this.rawFileData.rootIds,
      timestamp: new Date().toISOString(),
    });
  }

  refreshView() {
    const newCols: any[][] = [];
    newCols.push(this.rawFileData.rootIds.map((id: string) => this.rawFileData.nodes[id]));

    this.selectedIds().forEach((parentId) => {
      const node = this.rawFileData.nodes[parentId];
      if (node) {
        // Build column content strictly following the user-defined itemOrder
        const colContent = (node.itemOrder || [])
          .map((id: string) => {
            return (
              this.rawFileData.nodes[id] ||
              node.images.find((img: any) => img.extractedImgId === id) ||
              node.tables.find((tab: any) => tab.id === id)
            );
          })
          .filter((i: any) => !!i);
        if (colContent.length > 0) newCols.push(colContent);
      }
    });
    this.columns.set(newCols);
  }

  selectItem(item: any, colIdx: number) {
    const id = item.assemblyId || item.extractedImgId || item.id;
    const selections = this.selectedIds().slice(0, colIdx);
    selections[colIdx] = id;
    this.selectedIds.set(selections);
    this.refreshView();
  }

  deleteAsset(asset: any, parentId: string) {
    if (!parentId) return;
    const node = this.rawFileData.nodes[parentId];
    const assetId = asset.extractedImgId || asset.id;

    node.itemOrder = node.itemOrder.filter((id: string) => id !== assetId);
    if (asset.extractedImgId)
      node.images = node.images.filter((i: any) => i.extractedImgId !== assetId);
    else node.tables = node.tables.filter((t: any) => t.id !== assetId);

    this.emitChange(parentId, 'DELETE');
    this.refreshView();
  }

  onDrop(event: CdkDragDrop<any>) {
    this.isDragging.set(false);
    const item = event.item.data;
    const itemId = item.assemblyId || item.extractedImgId || item.id;
    const source = event.previousContainer.data;
    const target = event.container.data;

    // RULE: Assets cannot exist at Level 1 (Root)
    if (!target.parentId && !item.assemblyId) return;

    if (event.previousContainer === event.container) {
      // Reordering in same list
      const orderArray = target.parentId
        ? this.rawFileData.nodes[target.parentId].itemOrder
        : this.rawFileData.rootIds;
      moveItemInArray(orderArray, event.previousIndex, event.currentIndex);
      this.emitChange(target.parentId, 'REORDER');
    } else {
      // Transfer across lists/levels
      this.removeFromModel(source.parentId, itemId, item);
      this.addToModel(target.parentId, itemId, item, event.currentIndex);
      this.emitChange(source.parentId, 'TRANSFER_OUT');
      this.emitChange(target.parentId, 'TRANSFER_IN');
    }
    this.refreshView();
  }

  private removeFromModel(parentId: string | null, itemId: string, item: any) {
    if (parentId) {
      const node = this.rawFileData.nodes[parentId];
      node.itemOrder = node.itemOrder.filter((id: string) => id !== itemId);
      if (item.extractedImgId)
        node.images = node.images.filter((i: any) => i.extractedImgId !== itemId);
      else if (item.tableName) node.tables = node.tables.filter((t: any) => t.id !== itemId);
      else node.childIds = node.childIds.filter((id: string) => id !== itemId);
    } else {
      this.rawFileData.rootIds = this.rawFileData.rootIds.filter((id: any) => id !== itemId);
    }
  }

  private addToModel(parentId: string | null, itemId: string, item: any, index: number) {
    if (parentId) {
      const node = this.rawFileData.nodes[parentId];
      node.itemOrder.splice(index, 0, itemId);
      if (item.extractedImgId) node.images.push(item);
      else if (item.tableName) node.tables.push(item);
      else node.childIds.push(itemId);
    } else {
      this.rawFileData.rootIds.splice(index, 0, itemId);
    }
  }

  calculateArrows() {
    const lines: { path: string; active: boolean }[] = [];
    const elements = this.itemRefs();
    const activeIds = this.selectedIds();

    activeIds.forEach((parentId, colIdx) => {
      const parentEl = elements.find(
        (el) => el.nativeElement.getAttribute('data-id') === parentId,
      )?.nativeElement;
      const nextCol = this.columns()[colIdx + 1];
      if (parentEl && nextCol) {
        const pRect = parentEl.getBoundingClientRect();
        const wrapRect = parentEl.closest('.driller-wrapper')!.getBoundingClientRect();
        const sX = pRect.right - wrapRect.left;
        const sY = pRect.top - wrapRect.top + pRect.height / 2;

        nextCol.forEach((child) => {
          const childId = child.assemblyId || child.extractedImgId || child.id;
          const childEl = elements.find(
            (el) => el.nativeElement.getAttribute('data-id') === childId,
          )?.nativeElement;
          if (childEl) {
            const cRect = childEl.getBoundingClientRect();
            const eX = cRect.left - wrapRect.left;
            const eY = cRect.top - wrapRect.top + cRect.height / 2;
            lines.push({
              path: `M ${sX} ${sY} C ${sX + (eX - sX) / 2} ${sY}, ${sX + (eX - sX) / 2} ${eY}, ${eX} ${eY}`,
              active: activeIds[colIdx + 1] === childId,
            });
          }
        });
      }
    });
    this.connections.set(lines);
  }
}
