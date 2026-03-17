import { Component, signal, computed, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { IMAGES, TABLES } from '../test/data';

export interface AssetItem {
  id: string;
  name: string;
  type: 'image' | 'table';
  selected: boolean;
  data: any;
}

@Component({
  selector: 'app-available-assets',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  template: `
    <div class="available-assets-container">
      <div class="assets-header">
        <h3>Available Assets</h3>
        <span class="selected-count" *ngIf="selectedCount() > 0">
          {{ selectedCount() }} selected
        </span>
      </div>

      <div class="assets-content">
        <!-- Images Section - 50% -->
        <div class="assets-section">
          <div class="section-header">
            <span class="section-icon">🖼️</span>
            <span class="section-title">Images</span>
            <span class="section-count">({{ imageItems().length }})</span>
            <button
              class="section-select-btn"
              (click)="toggleSelectAllImages()"
              [title]="allImagesSelected() ? 'Deselect All Images' : 'Select All Images'"
            >
              {{ allImagesSelected() ? '☑' : '☐' }}
            </button>
          </div>

          <div
            class="items-list"
            cdkDropList
            [cdkDropListData]="{ type: 'images', parentId: 'AVAILABLE_IMAGES' }"
            [cdkDropListConnectedTo]="connectedDropLists"
            (cdkDropListDropped)="onDrop($event)"
          >
            @for (item of imageItems(); track item.id) {
              <div
                class="asset-item"
                cdkDrag
                [cdkDragData]="item.data"
                [class.selected]="item.selected"
                (cdkDragStarted)="onDragStart(item)"
                (cdkDragEnded)="onDragEnd()"
              >
                <div
                  class="drag-handle"
                  cdkDragHandle
                  title="Drag to reorder or drop into assembly"
                >
                  <span class="grip-icon">⋮⋮</span>
                </div>

                <label class="checkbox-wrapper" (click)="$event.stopPropagation()">
                  <input
                    type="checkbox"
                    [checked]="item.selected"
                    (change)="toggleItemSelection(item)"
                  />
                  <span class="checkmark"></span>
                </label>

                <div class="item-info" (click)="toggleItemSelection(item)">
                  <span class="item-icon">🖼️</span>
                  <span class="item-name" [title]="item.name">{{ item.name }}</span>
                </div>

                <div class="drag-placeholder" *cdkDragPlaceholder></div>
              </div>
            }

            @if (imageItems().length === 0) {
              <div class="empty-state">No images available</div>
            }
          </div>
        </div>

        <!-- Tables Section - 50% -->
        <div class="assets-section">
          <div class="section-header">
            <span class="section-icon">📊</span>
            <span class="section-title">Tables</span>
            <span class="section-count">({{ tableItems().length }})</span>
            <button
              class="section-select-btn"
              (click)="toggleSelectAllTables()"
              [title]="allTablesSelected() ? 'Deselect All Tables' : 'Select All Tables'"
            >
              {{ allTablesSelected() ? '☑' : '☐' }}
            </button>
          </div>

          <div
            class="items-list"
            cdkDropList
            [cdkDropListData]="{ type: 'tables', parentId: 'AVAILABLE_TABLES' }"
            [cdkDropListConnectedTo]="connectedDropLists"
            (cdkDropListDropped)="onDrop($event)"
          >
            @for (item of tableItems(); track item.id) {
              <div
                class="asset-item"
                cdkDrag
                [cdkDragData]="item.data"
                [class.selected]="item.selected"
                (cdkDragStarted)="onDragStart(item)"
                (cdkDragEnded)="onDragEnd()"
              >
                <div
                  class="drag-handle"
                  cdkDragHandle
                  title="Drag to reorder or drop into assembly"
                >
                  <span class="grip-icon">⋮⋮</span>
                </div>

                <label class="checkbox-wrapper" (click)="$event.stopPropagation()">
                  <input
                    type="checkbox"
                    [checked]="item.selected"
                    (change)="toggleItemSelection(item)"
                  />
                  <span class="checkmark"></span>
                </label>

                <div class="item-info" (click)="toggleItemSelection(item)">
                  <span class="item-icon">📊</span>
                  <span class="item-name" [title]="item.name">{{ item.name }}</span>
                </div>

                <div class="drag-placeholder" *cdkDragPlaceholder></div>
              </div>
            }

            @if (tableItems().length === 0) {
              <div class="empty-state">No tables available</div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .available-assets-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #fff;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        overflow: hidden;
        font-family: 'Inter', system-ui, sans-serif;
      }

      .assets-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #f8f9fa;
        border-bottom: 1px solid #dee2e6;
      }

      .assets-header h3 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #343a40;
      }

      .selected-count {
        font-size: 0.75rem;
        color: #495057;
        background: #e9ecef;
        padding: 4px 8px;
        border-radius: 12px;
      }

      .assets-content {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
      }

      .assets-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        border-bottom: 1px solid #dee2e6;
      }

      .assets-section:last-child {
        border-bottom: none;
      }

      .section-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 12px;
        background: #f1f3f5;
        border-bottom: 1px solid #dee2e6;
        font-size: 0.8rem;
        font-weight: 600;
        color: #495057;
      }

      .section-icon {
        font-size: 1rem;
      }

      .section-title {
        flex: 1;
      }

      .section-count {
        font-weight: 400;
        color: #868e96;
      }

      .section-select-btn {
        background: transparent;
        border: none;
        font-size: 1rem;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 4px;
        transition: background 0.2s;
      }

      .section-select-btn:hover {
        background: #e9ecef;
      }

      .items-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
        min-height: 200px;
      }

      .asset-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: white;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        margin-bottom: 6px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .asset-item:hover {
        border-color: #228be6;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      }

      .asset-item.selected {
        background: #e7f5ff;
        border-color: #228be6;
      }

      .asset-item.cdk-drag-preview {
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
        opacity: 0.95;
      }

      .drag-placeholder {
        background: #e7f5ff;
        border: 2px dashed #228be6;
        border-radius: 6px;
        min-height: 40px;
      }

      .cdk-drag-animating {
        transition: transform 200ms ease;
      }

      .items-list.cdk-drop-list-dragging .asset-item:not(.cdk-drag-placeholder) {
        transition: transform 200ms ease;
      }

      .drag-handle {
        cursor: grab;
        padding: 4px;
        color: #adb5bd;
        transition: color 0.2s;
      }

      .drag-handle:hover {
        color: #495057;
      }

      .drag-handle:active {
        cursor: grabbing;
      }

      .grip-icon {
        font-size: 0.9rem;
        font-weight: bold;
        letter-spacing: -2px;
      }

      .checkbox-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        cursor: pointer;
      }

      .checkbox-wrapper input {
        position: absolute;
        opacity: 0;
        cursor: pointer;
        height: 0;
        width: 0;
      }

      .checkmark {
        height: 18px;
        width: 18px;
        background-color: white;
        border: 2px solid #dee2e6;
        border-radius: 4px;
        transition: all 0.2s;
      }

      .checkbox-wrapper:hover .checkmark {
        border-color: #228be6;
      }

      .checkbox-wrapper input:checked ~ .checkmark {
        background-color: #228be6;
        border-color: #228be6;
      }

      .checkmark:after {
        content: '';
        position: absolute;
        display: none;
      }

      .checkbox-wrapper input:checked ~ .checkmark:after {
        display: block;
        left: 6px;
        top: 2px;
        width: 5px;
        height: 10px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
      }

      .item-info {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
      }

      .item-icon {
        font-size: 1rem;
        flex-shrink: 0;
      }

      .item-name {
        font-size: 0.8rem;
        color: #495057;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .empty-state {
        padding: 20px;
        text-align: center;
        color: #868e96;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class AvailableAssetsComponent {
  @Input() connectedDropLists: string[] = [];
  @Output() onAssetDrop = new EventEmitter<any>();

  private images = signal<AssetItem[]>([]);
  private tables = signal<AssetItem[]>([]);

  isDragging = signal(false);
  draggedItem = signal<AssetItem | null>(null);

  constructor() {
    this.initializeAssets();
  }

  private initializeAssets() {
    const imageItems: AssetItem[] = IMAGES.map((img) => ({
      id: img.extractedImgId,
      name: img.drawingName,
      type: 'image' as const,
      selected: false,
      data: img,
    }));

    const tableItems: AssetItem[] = TABLES.map((tbl) => ({
      id: tbl.pageId,
      name: tbl.pageName,
      type: 'table' as const,
      selected: false,
      data: tbl,
    }));

    this.images.set(imageItems);
    this.tables.set(tableItems);
  }

  imageItems = computed(() => this.images());
  tableItems = computed(() => this.tables());

  allImagesSelected = computed(() => {
    const imgs = this.images();
    return imgs.length > 0 && imgs.every((i) => i.selected);
  });

  allTablesSelected = computed(() => {
    const tbls = this.tables();
    return tbls.length > 0 && tbls.every((t) => t.selected);
  });

  selectedCount = computed(() => {
    return (
      this.images().filter((i) => i.selected).length +
      this.tables().filter((t) => t.selected).length
    );
  });

  toggleItemSelection(item: AssetItem) {
    if (item.type === 'image') {
      const updated = this.images().map((i) =>
        i.id === item.id ? { ...i, selected: !i.selected } : i,
      );
      this.images.set(updated);
    } else {
      const updated = this.tables().map((t) =>
        t.id === item.id ? { ...t, selected: !t.selected } : t,
      );
      this.tables.set(updated);
    }
  }

  toggleSelectAllImages() {
    const newState = !this.allImagesSelected();
    this.images.set(this.images().map((i) => ({ ...i, selected: newState })));
  }

  toggleSelectAllTables() {
    const newState = !this.allTablesSelected();
    this.tables.set(this.tables().map((t) => ({ ...t, selected: newState })));
  }

  onDragStart(item: AssetItem) {
    this.isDragging.set(true);
    this.draggedItem.set(item);
  }

  onDragEnd() {
    this.isDragging.set(false);
    this.draggedItem.set(null);
  }

  onDrop(event: CdkDragDrop<any>) {
    this.onAssetDrop.emit({
      item: event.item.data,
      previousContainer: event.previousContainer.data,
      container: event.container.data,
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
    });
  }

  // Method to remove an asset from the available list (called when dropped into assembly)
  removeAsset(id: string, type: 'image' | 'table') {
    if (type === 'image') {
      this.images.set(this.images().filter((i) => i.id !== id));
    } else {
      this.tables.set(this.tables().filter((t) => t.id !== id));
    }
  }

  // Method to add an asset back to the available list
  addAsset(item: any, type: 'image' | 'table') {
    if (type === 'image') {
      const exists = this.images().find((i) => i.id === item.extractedImgId);
      if (!exists) {
        this.images.set([
          ...this.images(),
          {
            id: item.extractedImgId,
            name: item.drawingName,
            type: 'image',
            selected: false,
            data: item,
          },
        ]);
      }
    } else {
      const exists = this.tables().find((t) => t.id === item.id);
      if (!exists) {
        this.tables.set([
          ...this.tables(),
          {
            id: item.id,
            name: item.tableName,
            type: 'table',
            selected: false,
            data: item,
          },
        ]);
      }
    }
  }
}
