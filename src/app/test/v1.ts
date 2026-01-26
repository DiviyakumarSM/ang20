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
import { DATA, IMAGES, TABLES } from './data';

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

      <!-- Available Assets Column -->
      <div class="column-container">
        <div class="column-header">Available Assets</div>

        <!-- Images Section -->
        <div class="section-header">Images</div>
        <div
          cdkDropList
          class="drop-list"
          [cdkDropListData]="{ parentId: 'IMAGES', index: -1 }"
          [cdkDropListEnterPredicate]="canEnterAssets"
          (cdkDropListDropped)="onDropAssets($event)"
        >
          @for (item of availableImages(); track item.extractedImgId) {
            <div
              cdkDrag
              [cdkDragData]="item"
              [attr.data-id]="item.extractedImgId"
              [attr.data-type]="'image'"
              [title]="item.drawingName"
              (cdkDragStarted)="isDragging.set(true)"
              (cdkDragEnded)="isDragging.set(false); invalidHoverId.set(null); clearInvalidReason()"
              class="draggable-item"
              [class.invalid-drop]="invalidHoverId() === item.extractedImgId"
            >
              <div class="item-content">
                <span class="item-text">🖼️ {{ item.drawingName }}</span>
              </div>
            </div>
          }
        </div>

        <!-- Tables Section -->
        <div class="section-header">Tables</div>
        <div
          cdkDropList
          class="drop-list"
          [cdkDropListData]="{ parentId: 'TABLES', index: -1 }"
          [cdkDropListEnterPredicate]="canEnterAssets"
          (cdkDropListDropped)="onDropAssets($event)"
        >
          @for (item of availableTables(); track item.id) {
            <div
              cdkDrag
              [cdkDragData]="item"
              [attr.data-id]="item.id"
              [attr.data-type]="'table'"
              [title]="item.tableName"
              (cdkDragStarted)="isDragging.set(true)"
              (cdkDragEnded)="isDragging.set(false); invalidHoverId.set(null); clearInvalidReason()"
              class="draggable-item"
              [class.invalid-drop]="invalidHoverId() === item.id"
            >
              <div class="item-content">
                <span class="item-text">📊 {{ item.tableName }}</span>
              </div>
            </div>
          }
        </div>
      </div>

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
                [attr.data-type]="
                  item.assemblyName ? 'folder' : item.extractedImgId ? 'image' : 'table'
                "
                [title]="item.assemblyName || item.drawingName || item.tableName"
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
                    <span class="item-text">📂 {{ item.assemblyName }}</span>
                  } @else if (item.extractedImgId) {
                    <span class="item-text">🖼️ {{ item.drawingName }}</span>
                  } @else if (item.tableName) {
                    <div class="table-item-wrapper">
                      <div class="table-title">
                        <span>📊 {{ item.tableName }}</span>
                        @if (hasValidationError(item, i)) {
                          <span class="error-badge" [title]="getValidationError(item, i)">⚠️</span>
                        }
                      </div>

                      @if (item.tableData && item.tableData.length > 0) {
                        <table class="data-table">
                          <thead>
                            <tr>
                              @for (header of item.tableData[0]; track $index) {
                                <th [title]="header">{{ header }}</th>
                              }
                            </tr>
                          </thead>
                          <tbody>
                            @for (row of item.tableData.slice(1, 5); track $index) {
                              <tr class="data-row">
                                @for (cell of row; track $index) {
                                  <td [title]="cell">{{ cell }}</td>
                                }
                              </tr>
                            }
                          </tbody>
                        </table>
                      }
                    </div>
                  }

                  @if (!item.tableName && hasValidationError(item, i)) {
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

            <!-- Add plus icon at bottom of each level -->
            <div class="add-icon-container">
              <button class="plus-icon-btn">
                <span>+</span>
              </button>
              <div class="add-menu">
                @if (i === 0) {
                  <button
                    (click)="addAssembly(null, i); $event.stopPropagation()"
                    class="menu-item"
                  >
                    Add Assembly
                  </button>
                  <button
                    (click)="addSubAssembly(null, i); $event.stopPropagation()"
                    class="menu-item"
                  >
                    Add Sub Assembly
                  </button>
                } @else {
                  <button
                    (click)="addSubAssembly(selectedIds()[i - 1], i); $event.stopPropagation()"
                    class="menu-item"
                  >
                    Add Sub Assembly
                  </button>
                }
              </div>
            </div>
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
        padding: 10px 8px;
        text-align: center;
        font-weight: 700;
        background: #fff;
        border: 1px solid #dee2e6;
        border-bottom: 2px solid #228be6;
        border-radius: 8px 8px 0 0;
        color: #495057;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .section-header {
        padding: 6px 8px;
        font-weight: 600;
        font-size: 0.75rem;
        color: #495057;
        background: #e7f5ff;
        border-radius: 4px;
        margin-top: 8px;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .drop-list {
        padding: 8px;
        min-height: 200px;
        background: rgba(255, 255, 255, 0.5);
        border: 1px solid #dee2e6;
        border-top: none;
        border-radius: 0 0 8px 8px;
        position: relative;
      }
      .draggable-item {
        padding: 8px;
        margin-bottom: 8px;
        background: white;
        border-radius: 6px;
        border: 1px solid #e9ecef;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
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
        align-items: flex-start;
        gap: 6px;
        overflow: hidden;
        width: 100%;
      }
      .item-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
        max-width: 100%;
        font-size: 0.85rem;
      }
      .error-badge {
        font-size: 1rem;
        cursor: help;
      }
      .table-item-wrapper {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .table-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        font-size: 0.8rem;
        color: #343a40;
      }
      .table-title span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.65rem;
        background: #f8f9fa;
        border-radius: 4px;
        overflow: hidden;
        table-layout: fixed;
      }
      .data-table thead tr {
        background: #e9ecef;
      }
      .data-table th {
        padding: 3px 4px;
        text-align: left;
        font-weight: 600;
        color: #495057;
        border-bottom: 1px solid #dee2e6;
        font-size: 0.6rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .data-table td {
        padding: 2px 4px;
        border-bottom: 1px solid #e9ecef;
        color: #6c757d;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 80px;
      }
      .data-table tbody tr.data-row {
        font-size: 0.6rem;
      }
      .data-table tbody tr:last-child td {
        border-bottom: none;
      }
      .data-table tbody tr:hover {
        background: #fff;
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

      .add-icon-container {
        position: relative;
        display: flex;
        justify-content: center;
        padding: 8px 0;
        margin-top: 8px;
      }

      .plus-icon-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 2px dashed #228be6;
        background: white;
        color: #228be6;
        font-size: 1.2rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }

      .plus-icon-btn:hover {
        background: #228be6;
        color: white;
        border-style: solid;
        transform: scale(1.1);
      }

      .add-menu {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 4px;
        margin-bottom: 8px;
        opacity: 0;
        visibility: hidden;
        transition: all 0.2s ease;
        z-index: 100;
        min-width: 150px;
      }

      .add-icon-container:hover .add-menu {
        opacity: 1;
        visibility: visible;
      }

      .menu-item {
        display: block;
        width: 100%;
        padding: 8px 12px;
        border: none;
        background: white;
        color: #495057;
        text-align: left;
        cursor: pointer;
        font-size: 0.85rem;
        border-radius: 4px;
        transition: background 0.15s ease;
      }

      .menu-item:hover {
        background: #e7f5ff;
        color: #228be6;
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
  availableImages = signal<any[]>([...IMAGES]);
  availableTables = signal<any[]>([...TABLES]);

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

    // Add scroll listener to recalculate arrows on scroll
    effect((onCleanup) => {
      const handleScroll = () => {
        this.calculateArrows();
      };

      // Wait for the wrapper to be available
      setTimeout(() => {
        const wrapper = document.querySelector('.driller-wrapper');
        if (wrapper) {
          wrapper.addEventListener('scroll', handleScroll);
          onCleanup(() => {
            wrapper.removeEventListener('scroll', handleScroll);
          });
        }
      }, 100);
    });
  }

  /* ================= DROP VALIDATION ================= */

  canEnterAssets = (drag: CdkDrag, drop: CdkDropList): boolean => {
    // Items can always return to the assets column
    return true;
  };

  onDropAssets(event: CdkDragDrop<any>) {
    this.isDragging.set(false);
    this.invalidHoverId.set(null);
    this.clearInvalidReason();

    const item = event.item.data;
    const itemId = item.extractedImgId || item.id;
    const source = event.previousContainer.data;
    const target = event.container.data;
    const isImage = !!item.extractedImgId;

    // If dragging within same assets section (reorder)
    if (source.parentId === target.parentId && (source.parentId === 'IMAGES' || source.parentId === 'TABLES')) {
      if (isImage) {
        moveItemInArray(this.availableImages(), event.previousIndex, event.currentIndex);
      } else {
        moveItemInArray(this.availableTables(), event.previousIndex, event.currentIndex);
      }
      return;
    }

    // Remove from the node
    if (source.parentId && source.parentId !== 'IMAGES' && source.parentId !== 'TABLES') {
      this.removeFromModel(source.parentId, itemId, item);
      this.emitChange(source.parentId, 'REMOVE_TO_ASSETS');
    }

    // Add back to available assets if not already there
    if (isImage) {
      const images = this.availableImages();
      const exists = images.find((img: any) => img.extractedImgId === itemId);
      if (!exists) {
        images.splice(event.currentIndex, 0, item);
        this.availableImages.set([...images]);
      }
    } else {
      const tables = this.availableTables();
      const exists = tables.find((tbl: any) => tbl.id === itemId);
      if (!exists) {
        tables.splice(event.currentIndex, 0, item);
        this.availableTables.set([...tables]);
      }
    }

    this.refreshView();
  }

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
      // Reorder within same column
      const orderArray = target.parentId
        ? this.rawFileData.nodes[target.parentId].itemOrder
        : this.rawFileData.rootIds;

      const sortedOrder = this.sortItemsInOrder(orderArray, target.parentId);

      if (target.parentId) {
        this.rawFileData.nodes[target.parentId].itemOrder = sortedOrder;
      } else {
        this.rawFileData.rootIds = sortedOrder;
      }

      this.emitChange(target.parentId, 'REORDER');
    } else {
      // Check if dragging from assets column
      if (source.parentId === 'IMAGES' || source.parentId === 'TABLES') {
        // Remove from available assets
        if (source.parentId === 'IMAGES') {
          const images = this.availableImages();
          const imageIndex = images.findIndex((img: any) => img.extractedImgId === itemId);
          if (imageIndex !== -1) {
            images.splice(imageIndex, 1);
            this.availableImages.set([...images]);
          }
        } else {
          const tables = this.availableTables();
          const tableIndex = tables.findIndex((tbl: any) => tbl.id === itemId);
          if (tableIndex !== -1) {
            tables.splice(tableIndex, 1);
            this.availableTables.set([...tables]);
          }
        }

        // Add to target
        this.addToModel(target.parentId, itemId, item, event.currentIndex);
        this.emitChange(target.parentId, 'ADD_FROM_ASSETS');
      } else {
        // Transfer between columns (including moving up/down levels)
        this.removeFromModel(source.parentId, itemId, item);
        this.addToModel(target.parentId, itemId, item, event.currentIndex);

        // Update parent map for moved item and its children
        this.updateParentMapForMovedItem(itemId, target.parentId);

        // If the dropped item was in the active selection path, update selection
        this.updateSelectionAfterMove(itemId, source.index, target.index);

        this.emitChange(source.parentId, 'TRANSFER_OUT');
        this.emitChange(target.parentId, 'TRANSFER_IN');
      }
    }

    this.refreshView();

    // Force immediate arrow recalculation - use multiple timeouts for reliability
    requestAnimationFrame(() => {
      this.calculateArrows();
      setTimeout(() => this.calculateArrows(), 50);
      setTimeout(() => this.calculateArrows(), 150);
    });
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
      if (n.images)
        n.images.forEach((i: any) => this.parentMap.set(i.extractedImgId, n.assemblyId));
      if (n.tables) n.tables.forEach((t: any) => this.parentMap.set(t.id, n.assemblyId));
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

      // Only process if it's a folder node (not an image or table)
      if (!node || !node.assemblyId) return;

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

    // If selecting a root node (colIdx === 0), auto-expand all first children
    if (colIdx === 0 && item.assemblyId) {
      this.expandFirstChildren(sel, item);
    }

    this.selectedIds.set(sel);
    this.refreshView();
  }

  private expandFirstChildren(sel: string[], currentItem: any) {
    let current = currentItem;
    let level = 0;

    while (current && current.assemblyId) {
      const node = this.rawFileData.nodes[current.assemblyId];
      if (!node || !node.itemOrder || node.itemOrder.length === 0) break;

      // Get the first child that is a folder (assembly)
      const firstChildId = node.itemOrder.find((id: string) => {
        return this.rawFileData.nodes[id]?.assemblyId;
      });

      if (!firstChildId) break;

      const firstChild = this.rawFileData.nodes[firstChildId];
      if (!firstChild) break;

      // Add to selection
      level++;
      sel[level] = firstChild.assemblyId;
      current = firstChild;
    }
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
      node.images = node.images.filter((i: any) => i.extractedImgId !== itemId);
      node.tables = node.tables.filter((t: any) => t.id !== itemId);
    } else {
      this.rawFileData.rootIds = this.rawFileData.rootIds.filter((id: string) => id !== itemId);
    }
  }

  private addToModel(parentId: string | null, itemId: string, item: any, index: number) {
    if (parentId) {
      const node = this.rawFileData.nodes[parentId];

      // Add to itemOrder
      node.itemOrder.splice(index, 0, itemId);

      // Add to appropriate array based on item type
      if (item.assemblyId) {
        node.childIds.push(itemId);
      } else if (item.extractedImgId) {
        node.images.push(item);
      } else if (item.id && item.tableName) {
        node.tables.push(item);
      }

      // Re-sort after adding
      node.itemOrder = this.sortItemsInOrder(node.itemOrder, parentId);
    } else {
      this.rawFileData.rootIds.splice(index, 0, itemId);
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

      const wrapElement = pEl.closest('.driller-wrapper') as HTMLElement;
      if (!wrapElement) return;

      const p = pEl.getBoundingClientRect();
      const wrap = wrapElement.getBoundingClientRect();

      // Account for scroll position
      const scrollLeft = wrapElement.scrollLeft;
      const scrollTop = wrapElement.scrollTop;

      const sx = p.right - wrap.left + scrollLeft;
      const sy = p.top - wrap.top + scrollTop + p.height / 2;

      next.forEach((c) => {
        const cid = c.assemblyId || c.extractedImgId || c.id;
        const cEl = els.find((e) => e.nativeElement.dataset.id === cid)?.nativeElement;
        if (!cEl) return;

        // Skip drawing arrows to tables
        const itemType = cEl.getAttribute('data-type');
        if (itemType === 'table') return;

        const r = cEl.getBoundingClientRect();
        const ex = r.left - wrap.left + scrollLeft;
        const ey = r.top - wrap.top + scrollTop + r.height / 2;

        lines.push({
          path: `M ${sx} ${sy} C ${sx + (ex - sx) / 2} ${sy}, ${sx + (ex - sx) / 2} ${ey}, ${ex} ${ey}`,
          active: active[i + 1] === cid,
          invalid: dragging && this.invalidHoverId() === cid,
        });
      });
    });

    this.connections.set(lines);
  }

  /* ================= SELECTION & PARENT UPDATE ================= */

  private updateParentMapForMovedItem(itemId: string, newParentId: string | null) {
    // Update the parent map for the moved item
    this.parentMap.set(itemId, newParentId);

    // If the moved item is a folder, recursively update all descendants
    const node = this.rawFileData.nodes[itemId];
    if (node && node.assemblyId) {
      this.updateDescendantParents(node);
    }
  }

  private updateDescendantParents(node: any) {
    if (!node || !node.assemblyId) return;

    // Update parent map for all direct children
    if (node.childIds) {
      node.childIds.forEach((childId: string) => {
        this.parentMap.set(childId, node.assemblyId);
        const childNode = this.rawFileData.nodes[childId];
        if (childNode) {
          this.updateDescendantParents(childNode);
        }
      });
    }

    // Update parent map for images and tables
    if (node.images) {
      node.images.forEach((img: any) => {
        this.parentMap.set(img.extractedImgId, node.assemblyId);
      });
    }

    if (node.tables) {
      node.tables.forEach((table: any) => {
        this.parentMap.set(table.id, node.assemblyId);
      });
    }
  }

  private updateSelectionAfterMove(movedItemId: string, sourceColIndex: number, targetColIndex: number) {
    const currentSelection = this.selectedIds();
    const movedItemIndex = currentSelection.indexOf(movedItemId);

    // If the moved item is in the active selection path
    if (movedItemIndex !== -1) {
      // Truncate selection at the point where the item was
      const newSelection = currentSelection.slice(0, movedItemIndex);

      // If moving to a higher level (earlier column), adjust selection
      if (targetColIndex < sourceColIndex) {
        // Add the moved item to its new position in the selection
        newSelection[targetColIndex] = movedItemId;
      }

      this.selectedIds.set(newSelection);
    }
  }

  private emitChange(nodeId: string | null, action: string) {
    this.onStructureChange.emit({
      nodeId: nodeId || 'ROOT',
      action,
      timestamp: new Date().toISOString(),
    });
  }

  /* ================= ADD ASSEMBLY/SUB-ASSEMBLY ================= */

  addAssembly(parentId: string | null, levelIndex: number) {
    const newId = `assembly-${Date.now()}`;
    const newAssembly = {
      assemblyId: newId,
      assemblyName: `New Assembly ${Date.now()}`,
      childIds: [],
      images: [],
      tables: [],
      itemOrder: [],
    };

    // Add to nodes
    this.rawFileData.nodes[newId] = newAssembly;

    // Add to root or parent
    if (!parentId) {
      this.rawFileData.rootIds.push(newId);
      this.rawFileData.rootIds = this.sortItemsInOrder(this.rawFileData.rootIds, null);
    } else {
      const parentNode = this.rawFileData.nodes[parentId];
      parentNode.childIds.push(newId);
      parentNode.itemOrder.push(newId);
      parentNode.itemOrder = this.sortItemsInOrder(parentNode.itemOrder, parentId);
    }

    this.buildParentMap();
    this.emitChange(parentId, 'ADD_ASSEMBLY');
    this.refreshView();

    // Recalculate arrows
    setTimeout(() => this.calculateArrows(), 100);
  }

  addSubAssembly(parentId: string | null, levelIndex: number) {
    // For now, same implementation as addAssembly
    // Can be customized later if sub-assemblies need different behavior
    this.addAssembly(parentId, levelIndex);
  }
}
