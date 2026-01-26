import {
  Component,
  ElementRef,
  EventEmitter,
  Output,
  signal,
  viewChildren,
  effect,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { DATA } from '../test/data';

type NodeType = 'folder' | 'table' | 'image';

@Component({
  selector: 'app-assembly-driller',
  standalone: true,
  imports: [CommonModule, DragDropModule, FormsModule],
  templateUrl: './assembly-driller-component.html',
  styleUrls: ['./assembly-driller-component.scss'],
})
export class AssemblyDrillerComponent implements AfterViewInit {
  @Output() structureChange = new EventEmitter<any>();

  itemRefs = viewChildren<ElementRef>('itemRef');
  wrapperRef!: ElementRef<HTMLDivElement>;

  rawData: any = DATA;

  columns = signal<any[][]>([]);
  selectedIds = signal<string[]>([]);
  connections = signal<any[]>([]);

  hoveredColumn = signal<number | null>(null);
  activeMenuColumn = signal<number | null>(null);
  sidePanelOpen = signal(false);

  draggingId = signal<string | null>(null);
  invalidHoverId = signal<string | null>(null);

  newAssembly = {
    name: '',
    rootId: '',
    classCode: '',
  };

  constructor() {
    this.buildColumns();

    effect(() => {
      queueMicrotask(() => this.calculateConnections());
    });
  }

  ngAfterViewInit() {
    effect(() => {
      this.columns();
      requestAnimationFrame(() => this.calculateConnections());
    });
  }

  /* ================= COLUMN BUILD ================= */

  buildColumns() {
    const cols: any[][] = [];

    const rootItems = this.rawData.rootIds.flatMap((id: string) =>
      this.expandNode(this.rawData.nodes[id]),
    );

    cols.push(rootItems);

    this.selectedIds().forEach((id) => {
      const node = this.rawData.nodes[id];
      if (!node) return;
      cols.push(this.expandNode(node));
    });

    this.columns.set(cols);
  }

  expandNode(node: any): any[] {
    const folders = node.childIds.map((id: string) => this.rawData.nodes[id]);

    const tables = (node.tables || []).map((t: any) => ({
      ...t,
      __type: 'table',
      parentId: node.assemblyId,
    }));

    const images = (node.images || []).map((i: any) => ({
      ...i,
      __type: 'image',
      parentId: node.assemblyId,
    }));

    return [...folders, ...tables, ...images];
  }

  selectItem(item: any, colIndex: number) {
    if (item.__type) return;
    const next = this.selectedIds().slice(0, colIndex);
    next[colIndex] = item.assemblyId;
    this.selectedIds.set(next);
    this.buildColumns();
  }

  /* ================= DRAG DROP ================= */

  onDragStart(item: any) {
    this.draggingId.set(item.assemblyId);
  }

  onDragEnd() {
    this.draggingId.set(null);
    this.invalidHoverId.set(null);
  }

  canEnter = (drop: any, drag: any) => {
    const dragged = drag.data;
    const targetId = drop.data?.parentId;

    if (!dragged?.assemblyId || !targetId) return true;
    if (dragged.assemblyId === targetId) return false;
    if (this.isDescendant(dragged.assemblyId, targetId)) return false;

    return true;
  };

  onDrop(event: CdkDragDrop<any>) {
    const dragged = event.item.data;
    const targetParentId = event.container.data.parentId;

    if (!dragged?.assemblyId || !targetParentId) return;
    if (this.isDescendant(dragged.assemblyId, targetParentId)) return;

    this.detachFromParent(dragged.assemblyId);
    this.rawData.nodes[targetParentId].childIds.push(dragged.assemblyId);
    this.rawData.nodes[targetParentId].itemOrder.push(dragged.assemblyId);

    this.structureChange.emit(this.rawData);
    this.buildColumns();
  }

  detachFromParent(id: string) {
    Object.values(this.rawData.nodes).forEach((n: any) => {
      n.childIds = n.childIds.filter((c: string) => c !== id);
      n.itemOrder = n.itemOrder.filter((c: string) => c !== id);
    });
    this.rawData.rootIds = this.rawData.rootIds.filter((r: string) => r !== id);
  }

  isDescendant(src: string, target: string): boolean {
    const node = this.rawData.nodes[src];
    if (!node?.childIds?.length) return false;
    if (node.childIds.includes(target)) return true;
    return node.childIds.some((c: string) => this.isDescendant(c, target));
  }

  /* ================= SVG ================= */

  calculateConnections() {
    const items = this.itemRefs();
    if (!items.length) return;

    const wrapperRect = items[0].nativeElement.closest('.driller-wrapper')!.getBoundingClientRect();

    const lines: any[] = [];

    items.forEach((el) => {
      const id = el.nativeElement.dataset['id'];
      const node = this.rawData.nodes[id];
      if (!node?.childIds?.length) return;

      node.childIds.forEach((cid: string) => {
        const targetEl = items.find((i) => i.nativeElement.dataset['id'] === cid);
        if (!targetEl) return;

        const from = el.nativeElement.getBoundingClientRect();
        const to = targetEl.nativeElement.getBoundingClientRect();

        const x1 = from.right - wrapperRect.left;
        const y1 = from.top + from.height / 2 - wrapperRect.top;
        const x2 = to.left - wrapperRect.left;
        const y2 = to.top + to.height / 2 - wrapperRect.top;

        lines.push({
          d: `M ${x1} ${y1} C ${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}`,
        });
      });
    });

    this.connections.set(lines);
  }

  /* ================= ADD FLOW ================= */

  openAddMenu(colIndex: number) {
    this.activeMenuColumn.set(colIndex);
  }

  closeAddMenu() {
    this.activeMenuColumn.set(null);
  }

  openSidePanel(colIndex: number) {
    this.newAssembly = {
      name: '',
      rootId: colIndex === 0 ? 'ROOT' : this.selectedIds()[colIndex - 1],
      classCode: '',
    };

    this.sidePanelOpen.set(true);
    this.activeMenuColumn.set(null);
  }

  closeSidePanel() {
    this.sidePanelOpen.set(false);
  }

  createAssembly() {
    if (!this.newAssembly.name) return;

    const id = crypto.randomUUID();

    this.rawData.nodes[id] = {
      assemblyId: id,
      assemblyName: this.newAssembly.name,
      childIds: [],
      itemOrder: [],
      images: [],
      tables: [],
    };

    if (this.newAssembly.rootId === 'ROOT') {
      this.rawData.rootIds.push(id);
    } else {
      const parent = this.rawData.nodes[this.newAssembly.rootId];
      parent.childIds.push(id);
      parent.itemOrder.push(id);
    }

    this.sidePanelOpen.set(false);
    this.buildColumns();
    this.structureChange.emit(this.rawData);
  }
}
