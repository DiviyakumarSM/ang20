import {
  Component,
  signal,
  viewChildren,
  ElementRef,
  effect,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop,
  DragDropModule,
  CdkDrag,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import { v4 as uuidv4 } from 'uuid';
import * as Model from './data.model';
import { mockResponse } from './data';

/* ─── Local runtime types ─── */

/** Union of all item types that can appear in a hierarchy column */
type ColumnItem =
  | Model.IHierarchyNodeRuntime
  | Model.IImageListItem
  | Model.ITableListItem;

/** Data attached to each CDK drop-list */
interface IDropListData {
  parentId: string | null;
  index: number;
}

/** SVG connector line */
interface IConnection {
  path: string;
  active: boolean;
  invalid: boolean;
}

/* ─── Component ─── */

@Component({
  selector: 'app-final-setup',
  standalone: true,
  imports: [CommonModule, DragDropModule, FormsModule],
  templateUrl: './final-setup.html',
  styleUrl: './final-setup.scss',
})
export class FinalSetup implements OnInit {
  rawFileData!: Model.IAssemblyHierarchy;

  availableImages = signal<Model.IImageListItem[]>([]);
  availableTables = signal<Model.ITableListItem[]>([]);
  columns = signal<ColumnItem[][]>([]);
  selectedIds = signal<string[]>([]);
  connections = signal<IConnection[]>([]);

  isDragging = signal(false);
  invalidHoverId = signal<string | null>(null);

  // Right panel
  rightPanelOpen = signal(false);
  rightPanelMode = signal<'add' | 'edit'>('add');
  rightPanelFor = signal<string>('assembly');
  editingNodeId = signal<string | null>(null);
  pendingParentId = signal<string | null>(null);
  assemblyForm = { assemblyName: '', classCode: '', parentClassCode: '', isValid: false };
  formErrorMessage = '';
  classCodeList = signal<string[]>([]);

  // Save state: disabled when any node has partial drop (image without table or vice-versa)
  disableSave = signal(true);

  // Zoom
  zoomLevel = signal(0.9);
  readonly minZoom = 0.5;
  readonly maxZoom = 2;
  readonly zoomStep = 0.1;

  // SVG
  svgWidth = signal(2000);
  svgHeight = signal(1000);
  svgScrollX = signal(0);
  svgScrollY = signal(0);

  itemRefs = viewChildren<ElementRef>('itemRef');
  parentMap = new Map<string, string | null>();

  constructor() {
    effect((onCleanup) => {
      this.columns();
      this.selectedIds();
      const t = setTimeout(() => this.calculateArrows(), 60);
      onCleanup(() => clearTimeout(t));
    });

    effect((onCleanup) => {
      let rafId: number | null = null;
      let scrolling = false;
      const handler = () => {
        if (!scrolling) {
          scrolling = true;
          rafId = requestAnimationFrame(() => {
            this.calculateArrows();
            scrolling = false;
          });
        }
      };
      setTimeout(() => {
        const area = document.querySelector('.levels-area');
        if (area) {
          area.addEventListener('scroll', handler, { passive: true });
          onCleanup(() => {
            area.removeEventListener('scroll', handler);
            if (rafId !== null) cancelAnimationFrame(rafId);
          });
        }
      }, 100);
    });

    effect((onCleanup) => {
      this.zoomLevel();
      const t = setTimeout(() => this.calculateArrows(), 100);
      onCleanup(() => clearTimeout(t));
    });
  }

  ngOnInit(): void {
    this.rawFileData = mockResponse.data.assemblyHierarchy as unknown as Model.IAssemblyHierarchy;
    this.initNodes();
    this.availableImages.set([...this.rawFileData.imageList]);
    this.refreshAvailableTables();
    const classCodes = Object.values(this.rawFileData.nodes).map((n) => n.classCode);
    this.classCodeList.set([...new Set(classCodes)]);
    this.refreshView();
    if (this.rawFileData.rootIds.length) {
      this.selectItem(
        this.rawFileData.nodes[this.rawFileData.rootIds[0]] as Model.IHierarchyNodeRuntime,
        0,
      );
    }
  }

  /* ================= INIT ================= */

  private initNodes(): void {
    Object.values(this.rawFileData.nodes).forEach((n) => {
      const node = n as Model.IHierarchyNodeRuntime;
      if (!node.itemOrder) {
        // Build itemOrder: child nodes, then one entry per image + one entry per unique table.
        // tableListItemId is only set on assemblies WE created; existing mock data uses assemblyId as fallback.
        const usedTableIds = new Set<string>();
        node.itemOrder = [...node.childIds];
        node.assemblyList.forEach((a) => {
          node.itemOrder.push(a.extractedImgId);
          const tid = a.tableListItemId ?? a.assemblyId;
          if (!usedTableIds.has(tid)) {
            usedTableIds.add(tid);
            node.itemOrder.push(tid);
          }
        });
      }
      if (!node.pendingImages) node.pendingImages = [];
      if (!node.pendingTables) node.pendingTables = [];
    });
  }

  /* ================= TABLE HELPERS ================= */

  private refreshAvailableTables(): void {
    const usedIds = new Set<string>();
    Object.values(this.rawFileData.nodes).forEach((n) => {
      const node = n as Model.IHierarchyNodeRuntime;
      node.assemblyList.forEach((a) => {
        usedIds.add(a.tableListItemId ?? a.assemblyId);
      });
      node.pendingTables.forEach((t) => usedIds.add(t.tableId));
    });
    this.availableTables.set(
      this.rawFileData.tableList.filter((t) => !usedIds.has(t.tableId)),
    );
  }

  /* ================= TYPE GUARDS ================= */

  isNode(item: ColumnItem): item is Model.IHierarchyNodeRuntime {
    return 'hierarchyId' in item;
  }

  isImage(item: ColumnItem): item is Model.IImageListItem {
    return 'extractedImgId' in item;
  }

  isTable(item: ColumnItem): item is Model.ITableListItem {
    return 'tableId' in item;
  }

  getItemId(item: ColumnItem): string {
    if (this.isNode(item)) return item.hierarchyId;
    if (this.isImage(item)) return item.extractedImgId;
    if (this.isTable(item)) return item.tableId;
    return '';
  }

  asNode(id: string): Model.IHierarchyNodeRuntime {
    return this.rawFileData.nodes[id] as Model.IHierarchyNodeRuntime;
  }

  /* ================= ASSEMBLY HELPERS ================= */

  /**
   * Reconstruct a display IImageListItem from an existing IAssemblyItem.
   * Marked as isPaired = true so the template knows it's complete.
   */
  private imageFromAssembly(assembly: Model.IAssemblyItem): Model.IImageListItem {
    return {
      extractedImgId: assembly.extractedImgId,
      drawingName: assembly.drawingName,
      imageNameAsInPDF: assembly.prespectiveName || assembly.drawingName,
      productId: assembly.productId,
      productDescription: null,
      extractedImgVersion: assembly.extractedImgVersion,
      pageNo: assembly.pageId,
      type: 'image',
      prespectiveName: assembly.prespectiveName,
      pageId: assembly.pageId,
      hotspotDetails: assembly.hotspotDetails,
      svgHeader: assembly.svgHeader,
      svgFileName: assembly.svgFileName,
      svgFileId: assembly.svgFileId || null,
      assemblyIdRef: assembly.assemblyId,
      isPaired: true,
    };
  }

  /**
   * Reconstruct a virtual ITableListItem from an existing IAssemblyItem so that
   * a second image can be paired with the same table.
   */
  private tableFromAssembly(assembly: Model.IAssemblyItem): Model.ITableListItem | null {
    const pages = Object.values(assembly.linkedPageProductTable ?? {});
    if (!pages.length) return null;
    const page = pages[0];
    // Use tableListItemId if set (our created assemblies), else assemblyId (existing data)
    const tableId = assembly.tableListItemId ?? assembly.assemblyId;
    return {
      pageId: page.pageId,
      pageName: page.pageName,
      tableId,
      pageNo: page.pageKey,
      type: 'table',
      order: page.tables[0]?.order ?? 1,
      tableNameAsInPDF: page.tables[0]?.tableNameAsInPDF ?? '',
      tableName: page.tables[0]?.tableName ?? '',
      tables: page.tables.map((t) => ({
        tableId,
        tableNameAsInPDF: t.tableNameAsInPDF,
        tableName: t.tableName,
        isAccepted: true,
        order: t.order,
        tableData: t.tableData,
      })),
      isPaired: true,
    };
  }

  /* ================= VIEW ================= */

  refreshView(): void {
    this.buildParentMap();
    const cols: ColumnItem[][] = [];

    // Column 0: root nodes
    const rootNodes = this.rawFileData.rootIds
      .map((id) => this.asNode(id))
      .filter((n): n is Model.IHierarchyNodeRuntime => !!n);
    cols.push(rootNodes);

    // Subsequent columns from selected hierarchy
    this.selectedIds().forEach((parentId) => {
      const node = this.asNode(parentId);
      if (!node) return;

      const seenTableIds = new Set<string>();
      const nodeItems: ColumnItem[] = [];
      const assetItems: ColumnItem[] = [];

      for (const id of node.itemOrder) {
        // Child node? → always goes to top group
        const childNode = this.rawFileData.nodes[id];
        if (childNode) {
          nodeItems.push(childNode as Model.IHierarchyNodeRuntime);
          continue;
        }

        // Image from assembly (match by extractedImgId)?
        const assemblyForImage = node.assemblyList.find((a) => a.extractedImgId === id);
        if (assemblyForImage) {
          const hasTable = Object.keys(assemblyForImage.linkedPageProductTable ?? {}).length > 0;
          assetItems.push({ ...this.imageFromAssembly(assemblyForImage), isPaired: hasTable });
          continue;
        }

        // Table from assembly (match by tableListItemId ?? assemblyId, dedup)?
        const assemblyForTable = node.assemblyList.find(
          (a) => (a.tableListItemId ?? a.assemblyId) === id,
        );
        if (assemblyForTable) {
          if (!seenTableIds.has(id)) {
            seenTableIds.add(id);
            const tbl = this.tableFromAssembly(assemblyForTable);
            if (tbl) {
              assetItems.push({ ...tbl, isPaired: !!assemblyForTable.extractedImgId });
            }
          }
          continue;
        }

        // Pending image?
        const pendingImg = node.pendingImages.find((img) => img.extractedImgId === id);
        if (pendingImg) {
          assetItems.push({ ...pendingImg, isPaired: false });
          continue;
        }

        // Pending table (dedup)?
        const pendingTbl = node.pendingTables.find((t) => t.tableId === id);
        if (pendingTbl && !seenTableIds.has(pendingTbl.tableId)) {
          seenTableIds.add(pendingTbl.tableId);
          assetItems.push({ ...pendingTbl, isPaired: false });
        }
      }

      // Sub-assemblies always at top, images/tables always at bottom
      cols.push([...nodeItems, ...assetItems]);
    });

    this.columns.set(cols);
    this.updateSaveState();
  }

  private updateSaveState(): void {
    const hasPartial = Object.values(this.rawFileData.nodes).some((n) => {
      const node = n as Model.IHierarchyNodeRuntime;
      const hasUnpairedAssembly = node.assemblyList.some(
        (a) =>
          !a.extractedImgId ||
          Object.keys(a.linkedPageProductTable ?? {}).length === 0,
      );
      return node.pendingImages.length > 0 || node.pendingTables.length > 0 || hasUnpairedAssembly;
    });
    this.disableSave.set(hasPartial);
  }

  buildParentMap(): void {
    this.parentMap.clear();
    this.rawFileData.rootIds.forEach((id) => this.parentMap.set(id, null));
    Object.values(this.rawFileData.nodes).forEach((n) => {
      const node = n as Model.IHierarchyNodeRuntime;
      node.childIds.forEach((id) => this.parentMap.set(id, node.hierarchyId));
      node.assemblyList.forEach((a) => {
        if (a.extractedImgId) this.parentMap.set(a.extractedImgId, node.hierarchyId);
        this.parentMap.set(a.tableListItemId ?? a.assemblyId, node.hierarchyId);
      });
      node.pendingImages.forEach((img) =>
        this.parentMap.set(img.extractedImgId, node.hierarchyId),
      );
      node.pendingTables.forEach((t) => this.parentMap.set(t.tableId, node.hierarchyId));
    });
  }

  selectItem(item: ColumnItem, colIdx: number): void {
    if (!this.isNode(item)) return;
    const sel = this.selectedIds().slice(0, colIdx);
    sel[colIdx] = item.hierarchyId;

    // Auto-expand: follow the first child node at each subsequent level
    let current = item as Model.IHierarchyNodeRuntime;
    while (current.childIds && current.childIds.length > 0) {
      const firstChildId = current.childIds[0];
      const firstChild = this.asNode(firstChildId);
      if (!firstChild) break;
      sel.push(firstChildId);
      current = firstChild;
    }

    this.selectedIds.set(sel);
    this.refreshView();
  }

  isSelected(item: ColumnItem, colIdx: number): boolean {
    return this.selectedIds()[colIdx] === this.getItemId(item);
  }

  /* ================= DROP PREDICATES ================= */

  canEnterColumn = (drag: CdkDrag<ColumnItem>, drop: CdkDropList<IDropListData>): boolean => {
    const item = drag.data;
    const target = drop.data;

    // Root column only accepts nodes
    if (!target?.parentId) {
      if (!this.isNode(item)) {
        this.invalidHoverId.set(this.getItemId(item));
        return false;
      }
      return true;
    }

    this.invalidHoverId.set(null);
    return true;
  };

  canEnterImagesPanel = (drag: CdkDrag<ColumnItem>, _drop: CdkDropList): boolean => {
    return this.isImage(drag.data);
  };

  canEnterTablesPanel = (drag: CdkDrag<ColumnItem>, _drop: CdkDropList): boolean => {
    return this.isTable(drag.data);
  };

  /* ================= DROP HANDLERS ================= */

  onDropInColumn(event: CdkDragDrop<IDropListData>): void {
    this.isDragging.set(false);
    this.invalidHoverId.set(null);

    const item = event.item.data as ColumnItem;
    const source = event.previousContainer.data as IDropListData;
    const target = event.container.data as IDropListData;

    // ── From available images panel ──
    if (source.parentId === 'IMAGES') {
      if (!target.parentId) return;
      const node = this.asNode(target.parentId);
      if (!node) return;
      this.handleImageDrop(item as Model.IImageListItem, node);
      this.emitChange(target.parentId, 'ADD_IMAGE');
      this.refreshView();
      this.scheduleArrows();
      return;
    }

    // ── From available tables panel ──
    if (source.parentId === 'TABLES') {
      if (!target.parentId) return;
      const node = this.asNode(target.parentId);
      if (!node) return;
      this.handleTableDrop(item as Model.ITableListItem, node);
      this.emitChange(target.parentId, 'ADD_TABLE');
      this.refreshView();
      this.scheduleArrows();
      return;
    }

    // ── Reorder within same column ──
    if (event.previousContainer === event.container) {
      if (target.parentId) {
        const node = this.asNode(target.parentId);
        const itemId = this.getItemId(item);
        const fromIdx = node.itemOrder.indexOf(itemId);
        if (fromIdx !== -1) {
          node.itemOrder.splice(fromIdx, 1);
          node.itemOrder.splice(event.currentIndex, 0, itemId);
        }
      } else {
        const itemId = this.getItemId(item);
        const fromIdx = this.rawFileData.rootIds.indexOf(itemId);
        if (fromIdx !== -1) {
          this.rawFileData.rootIds.splice(fromIdx, 1);
          this.rawFileData.rootIds.splice(event.currentIndex, 0, itemId);
        }
      }
      this.emitChange(target.parentId, 'REORDER');
      this.refreshView();
      return;
    }

    // ── Transfer node between columns ──
    if (this.isNode(item)) {
      this.removeNodeFromParent(item.hierarchyId, source.parentId);
      this.addNodeToParent(item.hierarchyId, target.parentId, event.currentIndex);
      this.emitChange(source.parentId, 'TRANSFER_OUT');
      this.emitChange(target.parentId, 'TRANSFER_IN');
      this.refreshView();
      this.scheduleArrows();
    }
  }

  /* ================= ASSEMBLY CREATION LOGIC ================= */

  private handleImageDrop(image: Model.IImageListItem, node: Model.IHierarchyNodeRuntime): void {
    // Remove from available list
    this.availableImages.update((list) =>
      list.filter((img) => img.extractedImgId !== image.extractedImgId),
    );
    this.rawFileData.imageList = this.availableImages();

    // Re-fill a table-only assembly (image was previously removed)
    const tableOnlyAssembly = node.assemblyList.find(
      (a) => !a.extractedImgId && Object.keys(a.linkedPageProductTable ?? {}).length > 0,
    );
    if (tableOnlyAssembly) {
      this.fillAssemblyFromImage(image, tableOnlyAssembly);
      node.itemOrder.push(image.extractedImgId);
      return;
    }

    if (node.pendingTables.length > 0) {
      // Pair with first pending table → create IAssemblyItem
      const table = node.pendingTables.shift()!;
      node.itemOrder = node.itemOrder.filter((id) => id !== table.tableId);
      const assembly = this.createAssemblyItem(image, table, node);
      node.assemblyList.push(assembly);
      // Image and table as separate entries in itemOrder
      node.itemOrder.push(image.extractedImgId);
      node.itemOrder.push(table.tableId);
    } else if (node.assemblyList.length > 0) {
      // Node already has at least one complete assembly — reuse its table for the new image.
      const existingAssembly = node.assemblyList[node.assemblyList.length - 1];
      const virtualTable = this.tableFromAssembly(existingAssembly);
      if (virtualTable) {
        const assembly = this.createAssemblyItem(image, virtualTable, node);
        node.assemblyList.push(assembly);
        // Only push image ID — table's ID is already in itemOrder
        node.itemOrder.push(image.extractedImgId);
      } else {
        node.pendingImages.push(image);
        node.itemOrder.push(image.extractedImgId);
      }
    } else {
      // No table available yet — store as pending image
      node.pendingImages.push(image);
      node.itemOrder.push(image.extractedImgId);
    }
  }

  private handleTableDrop(table: Model.ITableListItem, node: Model.IHierarchyNodeRuntime): void {
    // Remove from available list
    this.availableTables.update((list) => list.filter((t) => t.tableId !== table.tableId));

    // Re-fill an image-only assembly (table was previously removed)
    const imageOnlyAssembly = node.assemblyList.find(
      (a) => !!a.extractedImgId && Object.keys(a.linkedPageProductTable ?? {}).length === 0,
    );
    if (imageOnlyAssembly) {
      this.fillAssemblyFromTable(table, imageOnlyAssembly);
      node.itemOrder.push(table.tableId);
      return;
    }

    if (node.pendingImages.length > 0) {
      // Pair with first pending image → create IAssemblyItem
      const image = node.pendingImages.shift()!;
      node.itemOrder = node.itemOrder.filter((id) => id !== image.extractedImgId);
      const assembly = this.createAssemblyItem(image, table, node);
      node.assemblyList.push(assembly);
      // Image and table as separate entries in itemOrder
      node.itemOrder.push(image.extractedImgId);
      node.itemOrder.push(table.tableId);
    } else {
      // Store as pending table
      node.pendingTables.push(table);
      node.itemOrder.push(table.tableId);
    }
  }

  private fillAssemblyFromImage(image: Model.IImageListItem, assembly: Model.IAssemblyItem): void {
    // productId stays as already set on the assembly (derived from node classCode)
    const drawingName = this.computeDrawingName(assembly.productId, image.prespectiveName);
    const svgHeader = this.updateSvgHeader(image.svgHeader, image.drawingName, drawingName);
    assembly.extractedImgId = image.extractedImgId;
    assembly.extractedImgVersion = image.extractedImgVersion;
    assembly.pageId = image.pageId;
    assembly.prespectiveName = image.prespectiveName;
    assembly.drawingName = drawingName;
    assembly.svgFileId = image.svgFileId ?? '';
    assembly.svgFileName = image.svgFileName;
    assembly.svgHeader = svgHeader;
    assembly.hotspotDetails = image.hotspotDetails;
    assembly.originalImgId = '';
    assembly.originalImgVersion = 0;
  }

  private fillAssemblyFromTable(table: Model.ITableListItem, assembly: Model.IAssemblyItem): void {
    const firstTable = table.tables[0];
    assembly.tableListItemId = table.tableId;
    assembly.mergedProductTable = firstTable?.tableData ?? [];
    assembly.linkedPageProductTable = {
      [table.pageNo]: {
        tables: table.tables.map((t) => ({
          tableNameAsInPDF: t.tableNameAsInPDF,
          isAccepted: true,
          tableData: t.tableData,
          tableName: t.tableName,
          order: t.order,
        })),
        pageKey: table.pageNo,
        pageId: table.pageId,
        pageName: table.pageName,
      },
    };
  }

  /* ================= REMOVE IMAGE / TABLE FROM COLUMN ================= */

  removeImageFromColumn(image: Model.IImageListItem, colIdx: number): void {
    const parentId = this.selectedIds()[colIdx - 1];
    if (!parentId) return;
    const node = this.asNode(parentId);
    if (!node) return;

    // Pending image — remove and restore to available
    if (node.pendingImages.some((img) => img.extractedImgId === image.extractedImgId)) {
      node.pendingImages = node.pendingImages.filter(
        (img) => img.extractedImgId !== image.extractedImgId,
      );
      node.itemOrder = node.itemOrder.filter((id) => id !== image.extractedImgId);
      const restored = { ...image, isPaired: undefined, selected: false };
      this.availableImages.update((list) => [...list, restored]);
      this.rawFileData.imageList = this.availableImages();
      this.emitChange(parentId, 'REMOVE_IMAGE');
      this.refreshView();
      this.scheduleArrows();
      return;
    }

    // Paired image — null image fields on its assembly, restore image to available
    const assembly = node.assemblyList.find((a) => a.extractedImgId === image.extractedImgId);
    if (!assembly) return;

    const restored = { ...this.imageFromAssembly(assembly), isPaired: undefined, selected: false };
    this.availableImages.update((list) => [...list, restored]);
    this.rawFileData.imageList = this.availableImages();

    node.itemOrder = node.itemOrder.filter((id) => id !== assembly.extractedImgId);

    // Null out image-oriented fields
    assembly.extractedImgId = '';
    assembly.svgFileId = '';
    assembly.svgFileName = '';
    assembly.svgHeader = '';
    assembly.hotspotDetails = [];
    assembly.drawingName = '';
    assembly.prespectiveName = '';
    assembly.extractedImgVersion = 0;
    assembly.originalImgId = '';
    assembly.originalImgVersion = 0;

    this.emitChange(parentId, 'REMOVE_IMAGE');
    this.refreshView();
    this.scheduleArrows();
  }

  removeTableFromColumn(table: Model.ITableListItem, colIdx: number): void {
    const parentId = this.selectedIds()[colIdx - 1];
    if (!parentId) return;
    const node = this.asNode(parentId);
    if (!node) return;

    const tableKey = table.tableId;

    // Pending table — remove and restore to available
    if (node.pendingTables.some((t) => t.tableId === tableKey)) {
      node.pendingTables = node.pendingTables.filter((t) => t.tableId !== tableKey);
      node.itemOrder = node.itemOrder.filter((id) => id !== tableKey);
      const restored = { ...table, isPaired: undefined, selected: false };
      this.availableTables.update((list) => [...list, restored]);
      this.emitChange(parentId, 'REMOVE_TABLE');
      this.refreshView();
      this.scheduleArrows();
      return;
    }

    // Paired table — null table fields on all assemblies using this key, restore table to available
    const assemblies = node.assemblyList.filter(
      (a) => (a.tableListItemId ?? a.assemblyId) === tableKey,
    );
    if (!assemblies.length) return;

    const restoredTable = this.tableFromAssembly(assemblies[0]);
    if (restoredTable) {
      this.availableTables.update((list) => [
        ...list,
        { ...restoredTable, isPaired: undefined, selected: false },
      ]);
    }

    node.itemOrder = node.itemOrder.filter((id) => id !== tableKey);

    assemblies.forEach((a) => {
      a.linkedPageProductTable = {};
      a.mergedProductTable = [];
      a.tableListItemId = undefined;
    });

    this.emitChange(parentId, 'REMOVE_TABLE');
    this.refreshView();
    this.scheduleArrows();
  }

  private createAssemblyItem(
    image: Model.IImageListItem,
    table: Model.ITableListItem,
    node: Model.IHierarchyNodeRuntime,
  ): Model.IAssemblyItem {
    const firstTable = table.tables[0];
    const productId = node.classCode.replace(/^CLASS_/, '');
    const drawingName = this.computeDrawingName(productId, image.prespectiveName);
    const svgHeader = this.updateSvgHeader(image.svgHeader, image.drawingName, drawingName);
    return {
      assemblyId: uuidv4(),
      tableListItemId: table.tableId,
      extractedImgId: image.extractedImgId,
      extractedImgVersion: image.extractedImgVersion,
      selectedImageIndex: 0,
      productId,
      pageId: image.pageId,
      drawingName,
      prespectiveName: image.prespectiveName,
      svgFileId: image.svgFileId ?? '',
      svgFileName: image.svgFileName,
      svgHeader,
      hotspotDetails: image.hotspotDetails,
      originalImgId: '',
      originalImgVersion: 0,
      extractedImageListByPage: [],
      mergedProductTable: firstTable?.tableData ?? [],
      classCodeInfo: {
        classRoot: node.classRoot,
        classCode: node.classCode,
        parentClassCode: node.parentClassCode,
      },
      assemblyStatus: 'pending',
      svgFileVersion: 0,
      userSave: false,
      pdsInfo: { serialNumber: '', installDate: '', description: '', modelNumber: '' },
      linkedPageProductTable: {
        [table.pageNo]: {
          tables: table.tables.map((t) => ({
            tableNameAsInPDF: t.tableNameAsInPDF,
            isAccepted: true,
            tableData: t.tableData,
            tableName: t.tableName,
            order: t.order,
          })),
          pageKey: table.pageNo,
          pageId: table.pageId,
          pageName: table.pageName,
        },
      },
      status: 'pending',
    };
  }

  /* ================= DRAWING NAME / SVG HEADER HELPERS ================= */

  /** drawingName = productId_prespectiveName  (or just productId when prespectiveName is absent) */
  private computeDrawingName(productId: string, prespectiveName: string): string {
    return prespectiveName ? `${productId}_${prespectiveName}` : productId;
  }

  /** Replace every occurrence of oldName in svgHeader with newName */
  private updateSvgHeader(svgHeader: string, oldName: string, newName: string): string {
    if (!oldName || oldName === newName) return svgHeader;
    return svgHeader.split(oldName).join(newName);
  }

  /* ================= NODE MUTATIONS ================= */

  private removeNodeFromParent(nodeId: string, parentId: string | null): void {
    if (parentId) {
      const parent = this.asNode(parentId);
      parent.childIds = parent.childIds.filter((id) => id !== nodeId);
      parent.itemOrder = parent.itemOrder.filter((id) => id !== nodeId);
    } else {
      this.rawFileData.rootIds = this.rawFileData.rootIds.filter((id) => id !== nodeId);
    }
  }

  private addNodeToParent(nodeId: string, parentId: string | null, index: number): void {
    const node = this.asNode(nodeId);
    if (parentId) {
      const parent = this.asNode(parentId);
      node.parentClassCode = parent.classCode;
      node.parentHierarchyId = parent.hierarchyId;
      parent.childIds.push(nodeId);
      parent.itemOrder.splice(index, 0, nodeId);
    } else {
      node.parentClassCode = this.rawFileData.classRoot;
      node.parentHierarchyId = '';
      this.rawFileData.rootIds.splice(index, 0, nodeId);
    }
  }

  /* ================= EMIT CHANGE ================= */

  private emitChange(nodeId: string | null, action: string): void {
    console.log(`[FinalSetup] ${action} | node: ${nodeId}`);
    console.log('[FinalSetup] rawFileData:', JSON.parse(JSON.stringify(this.rawFileData)));
  }

  /* ================= RIGHT PANEL ================= */

  openAddPanel(parentId: string | null, levelIndex: number, type: string): void {
    void levelIndex;
    this.rightPanelFor.set(type);
    this.rightPanelMode.set('add');
    this.pendingParentId.set(parentId);
    this.editingNodeId.set(null);
    this.assemblyForm = { assemblyName: '', classCode: '', parentClassCode: '', isValid: false };
    this.formErrorMessage = '';
    this.rightPanelOpen.set(true);
  }

  openEditPanel(node: Model.IHierarchyNodeRuntime): void {
    this.rightPanelMode.set('edit');
    this.editingNodeId.set(node.hierarchyId);
    this.pendingParentId.set(null);
    this.assemblyForm = {
      assemblyName: node.assemblyName ?? '',
      classCode: node.classCode ?? '',
      parentClassCode: node.parentClassCode ?? '',
      isValid: false,
    };
    this.formErrorMessage = '';
    this.rightPanelOpen.set(true);
  }

  closeRightPanel(): void {
    this.rightPanelOpen.set(false);
    this.assemblyForm = { assemblyName: '', classCode: '', parentClassCode: '', isValid: false };
  }

  onNameChange(value: string): void {
    this.assemblyForm.assemblyName = value ?? '';
    if (this.rightPanelMode() === 'add') {
      this.assemblyForm.classCode =
        'CLASS_' + (value ?? '').trim().replace(/\s+/g, '_').toUpperCase();
    }
    const conflict =
      this.rightPanelMode() === 'add' &&
      this.classCodeList().includes(this.assemblyForm.classCode);
    if (this.assemblyForm.assemblyName && !conflict) {
      this.assemblyForm.isValid = true;
      this.formErrorMessage = '';
    } else {
      this.assemblyForm.isValid = false;
      this.formErrorMessage = !this.assemblyForm.assemblyName
        ? 'Please enter a name.'
        : 'Class code already exists, try a different name.';
    }
  }

  submitForm(): void {
    if (this.rightPanelMode() === 'add') {
      this.createNode();
    } else {
      this.updateNode();
    }
    this.closeRightPanel();
  }

  createNode(): void {
    // hierarchyId = classCode without the "CLASS_" prefix
    const newId = this.assemblyForm.classCode.replace(/^CLASS_/, '');
    const parentId = this.pendingParentId();
    const newNode: Model.IHierarchyNodeRuntime = {
      hierarchyId: newId,
      assemblyName: this.assemblyForm.assemblyName,
      classCode: this.assemblyForm.classCode,
      classRoot: this.rawFileData.classRoot,
      parentClassCode: parentId
        ? this.rawFileData.nodes[parentId].classCode
        : this.rawFileData.classRoot,
      parentHierarchyId: parentId ?? '',
      childIds: [],
      assemblyList: [],
      partsList: [],
      itemOrder: [],
      pendingImages: [],
      pendingTables: [],
    };
    this.rawFileData.nodes[newId] = newNode;
    if (!parentId) {
      this.rawFileData.rootIds.push(newId);
    } else {
      const parent = this.asNode(parentId);
      parent.childIds.push(newId);
      parent.itemOrder.push(newId);
    }
    this.classCodeList.update((list) => [...list, this.assemblyForm.classCode]);
    this.emitChange(parentId, 'ADD_NODE');
    this.refreshView();
    setTimeout(() => this.calculateArrows(), 100);
  }

  updateNode(): void {
    const nodeId = this.editingNodeId();
    if (!nodeId) return;
    const node = this.rawFileData.nodes[nodeId];
    if (!node) return;
    node.assemblyName = this.assemblyForm.assemblyName;
    node.classCode = this.assemblyForm.classCode;
    this.emitChange(nodeId, 'UPDATE_NODE');
    this.refreshView();
  }

  /* ================= SVG ARROWS ================= */

  calculateArrows(): void {
    const lines: IConnection[] = [];
    const els = this.itemRefs();
    const active = this.selectedIds();
    const zoom = this.zoomLevel();
    const baseRadius = 12;

    const levelsArea = document.querySelector('.levels-area') as HTMLElement | null;
    if (!levelsArea) return;
    const levelsContainer = levelsArea.querySelector('.levels-container') as HTMLElement | null;
    if (!levelsContainer) return;

    const areaRect = levelsArea.getBoundingClientRect();
    const scrollLeft = levelsArea.scrollLeft;
    const scrollTop = levelsArea.scrollTop;
    this.svgScrollX.set(scrollLeft);
    this.svgScrollY.set(scrollTop);
    this.svgWidth.set(
      Math.max(levelsContainer.scrollWidth * zoom + scrollLeft, areaRect.width + scrollLeft),
    );
    this.svgHeight.set(
      Math.max(levelsContainer.scrollHeight * zoom + scrollTop, areaRect.height + scrollTop),
    );

    active.forEach((pid, i) => {
      const pEl = els.find(
        (e) =>
          e.nativeElement.dataset['id'] === pid &&
          e.nativeElement.dataset['level'] === String(i),
      )?.nativeElement as HTMLElement | undefined;
      const next = this.columns()[i + 1];
      if (!pEl || !next) return;

      const p = pEl.getBoundingClientRect();
      const sx = p.right - areaRect.left + scrollLeft;
      const sy = p.top - areaRect.top + scrollTop + p.height / 2;

      next.forEach((c: ColumnItem) => {
        const cid = this.getItemId(c);
        const cEl = els.find(
          (e) =>
            e.nativeElement.dataset['id'] === cid &&
            e.nativeElement.dataset['level'] === String(i + 1),
        )?.nativeElement as HTMLElement | undefined;
        if (!cEl) return;

        const itemType = cEl.getAttribute('data-type');
        // Tables don't get connector arrows
        if (itemType === 'table') return;
        // Images are always drawn green; folders are green only when selected
        const isAlwaysActive = itemType === 'image';

        const r = cEl.getBoundingClientRect();
        const ex = r.left - areaRect.left + scrollLeft;
        const ey = r.top - areaRect.top + scrollTop + r.height / 2;
        const midX = sx + (ex - sx) / 2;
        const dy = ey - sy;
        const dir = dy > 0 ? 1 : -1;
        const absdy = Math.abs(dy);
        const r1 = Math.min(baseRadius, absdy / 2, (ex - sx) / 4);

        const path =
          absdy < 2
            ? `M ${sx} ${sy} L ${ex} ${ey}`
            : `M ${sx} ${sy}
               L ${midX - r1} ${sy}
               Q ${midX} ${sy} ${midX} ${sy + dir * r1}
               L ${midX} ${ey - dir * r1}
               Q ${midX} ${ey} ${midX + r1} ${ey}
               L ${ex} ${ey}`;

        lines.push({
          path,
          active: active[i + 1] === cid || isAlwaysActive,
          invalid: false,
        });
      });
    });

    this.connections.set(lines);
  }

  private scheduleArrows(): void {
    requestAnimationFrame(() => {
      this.calculateArrows();
      setTimeout(() => this.calculateArrows(), 80);
    });
  }

  /* ================= ZOOM ================= */

  zoomIn(): void {
    this.zoomLevel.set(
      Number(Math.min(this.zoomLevel() + this.zoomStep, this.maxZoom).toFixed(1)),
    );
  }

  zoomOut(): void {
    this.zoomLevel.set(
      Number(Math.max(this.zoomLevel() - this.zoomStep, this.minZoom).toFixed(1)),
    );
  }

  resetZoom(): void {
    this.zoomLevel.set(1);
  }

  /* ================= SAVE ================= */

  saveHierarchy(): void {
    console.log('[FinalSetup] SAVE — rawFileData:', JSON.parse(JSON.stringify(this.rawFileData)));
  }
}
