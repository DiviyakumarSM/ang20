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
import { CdkDragDrop, DragDropModule, CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { DATA } from '../test/data';

@Component({
  selector: 'app-assembly-driller',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './assembly-driller-component.html',
  styleUrls: ['./assembly-driller-component.scss'],
})
export class AssemblyDrillerComponent {
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
      // Transfer between columns
      this.removeFromModel(source.parentId, itemId, item);
      this.addToModel(target.parentId, itemId, item, event.currentIndex);
      this.emitChange(source.parentId, 'TRANSFER_OUT');
      this.emitChange(target.parentId, 'TRANSFER_IN');
    }

    this.refreshView();

    // Update arrows after drop
    setTimeout(() => this.calculateArrows(), 100);
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
    const allTables = node.tables?.flatMap((p: any) => p.tables) || [];
    if (allTables.length && !hasImages) {
      allTables.forEach((table: any) => {
        this.validationErrors.set(table.id, 'Table exists without any image');
      });
    } else {
      allTables.forEach((table: any) => {
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
    node.tables = node.tables
      .map((p: any) => ({ ...p, tables: p.tables.filter((t: any) => t.id !== assetId) }))
      .filter((p: any) => p.tables.length > 0);
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

  /* ================= UTILITY ================= */
  private getAllTables(node: any): any[] {
    return node.tables?.flatMap((p: any) => p.tables) || [];
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

        // Skip drawing arrows to tables
        const itemType = cEl.getAttribute('data-type');
        if (itemType === 'table') return;

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
