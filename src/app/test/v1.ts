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
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  CdkDrag,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import { v4 as uuidv4 } from 'uuid';
import { DATA, IMAGES, TABLES } from './data';

@Component({
  selector: 'app-assembly-v1-driller',
  standalone: true,
  imports: [CommonModule, DragDropModule, FormsModule],
  template: `
    <div class="driller-wrapper" cdkDropListGroup>
      <!-- Available Assets Column - Vertical 50-50 Layout -->
      <div class="available-assets-panel">
        <div class="assets-header">
          <h3>Available Assets</h3>
        </div>

        <div class="assets-content">
          <!-- Images Section - 50% -->
          <div class="assets-section">
            <div class="section-header">
              <span>Images</span>
              <span class="section-count">({{ availableImages().length }})</span>
            </div>
            <div
              cdkDropList
              class="assets-list"
              [cdkDropListData]="{ parentId: 'IMAGES', index: -1 }"
              [cdkDropListEnterPredicate]="canEnterAssets"
              (cdkDropListDropped)="onDropAssets($event)"
            >
              @for (item of availableImages(); track item.extractedImgId) {
                <div
                  cdkDrag
                  [cdkDragData]="item"
                  class="asset-item"
                  [attr.data-id]="item.extractedImgId"
                  [attr.data-type]="'image'"
                  [title]="item.drawingName"
                  (cdkDragStarted)="isDragging.set(true)"
                  (cdkDragEnded)="
                    isDragging.set(false); invalidHoverId.set(null); clearInvalidReason()
                  "
                >
                  <label class="checkbox-wrapper" (click)="$event.stopPropagation()">
                    <input type="checkbox" [(ngModel)]="item.selected" />
                  </label>
                  <span class="asset-name">{{ item.drawingName }}</span>
                  <span class="drag-handle">⋮⋮</span>
                </div>
              }
              @if (availableImages().length === 0) {
                <div class="empty-state">No images available</div>
              }
            </div>
          </div>

          <!-- Tables Section - 50% -->
          <div class="assets-section">
            <div class="section-header">
              <span>Tables</span>
              <span class="section-count">({{ availableTables().length }})</span>
            </div>
            <div
              cdkDropList
              class="assets-list"
              [cdkDropListData]="{ parentId: 'TABLES', index: -1 }"
              [cdkDropListEnterPredicate]="canEnterAssets"
              (cdkDropListDropped)="onDropAssets($event)"
            >
              @for (item of availableTables(); track item.id) {
                <div
                  cdkDrag
                  [cdkDragData]="item"
                  class="asset-item"
                  [attr.data-id]="item.id"
                  [attr.data-type]="'table'"
                  [title]="item.tableName"
                  (cdkDragStarted)="isDragging.set(true)"
                  (cdkDragEnded)="
                    isDragging.set(false); invalidHoverId.set(null); clearInvalidReason()
                  "
                >
                  <label class="checkbox-wrapper" (click)="$event.stopPropagation()">
                    <input type="checkbox" [(ngModel)]="item.selected" />
                  </label>
                  <span class="asset-name">{{ item.tableName }}</span>
                  <span class="drag-handle">⋮⋮</span>
                </div>
              }
              @if (availableTables().length === 0) {
                <div class="empty-state">No tables available</div>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Zoom Controls -->
      <div class="zoom-controls">
        <button
          class="zoom-btn"
          (click)="zoomOut()"
          [disabled]="zoomLevel() <= minZoom"
          title="Zoom Out"
        >
          −
        </button>
        <span class="zoom-label">{{ (zoomLevel() * 100).toFixed(0) }}%</span>
        <button
          class="zoom-btn"
          (click)="zoomIn()"
          [disabled]="zoomLevel() >= maxZoom"
          title="Zoom In"
        >
          +
        </button>
        <button class="zoom-btn" (click)="resetZoom()" title="Reset Zoom">⟲</button>
      </div>

      <!-- Levels Area Wrapper -->
      <div class="levels-area" #levelsAreaRef>
        <svg class="levels-connector-layer"
             [attr.width]="svgWidth()"
             [attr.height]="svgHeight()"
        >
          <defs>
            <marker
              id="arrow-grey-levels"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              [attr.markerWidth]="6 * zoomLevel()"
              [attr.markerHeight]="6 * zoomLevel()"
              orient="auto"
            >
              <path d="M 3 0 L 7 5 L 3 10" fill="none" stroke-width="2" stroke="#ced4da"></path>
            </marker>
            <marker
              id="arrow-green-levels"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              [attr.markerWidth]="6 * zoomLevel()"
              [attr.markerHeight]="6 * zoomLevel()"
              orient="auto"
            >
              <path d="M 3 0 L 7 5 L 3 10" fill="none" stroke-width="2" stroke="green"></path>
            </marker>
            <marker
              id="arrow-red-levels"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              [attr.markerWidth]="6 * zoomLevel()"
              [attr.markerHeight]="6 * zoomLevel()"
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
                [attr.stroke-width]="2 * zoomLevel()"
                fill="none"
                [attr.marker-end]="
                  line.invalid
                    ? 'url(#arrow-red-levels)'
                    : line.active
                      ? 'url(#arrow-green-levels)'
                      : 'url(#arrow-grey-levels)'
                "
              />
            }
          }
        </svg>

        <!-- Levels Section with Zoom -->
        <div class="levels-container" [style.transform]="'scale(' + zoomLevel() + ')'">
          @for (col of columns(); track $index; let i = $index) {
            <div class="column-container">
              <div class="column-header">
                <span class="level-number">{{ i + 1 }}</span>
              </div>

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
                    [class.complete-pair]="isInCompleteAssembly(item, i)"
                    (click)="selectItem(item, i)"
                  >
                    <div class="item-content">
                      @if (item.assemblyName) {
                        <span class="item-text" [title]="item.assemblyName">{{
                          item.assemblyName
                        }}</span>
                        <div class="action-buttons">
                          <button
                            class="edit-btn"
                            (click)="openEditPanel(item); $event.stopPropagation()"
                            title="Edit assembly"
                          >
                            ✏️
                          </button>
                          <button
                            class="delete-btn-assembly"
                            (click)="openDeleteConfirmation(item, i); $event.stopPropagation()"
                            title="Delete assembly"
                          >
                            🗑️
                          </button>
                        </div>
                        <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
                      } @else if (item.extractedImgId) {
                        <span class="item-text" [title]="item.drawingName"
                          >🖼️ {{ item.drawingName }}</span
                        >
                      } @else if (item.tableName) {
                        <div class="table-item-wrapper">
                          <div class="table-title">
                            <span>📊 {{ item.tableName }}</span>
                            @if (hasValidationError(item, i)) {
                              <span class="error-badge" [title]="getValidationError(item, i)"
                                >⚠️</span
                              >
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
        <!-- End Levels Container -->
      </div>
      <!-- End Levels Area -->

      <!-- Right Panel for Add/Edit Assembly -->
      @if (rightPanelOpen()) {
        <div class="right-panel-overlay" (click)="closeRightPanel()"></div>
        <div class="right-panel">
          <div class="panel-header">
            <h3>{{ rightPanelMode() === 'add' ? 'Add Assembly' : 'Edit Assembly' }}</h3>
            <button class="close-btn" (click)="closeRightPanel()">×</button>
          </div>

          <div class="panel-body">
            <div class="form-group">
              <label>Assembly Name</label>
              <input
                type="text"
                [(ngModel)]="assemblyForm.assemblyName"
                placeholder="Enter assembly name"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label>Class Code</label>
              <input
                type="text"
                [(ngModel)]="assemblyForm.classCode"
                placeholder="Enter class code"
                class="form-input"
              />
            </div>
          </div>

          <div class="panel-footer">
            <button class="btn-cancel" (click)="closeRightPanel()">Cancel</button>
            <button class="btn-submit" (click)="submitAssemblyForm()">
              {{ rightPanelMode() === 'add' ? 'Add' : 'Update' }}
            </button>
          </div>
        </div>
      }

      <!-- Delete Confirmation Dialog -->
      @if (deleteDialogOpen()) {
        <div class="dialog-overlay" (click)="closeDeleteDialog()"></div>
        <div class="delete-dialog">
          <div class="dialog-header">
            <h3>Delete Assembly</h3>
          </div>

          <div class="dialog-body">
            <p>
              Are you sure you want to delete
              <strong>{{ deleteTargetAssembly?.assemblyName }}</strong
              >?
            </p>
            <p class="warning-text">
              This will also delete all child assemblies, images, and tables. This action cannot be
              undone.
            </p>
          </div>

          <div class="dialog-footer">
            <button class="btn-cancel" (click)="closeDeleteDialog()">Cancel</button>
            <button class="btn-delete" (click)="confirmDeleteAssembly()">Delete</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }

      .driller-wrapper {
        display: flex;
        gap: 0;
        padding: 20px;
        height: 100%;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
        background: #f8f9fa;
        font-family: 'Inter', system-ui, sans-serif;
      }

      /* Available Assets Panel Styles */
      .available-assets-panel {
        flex: 0 0 280px;
        display: flex;
        flex-direction: column;
        background: #fff;
        border-radius: 8px;
        overflow: hidden;
        z-index: 10;
        height: 100%;
        max-height: calc(100% - 0px);
        margin-right: 20px;
      }

      .assets-header {
        padding: 12px 16px;
        background: #fff;
      }

      .assets-header h3 {
        margin: 0;
        font-size: 0.9rem;
        font-weight: 400;
        color: #868e96;
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
      }

      .assets-section:last-child {
        border-bottom: none;
      }

      .assets-section .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        margin: 0;
        background: #fff;
        font-weight: 400;
        color: #868e96;
        font-size: 0.8rem;
      }

      .section-count {
        font-weight: 400;
        color: #868e96;
        font-size: 0.7rem;
      }

      .assets-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
        min-height: 100px;
      }

      .asset-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: white;
        border-radius: 6px;
        margin-bottom: 4px;
        cursor: grab;
        transition: all 0.2s;
      }

      .asset-item:hover {
        background: #f8f9fa;
      }

      .asset-item:active {
        cursor: grabbing;
      }

      .asset-item .checkbox-wrapper {
        display: flex;
        align-items: center;
      }

      .asset-item .checkbox-wrapper input {
        width: 16px;
        height: 16px;
        cursor: pointer;
      }

      .asset-item .asset-name {
        flex: 1;
        font-size: 0.8rem;
        color: #495057;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .asset-item .drag-handle {
        color: #adb5bd;
        font-size: 0.9rem;
        flex-shrink: 0;
      }

      .empty-state {
        padding: 20px;
        text-align: center;
        color: #868e96;
        font-size: 0.8rem;
      }

      .asset-item.cdk-drag-preview {
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
        opacity: 0.95;
      }

      .assets-list.cdk-drop-list-dragging .asset-item:not(.cdk-drag-placeholder) {
        transition: transform 200ms ease;
      }
      /* Levels Area Wrapper */
      .levels-area {
        position: relative;
        flex: 1;
        overflow: auto;
        min-width: 0;
        min-height: 0;
        height: 100%;
      }

      .levels-connector-layer {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        z-index: 0;
        overflow: visible;
      }
      .column-container {
        flex: 0 0 250px;
        z-index: 1;
      }
      .column-header {
        padding: 12px 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .column-header .level-number {
        width: 28px;
        height: 28px;
        background: #4b71ff;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 0.85rem;
      }
      .section-header {
        padding: 6px 8px;
        font-weight: 600;
        font-size: 0.75rem;
        color: #495057;
        background: #e8edff;
        border-radius: 4px;
        margin-top: 8px;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .drop-list {
        padding: 8px;
        min-height: 200px;
        background: transparent;
        position: relative;
      }
      .draggable-item {
        padding: 8px 10px;
        margin-bottom: 8px;
        background: white;
        border-radius: 6px;
        border: 1px solid #e9ecef;
        cursor: pointer;
        display: flex;
        align-items: center;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
        transition: all 0.2s ease;
        min-width: 0;
        max-width: 250px;
        width: 100%;
        box-sizing: border-box;
      }
      .draggable-item:hover {
        border-color: #4b71ff;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
      }
      .draggable-item.active {
        border: 1px solid #4b71ff;
        background: #e8edff;
      }
      .draggable-item.error-item {
        border: 2px solid #ffa94d;
        background: #fff4e6;
      }
      .draggable-item.complete-pair {
        border: 1px solid #4b71ff;
      }
      .item-content {
        display: flex;
        align-items: center;
        gap: 6px;
        overflow: hidden;
        flex: 1;
        min-width: 0;
      }
      .item-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        min-width: 0;
        font-size: 0.85rem;
        color: #343a40;
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
        flex-shrink: 0;
        margin-left: 4px;
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
        border: 2px dashed #4b71ff;
        background: white;
        color: #4b71ff;
        font-size: 1.2rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }

      .plus-icon-btn:hover {
        background: #4b71ff;
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
        background: #e8edff;
        color: #4b71ff;
      }

      /* Drag Handle */
      .drag-handle {
        cursor: grab;
        color: #adb5bd;
        font-size: 1rem;
        user-select: none;
        flex-shrink: 0;
      }

      .draggable-item:active .drag-handle {
        cursor: grabbing;
      }

      /* Action Buttons Container */
      .action-buttons {
        display: flex;
        gap: 2px;
        flex-shrink: 0;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .draggable-item:hover .action-buttons {
        opacity: 1;
      }

      /* Edit Button */
      .edit-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
        padding: 2px 4px;
      }

      .edit-btn:hover {
        transform: scale(1.1);
      }

      /* Delete Button for Assembly */
      .delete-btn-assembly {
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
        padding: 2px 4px;
      }

      .delete-btn-assembly:hover {
        transform: scale(1.1);
      }

      /* Right Panel Overlay */
      .right-panel-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
      }

      /* Right Panel */
      .right-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 400px;
        height: 100%;
        background: white;
        box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
        z-index: 1001;
        display: flex;
        flex-direction: column;
        animation: slideIn 0.3s ease;
      }

      @keyframes slideIn {
        from {
          transform: translateX(100%);
        }
        to {
          transform: translateX(0);
        }
      }

      .panel-header {
        padding: 20px;
        border-bottom: 1px solid #dee2e6;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .panel-header h3 {
        margin: 0;
        font-size: 1.2rem;
        color: #343a40;
      }

      .close-btn {
        background: transparent;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #868e96;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }

      .close-btn:hover {
        background: #f1f3f5;
      }

      .panel-body {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
      }

      .form-group {
        margin-bottom: 20px;
      }

      .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
        color: #495057;
        font-size: 0.9rem;
      }

      .form-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        font-size: 0.9rem;
        transition: border-color 0.2s;
      }

      .form-input:focus {
        outline: none;
        border-color: #4b71ff;
      }

      .panel-footer {
        padding: 20px;
        border-top: 1px solid #dee2e6;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }

      .btn-cancel,
      .btn-submit {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-cancel {
        background: #f1f3f5;
        color: #495057;
      }

      .btn-cancel:hover {
        background: #e9ecef;
      }

      .btn-submit {
        background: #4b71ff;
        color: white;
      }

      .btn-submit:hover {
        background: #3a5fd9;
      }

      /* Delete Confirmation Dialog */
      .dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 2000;
      }

      .delete-dialog {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 450px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 2001;
        animation: dialogFadeIn 0.2s ease;
      }

      @keyframes dialogFadeIn {
        from {
          opacity: 0;
          transform: translate(-50%, -45%);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%);
        }
      }

      .dialog-header {
        padding: 20px;
        border-bottom: 1px solid #dee2e6;
      }

      .dialog-header h3 {
        margin: 0;
        font-size: 1.2rem;
        color: #343a40;
      }

      .dialog-body {
        padding: 20px;
      }

      .dialog-body p {
        margin: 0 0 12px 0;
        color: #495057;
        font-size: 0.95rem;
        line-height: 1.5;
      }

      .dialog-body strong {
        color: #343a40;
        font-weight: 600;
      }

      .warning-text {
        color: #fa5252 !important;
        font-size: 0.85rem !important;
        margin-top: 8px;
      }

      .dialog-footer {
        padding: 20px;
        border-top: 1px solid #dee2e6;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }

      .btn-delete {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
        background: #fa5252;
        color: white;
      }

      .btn-delete:hover {
        background: #e03131;
      }

      /* Zoom Controls */
      .zoom-controls {
        position: fixed;
        bottom: 30px;
        right: 30px;
        display: flex;
        align-items: center;
        gap: 8px;
        background: white;
        padding: 8px 12px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 100;
      }

      .zoom-btn {
        width: 32px;
        height: 32px;
        border: 1px solid #dee2e6;
        background: white;
        color: #495057;
        font-size: 1.2rem;
        font-weight: bold;
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .zoom-btn:hover:not(:disabled) {
        background: #4b71ff;
        color: white;
        border-color: #4b71ff;
      }

      .zoom-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .zoom-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: #495057;
        min-width: 45px;
        text-align: center;
      }

      /* Levels Container with Zoom */
      .levels-container {
        display: flex;
        gap: 3rem;
        transform-origin: left top;
        transition: transform 0.2s ease;
        min-width: max-content;
        min-height: max-content;
        padding: 0 20px 20px 0;
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

  // Right panel state
  rightPanelOpen = signal(false);
  rightPanelMode = signal<'add' | 'edit'>('add');
  editingAssemblyId = signal<string | null>(null);
  pendingParentId = signal<string | null>(null);

  // Form fields
  assemblyForm = {
    assemblyName: '',
    classCode: '',
  };

  // Delete confirmation dialog state
  deleteDialogOpen = signal(false);
  deleteTargetAssembly: any = null;
  deleteTargetLevel: number = 0;

  // Zoom state
  zoomLevel = signal(1);
  minZoom = 0.5;
  maxZoom = 2;
  zoomStep = 0.1;

  // SVG dimensions for connector layer
  svgWidth = signal(2000);
  svgHeight = signal(1000);
  svgScrollX = signal(0);
  svgScrollY = signal(0);

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

    // Add scroll listener to recalculate arrows on scroll with RAF throttling
    effect((onCleanup) => {
      let rafId: number | null = null;
      let isScrolling = false;

      const handleScroll = () => {
        if (!isScrolling) {
          isScrolling = true;
          rafId = requestAnimationFrame(() => {
            this.calculateArrows();
            isScrolling = false;
          });
        }
      };

      // Wait for the levels-area to be available
      setTimeout(() => {
        const levelsArea = document.querySelector('.levels-area');
        if (levelsArea) {
          levelsArea.addEventListener('scroll', handleScroll, { passive: true });
          onCleanup(() => {
            levelsArea.removeEventListener('scroll', handleScroll);
            if (rafId !== null) {
              cancelAnimationFrame(rafId);
            }
          });
        }
      }, 100);
    });

    // Recalculate arrows when zoom level changes
    effect((onCleanup) => {
      this.zoomLevel();
      const t = setTimeout(() => this.calculateArrows(), 100);
      onCleanup(() => clearTimeout(t));
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
    if (
      source.parentId === target.parentId &&
      (source.parentId === 'IMAGES' || source.parentId === 'TABLES')
    ) {
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
        // Copy behavior - keep item in available list, just add to target
        // Create a copy of the item to add to the assembly
        const itemCopy = { ...item };
        this.addToModel(target.parentId, itemId, itemCopy, event.currentIndex);
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

  hasImageAndTable(item: any): boolean {
    if (!item.assemblyId) return false;
    const node = this.rawFileData.nodes[item.assemblyId];
    if (!node) return false;
    const hasImages = node.images && node.images.length > 0;
    const hasTables = node.tables && node.tables.length > 0;
    return hasImages && hasTables;
  }

  isInCompleteAssembly(item: any, colIdx: number): boolean {
    // Check if this image or table is in an assembly that has both images and tables
    if (item.assemblyId) return false; // This is a folder, not an image/table

    // Get the parent assembly ID from selection
    const parentId = this.selectedIds()[colIdx - 1];
    if (!parentId) return false;

    const parentNode = this.rawFileData.nodes[parentId];
    if (!parentNode) return false;

    const hasImages = parentNode.images && parentNode.images.length > 0;
    const hasTables = parentNode.tables && parentNode.tables.length > 0;
    return hasImages && hasTables;
  }

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

      // Always push the column for selected assemblies, even if empty
      // This allows users to drag-drop or create items in empty assemblies
      cols.push(col);
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

  updateSvgDimensions() {
    const levelsArea = document.querySelector('.levels-area') as HTMLElement;
    if (levelsArea) {
      this.svgWidth.set(Math.max(levelsArea.scrollWidth, levelsArea.clientWidth));
      this.svgHeight.set(Math.max(levelsArea.scrollHeight, levelsArea.clientHeight));
    }
  }

  calculateArrows() {
    const lines: any[] = [];
    const els = this.itemRefs();
    const active = this.selectedIds();
    const dragging = this.isDragging();
    const zoom = this.zoomLevel();
    const baseRadius = 12; // Base corner radius for the L-bend

    const levelsArea = document.querySelector('.levels-area') as HTMLElement;
    if (!levelsArea) return;

    // Get the levels-container for accurate position calculations
    const levelsContainer = levelsArea.querySelector('.levels-container') as HTMLElement;
    if (!levelsContainer) return;

    const areaRect = levelsArea.getBoundingClientRect();

    // Store scroll position for SVG transform
    const scrollLeft = levelsArea.scrollLeft;
    const scrollTop = levelsArea.scrollTop;
    this.svgScrollX.set(scrollLeft);
    this.svgScrollY.set(scrollTop);

    // SVG should cover the full scaled content area plus scroll offset
    const scaledWidth = levelsContainer.scrollWidth * zoom + scrollLeft;
    const scaledHeight = levelsContainer.scrollHeight * zoom + scrollTop;
    this.svgWidth.set(Math.max(scaledWidth, areaRect.width + scrollLeft));
    this.svgHeight.set(Math.max(scaledHeight, areaRect.height + scrollTop));

    active.forEach((pid, i) => {
      const pEl = els.find((e) => e.nativeElement.dataset.id === pid)?.nativeElement;
      const next = this.columns()[i + 1];
      if (!pEl || !next) return;

      const p = pEl.getBoundingClientRect();

      // Calculate position relative to levels-area viewport, then add scroll for content position
      // The SVG transform will offset back, so arrows stay aligned with scrolled content
      const sx = p.right - areaRect.left + scrollLeft;
      const sy = p.top - areaRect.top + scrollTop + p.height / 2;

      next.forEach((c) => {
        const cid = c.assemblyId || c.extractedImgId || c.id;
        const cEl = els.find((e) => e.nativeElement.dataset.id === cid)?.nativeElement;
        if (!cEl) return;

        // Skip drawing arrows to tables
        const itemType = cEl.getAttribute('data-type');
        if (itemType === 'table') return;

        // Check if pointing to an image
        const isImage = itemType === 'image';

        const r = cEl.getBoundingClientRect();
        const ex = r.left - areaRect.left + scrollLeft;
        const ey = r.top - areaRect.top + scrollTop + r.height / 2;

        // Create curvy L-bend path - use unscaled radius since positions are already scaled
        const midX = sx + (ex - sx) / 2;
        const dy = ey - sy;
        const dir = dy > 0 ? 1 : -1; // Direction: 1 = down, -1 = up
        const absdy = Math.abs(dy);
        const r1 = Math.min(baseRadius, absdy / 2, (ex - sx) / 4);

        let path: string;
        if (absdy < 2) {
          // Nearly horizontal - just draw a straight line
          path = `M ${sx} ${sy} L ${ex} ${ey}`;
        } else {
          // Curvy L-bend: horizontal -> curve -> vertical -> curve -> horizontal
          path = `M ${sx} ${sy}
                  L ${midX - r1} ${sy}
                  Q ${midX} ${sy} ${midX} ${sy + dir * r1}
                  L ${midX} ${ey - dir * r1}
                  Q ${midX} ${ey} ${midX + r1} ${ey}
                  L ${ex} ${ey}`;
        }

        lines.push({
          path,
          active: active[i + 1] === cid || isImage, // Green for selected or images
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

  private updateSelectionAfterMove(
    movedItemId: string,
    sourceColIndex: number,
    targetColIndex: number,
  ) {
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

  /* ================= RIGHT PANEL MANAGEMENT ================= */

  openAddPanel(parentId: string | null, levelIndex: number) {
    this.rightPanelMode.set('add');
    this.pendingParentId.set(parentId);
    this.editingAssemblyId.set(null);

    // Reset form
    this.assemblyForm = {
      assemblyName: '',
      classCode: '',
    };

    this.rightPanelOpen.set(true);
  }

  openEditPanel(assembly: any) {
    this.rightPanelMode.set('edit');
    this.editingAssemblyId.set(assembly.assemblyId);
    this.pendingParentId.set(null);

    // Populate form with existing data
    this.assemblyForm = {
      assemblyName: assembly.assemblyName || '',
      classCode: assembly.classCode || '',
    };

    this.rightPanelOpen.set(true);
  }

  closeRightPanel() {
    this.rightPanelOpen.set(false);
    this.assemblyForm = {
      assemblyName: '',
      classCode: '',
    };
  }

  submitAssemblyForm() {
    // Validation
    if (!this.assemblyForm.assemblyName.trim()) {
      alert('Assembly name is required');
      return;
    }

    if (this.rightPanelMode() === 'add') {
      this.createNewAssembly();
    } else {
      this.updateExistingAssembly();
    }

    this.closeRightPanel();
  }

  /* ================= ADD/UPDATE ASSEMBLY ================= */

  createNewAssembly() {
    const newId = uuidv4();
    const parentId = this.pendingParentId();

    const newAssembly = {
      assemblyId: newId,
      assemblyName: this.assemblyForm.assemblyName,
      classCode: this.assemblyForm.classCode,
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
    setTimeout(() => this.calculateArrows(), 100);
  }

  updateExistingAssembly() {
    const assemblyId = this.editingAssemblyId();
    if (!assemblyId) return;

    const assembly = this.rawFileData.nodes[assemblyId];
    if (!assembly) return;

    // Update assembly properties
    assembly.assemblyName = this.assemblyForm.assemblyName;
    assembly.classCode = this.assemblyForm.classCode;

    this.emitChange(assemblyId, 'UPDATE_ASSEMBLY');
    this.refreshView();
  }

  // Update existing addAssembly method to use right panel
  addAssembly(parentId: string | null, levelIndex: number) {
    this.openAddPanel(parentId, levelIndex);
  }

  addSubAssembly(parentId: string | null, levelIndex: number) {
    this.openAddPanel(parentId, levelIndex);
  }

  /* ================= DELETE ASSEMBLY ================= */

  openDeleteConfirmation(assembly: any, levelIndex: number) {
    this.deleteTargetAssembly = assembly;
    this.deleteTargetLevel = levelIndex;
    this.deleteDialogOpen.set(true);
  }

  closeDeleteDialog() {
    this.deleteDialogOpen.set(false);
    this.deleteTargetAssembly = null;
    this.deleteTargetLevel = 0;
  }

  confirmDeleteAssembly() {
    if (!this.deleteTargetAssembly) return;

    const assemblyId = this.deleteTargetAssembly.assemblyId;
    const levelIndex = this.deleteTargetLevel;

    // Determine parent ID
    const parentId = levelIndex === 0 ? null : this.selectedIds()[levelIndex - 1];

    // Remove from parent or root
    if (!parentId) {
      // Remove from root
      this.rawFileData.rootIds = this.rawFileData.rootIds.filter((id: string) => id !== assemblyId);
    } else {
      // Remove from parent
      const parentNode = this.rawFileData.nodes[parentId];
      if (parentNode) {
        parentNode.childIds = parentNode.childIds.filter((id: string) => id !== assemblyId);
        parentNode.itemOrder = parentNode.itemOrder.filter((id: string) => id !== assemblyId);
      }
    }

    // Recursively delete the assembly and all its descendants
    this.recursiveDeleteAssembly(assemblyId);

    // Update selection if the deleted assembly was in the selection path
    const currentSelection = this.selectedIds();
    const deletedIndex = currentSelection.indexOf(assemblyId);
    if (deletedIndex !== -1) {
      // Truncate selection at the deleted item
      this.selectedIds.set(currentSelection.slice(0, deletedIndex));
    }

    this.buildParentMap();
    this.emitChange(parentId, 'DELETE_ASSEMBLY');
    this.refreshView();
    this.closeDeleteDialog();

    // Recalculate arrows
    setTimeout(() => this.calculateArrows(), 100);
  }

  private recursiveDeleteAssembly(assemblyId: string) {
    const node = this.rawFileData.nodes[assemblyId];
    if (!node) return;

    // Recursively delete all child assemblies
    if (node.childIds && node.childIds.length > 0) {
      node.childIds.forEach((childId: string) => {
        this.recursiveDeleteAssembly(childId);
      });
    }

    // Delete the node itself
    delete this.rawFileData.nodes[assemblyId];

    // Remove from parent map
    this.parentMap.delete(assemblyId);

    // Remove validation errors for images and tables
    if (node.images) {
      node.images.forEach((img: any) => {
        this.validationErrors.delete(img.extractedImgId);
        this.parentMap.delete(img.extractedImgId);
      });
    }

    if (node.tables) {
      node.tables.forEach((table: any) => {
        this.validationErrors.delete(table.id);
        this.parentMap.delete(table.id);
      });
    }
  }

  /* ================= ZOOM CONTROLS ================= */

  zoomIn() {
    const newZoom = Math.min(this.zoomLevel() + this.zoomStep, this.maxZoom);
    this.zoomLevel.set(Number(newZoom.toFixed(1)));
    setTimeout(() => this.calculateArrows(), 100);
  }

  zoomOut() {
    const newZoom = Math.max(this.zoomLevel() - this.zoomStep, this.minZoom);
    this.zoomLevel.set(Number(newZoom.toFixed(1)));
    setTimeout(() => this.calculateArrows(), 100);
  }

  resetZoom() {
    this.zoomLevel.set(1);
    setTimeout(() => this.calculateArrows(), 100);
  }
}
