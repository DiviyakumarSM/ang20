import { Component, signal, viewChildren, ElementRef, effect, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { v4 as uuidv4 } from 'uuid';
import * as Model from './data.model';
import { mockResponse } from './data';
import { EditHotspotsComponent } from '../edit-hotspots/edit-hotspots.component';

/* ─── Local runtime types ─── */

/** Union of all item types that can appear in a hierarchy column */
type ColumnItem = Model.IHierarchyNodeRuntime | Model.IImageListItem | Model.ITableListItem;

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
  private dialog = inject(MatDialog);
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

  // Validation errors shown in the top-right panel
  validationErrors = signal<string[]>([]);
  validationPanelDismissed = signal(false);

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
    const sortedRoots = this.rawFileData.rootIds
      .map((id) => this.asNode(id))
      .filter((n): n is Model.IHierarchyNodeRuntime => !!n)
      .sort((a, b) => (a.assemblyName ?? a.hierarchyId).localeCompare(b.assemblyName ?? b.hierarchyId));
    if (sortedRoots.length) {
      this.selectItem(sortedRoots[0], 0);
    }
  }

  /* ================= INIT ================= */

  private initNodes(): void {
    Object.values(this.rawFileData.nodes).forEach((n) => {
      const node = n as Model.IHierarchyNodeRuntime;
      if (!node.pendingImages) node.pendingImages = [];
      if (!node.pendingTables) node.pendingTables = [];
      if (!node.tableSlots) node.tableSlots = {};

      if (!node.itemOrder) {
        node.itemOrder = [...node.childIds];
        node.assemblyList.forEach((a) => {
          // Image slot
          if (a.extractedImgId) node.itemOrder.push(a.extractedImgId);
          // Each table entry in this assembly becomes its own draggable slot
          this.splitTablesFromAssembly(a).forEach((tbl) => {
            if (!node.tableSlots[tbl.tableId]) {
              node.tableSlots[tbl.tableId] = tbl;
              node.itemOrder.push(tbl.tableId);
            }
          });
        });
      }
    });
  }

  /* ================= TABLE HELPERS ================= */

  /**
   * Split an assembly's linkedPageProductTable into one ITableListItem per ITableEntry.
   * Each item has assemblyIdRef set so remove/move can patch the source assembly.
   */
  private splitTablesFromAssembly(assembly: Model.IAssemblyItem): Model.ITableListItem[] {
    const result: Model.ITableListItem[] = [];
    for (const [pageKey, page] of Object.entries(assembly.linkedPageProductTable ?? {})) {
      for (const tableEntry of page.tables) {
        if (!tableEntry.tableData?.length) continue;
        const splitId = `${assembly.assemblyId}__${pageKey}__${tableEntry.order}`;
        result.push({
          tableId: splitId,
          pageName: page.pageName,
          pageId: page.pageId,
          pageNo: page.pageKey,
          type: 'table',
          order: tableEntry.order,
          tableNameAsInPDF: tableEntry.tableNameAsInPDF ?? '',
          tableName: tableEntry.tableName,
          tables: [{ ...tableEntry, tableId: splitId }],
          assemblyIdRef: assembly.assemblyId,
        });
      }
    }
    return result;
  }

  /**
   * Remove a single split table entry from its source assembly's linkedPageProductTable.
   * If the page becomes empty, remove the page key; if no pages remain, clear table fields.
   */
  private removeTableEntryFromAssembly(
    node: Model.IHierarchyNodeRuntime,
    slotTable: Model.ITableListItem,
  ): void {
    const assembly = node.assemblyList.find((a) => a.assemblyId === slotTable.assemblyIdRef);
    if (!assembly) return;
    const page = assembly.linkedPageProductTable?.[slotTable.pageNo];
    if (!page) return;
    page.tables = page.tables.filter((t) => t.order !== slotTable.order);
    if (page.tables.length === 0) delete assembly.linkedPageProductTable[slotTable.pageNo];
    if (Object.keys(assembly.linkedPageProductTable ?? {}).length === 0) {
      assembly.linkedPageProductTable = {};
      assembly.mergedProductTable = [];
      assembly.tableListItemId = undefined;
    }
  }

  private refreshAvailableTables(): void {
    const usedIds = new Set<string>();
    Object.values(this.rawFileData.nodes).forEach((n) => {
      const node = n as Model.IHierarchyNodeRuntime;
      // tableSlots is the canonical set of tables used in a node
      Object.keys(node.tableSlots ?? {}).forEach((id) => usedIds.add(id));
      node.pendingTables.forEach((t) => usedIds.add(t.tableId));
    });
    this.availableTables.set(this.rawFileData.tableList.filter((t) => !usedIds.has(t.tableId)));
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
      imageNameAsInPDF: assembly.imageNameAsInPDF || assembly.drawingName,
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
      imageUrl: assembly.imageUrl,
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
    const tableId = assembly.tableListItemId ?? assembly.assemblyId;
    const firstPage = pages[0];

    // Flat deduplicated table list (same tableNameAsInPDF across pages → clubbed into one)
    const seenNames = new Set<string>();
    const allTables: Model.ITableEntry[] = [];
    for (const page of pages) {
      for (const t of page.tables) {
        const key = t.tableNameAsInPDF || t.tableName;
        if (!seenNames.has(key)) {
          seenNames.add(key);
          allTables.push({
            tableId,
            tableNameAsInPDF: t.tableNameAsInPDF,
            tableName: t.tableName,
            isAccepted: true,
            order: t.order,
            tableData: t.tableData,
          });
        }
      }
    }

    // Page-grouped structure: each page from linkedPageProductTable becomes a group
    const pageGroups = pages
      .filter((page) => page.tables.some((t) => (t.tableData?.length ?? 0) > 0))
      .map((page) => ({
        pageName: page.pageName,
        pageKey: page.pageKey,
        tables: page.tables.filter((t) => (t.tableData?.length ?? 0) > 0),
      }));

    return {
      pageId: firstPage.pageId,
      pageName: firstPage.pageName,
      tableId,
      pageNo: firstPage.pageKey,
      type: 'table',
      order: firstPage.tables[0]?.order ?? 1,
      tableNameAsInPDF: firstPage.tables[0]?.tableNameAsInPDF ?? '',
      tableName: firstPage.tables[0]?.tableName ?? '',
      tables: allTables,
      isPaired: !!assembly.extractedImgId,
      pageGroups,
    };
  }

  /* ================= VIEW ================= */

  refreshView(): void {
    this.buildParentMap();
    const cols: ColumnItem[][] = [];

    // Column 0: root nodes
    const rootNodes = this.rawFileData.rootIds
      .map((id) => this.asNode(id))
      .filter((n): n is Model.IHierarchyNodeRuntime => !!n)
      .sort((a, b) => (a.assemblyName ?? a.hierarchyId).localeCompare(b.assemblyName ?? b.hierarchyId));
    cols.push(rootNodes);

    // Subsequent columns from selected hierarchy
    this.selectedIds().forEach((parentId) => {
      const node = this.asNode(parentId);
      if (!node) return;

      const seenTableIds = new Set<string>();
      const nodeItems: ColumnItem[] = [];
      const imageItems: ColumnItem[] = [];
      const tableItems: ColumnItem[] = [];

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
          imageItems.push({ ...this.imageFromAssembly(assemblyForImage), isPaired: hasTable });
          continue;
        }

        // Individual table from tableSlots — each entry is its own draggable item
        const tblSlot = node.tableSlots?.[id];
        if (tblSlot && !seenTableIds.has(id)) {
          seenTableIds.add(id);
          const hasImage = node.assemblyList.some((a) => !!a.extractedImgId);
          tableItems.push({ ...tblSlot, isPaired: hasImage });
          continue;
        }

        // Pending image?
        const pendingImg = node.pendingImages.find((img) => img.extractedImgId === id);
        if (pendingImg) {
          imageItems.push({ ...pendingImg, isPaired: false });
          continue;
        }
      }

      // Order: sub-assemblies (sorted) → images → tables
      nodeItems.sort((a, b) => {
        const nameA = (a as Model.IHierarchyNodeRuntime).assemblyName ?? (a as Model.IHierarchyNodeRuntime).hierarchyId;
        const nameB = (b as Model.IHierarchyNodeRuntime).assemblyName ?? (b as Model.IHierarchyNodeRuntime).hierarchyId;
        return nameA.localeCompare(nameB);
      });
      cols.push([...nodeItems, ...imageItems, ...tableItems]);
    });

    this.columns.set(cols);
    this.updateSaveState();
  }

  private updateSaveState(): void {
    const errors = this.validateHierarchy();
    const isValid = errors.length === 0;
    if (errors.length > 0) this.validationPanelDismissed.set(false);
    this.validationErrors.set(errors);
    this.disableSave.set(!isValid);
    console.log('[FinalSetup] validation errors:', errors);
  }

  private validateHierarchy(): string[] {
    const errors: string[] = [];

    Object.values(this.rawFileData.nodes).forEach((n) => {
      const node = n as Model.IHierarchyNodeRuntime;
      const label = `"${node.assemblyName || node.hierarchyId}"`;

      // Per-assembly checks: image with no table, or table with no image
      const unpairedImages =
        node.assemblyList.filter(
          (a) => !!a.extractedImgId && Object.keys(a.linkedPageProductTable ?? {}).length === 0,
        ).length + node.pendingImages.length;

      const unpairedTables =
        node.assemblyList.filter(
          (a) => !a.extractedImgId && Object.keys(a.linkedPageProductTable ?? {}).length > 0,
        ).length + node.pendingTables.length;

      if (unpairedImages > 0) {
        errors.push(
          `${label}: ${unpairedImages} image(s) without a table — assign a table to complete`,
        );
      }
      if (unpairedTables > 0) {
        errors.push(
          `${label}: ${unpairedTables} table(s) without an image — assign an image to complete`,
        );
      }

      // perspectiveName uniqueness within assemblyList
      const names = node.assemblyList.map((a) => a.prespectiveName).filter(Boolean);
      const dupes = names.filter((name, idx) => names.indexOf(name) !== idx);
      if (dupes.length > 0) {
        const unique = [...new Set(dupes)];
        errors.push(`${label}: duplicate perspective name(s): ${unique.join(', ')}`);
      }
    });

    return errors;
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
      node.pendingImages.forEach((img) => this.parentMap.set(img.extractedImgId, node.hierarchyId));
      node.pendingTables.forEach((t) => this.parentMap.set(t.tableId, node.hierarchyId));
    });
  }

  selectItem(item: ColumnItem, colIdx: number): void {
    if (!this.isNode(item)) return;
    const sel = this.selectedIds().slice(0, colIdx);
    sel[colIdx] = item.hierarchyId;

    // Auto-expand: follow the alphabetically first child node at each subsequent level
    let current = item as Model.IHierarchyNodeRuntime;
    while (current.childIds && current.childIds.length > 0) {
      const sortedChildIds = [...current.childIds].sort((a, b) => {
        const na = this.asNode(a);
        const nb = this.asNode(b);
        return (na?.assemblyName ?? a).localeCompare(nb?.assemblyName ?? b);
      });
      const firstChildId = sortedChildIds[0];
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

  /* ================= HIERARCHY UTILS ================= */

  /**
   * Returns true if nodeId is the same as targetId OR is an ancestor of targetId.
   * Used to prevent dropping a node into itself or one of its own descendants.
   */
  private isAncestorOrSelf(nodeId: string, targetId: string): boolean {
    if (nodeId === targetId) return true;
    const node = this.rawFileData.nodes[nodeId] as Model.IHierarchyNodeRuntime | undefined;
    if (!node) return false;
    return node.childIds.some((childId) => this.isAncestorOrSelf(childId, targetId));
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

    // Prevent dropping a node into itself or any of its own descendants
    if (this.isNode(item) && this.isAncestorOrSelf(item.hierarchyId, target.parentId)) {
      this.invalidHoverId.set(item.hierarchyId);
      return false;
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
      // Guard: never drop a node into itself or its own descendants
      if (target.parentId && this.isAncestorOrSelf(item.hierarchyId, target.parentId)) return;
      this.removeNodeFromParent(item.hierarchyId, source.parentId);
      this.addNodeToParent(item.hierarchyId, target.parentId, event.currentIndex);
      this.emitChange(source.parentId, 'TRANSFER_OUT');
      this.emitChange(target.parentId, 'TRANSFER_IN');
      this.refreshView();
      this.scheduleArrows();
      return;
    }

    // ── Transfer image between sub-assemblies ──
    if (this.isImage(item) && source.parentId && target.parentId) {
      this.moveImageBetweenNodes(item as Model.IImageListItem, source.parentId, target.parentId);
      this.emitChange(source.parentId, 'TRANSFER_IMAGE_OUT');
      this.emitChange(target.parentId, 'TRANSFER_IMAGE_IN');
      this.refreshView();
      this.scheduleArrows();
      return;
    }

    // ── Transfer table between sub-assemblies ──
    if (this.isTable(item) && source.parentId && target.parentId) {
      this.moveTableBetweenNodes(item as Model.ITableListItem, source.parentId, target.parentId);
      this.emitChange(source.parentId, 'TRANSFER_TABLE_OUT');
      this.emitChange(target.parentId, 'TRANSFER_TABLE_IN');
      this.refreshView();
      this.scheduleArrows();
      return;
    }
  }

  /* ================= ASSEMBLY CREATION LOGIC ================= */

  private handleImageDrop(image: Model.IImageListItem, node: Model.IHierarchyNodeRuntime): void {
    // Remove from available list and sync rawFileData
    this.availableImages.update((list) =>
      list.filter((img) => img.extractedImgId !== image.extractedImgId),
    );
    this.rawFileData.imageList = this.availableImages();
    this.pairImageWithNode(image, node);
  }

  private handleTableDrop(table: Model.ITableListItem, node: Model.IHierarchyNodeRuntime): void {
    // Remove from available list and sync rawFileData
    this.availableTables.update((list) => list.filter((t) => t.tableId !== table.tableId));
    this.rawFileData.tableList = this.availableTables();
    this.pairTableWithNode(table, node);
  }

  /**
   * Core image-pairing logic — does NOT touch availableImages/rawFileData.imageList.
   * Called by handleImageDrop (from available panel) and moveImageBetweenNodes (cross-node).
   */
  private pairImageWithNode(image: Model.IImageListItem, node: Model.IHierarchyNodeRuntime): void {
    // Existing table-only assembly — create a new assembly with its table details
    const tableOnlyAssembly = node.assemblyList.find(
      (a) => !a.extractedImgId && Object.keys(a.linkedPageProductTable ?? {}).length > 0,
    );
    if (tableOnlyAssembly) {
      const virtualTable = this.tableFromAssembly(tableOnlyAssembly);
      if (virtualTable) {
        const assembly = this.createAssemblyItem(image, virtualTable, node);
        node.assemblyList.push(assembly);
      } else {
        this.fillAssemblyFromImage(image, tableOnlyAssembly);
      }
      node.itemOrder.push(image.extractedImgId);
      return;
    }

    if (node.pendingTables.length > 0) {
      // Pair with first pending table → create IAssemblyItem
      const table = node.pendingTables.shift()!;
      node.itemOrder = node.itemOrder.filter((id) => id !== table.tableId);
      const assembly = this.createAssemblyItem(image, table, node);
      node.assemblyList.push(assembly);
      node.itemOrder.push(image.extractedImgId);
      node.itemOrder.push(table.tableId);
    } else if (node.assemblyList.length > 0) {
      // Reuse the table of the last complete assembly for the new image
      const withTable = node.assemblyList.filter(
        (a: Model.IAssemblyItem) => Object.keys(a.linkedPageProductTable ?? {}).length > 0,
      );
      const lastAssembly = withTable[withTable.length - 1] ?? null;
      const virtualTable = lastAssembly ? this.tableFromAssembly(lastAssembly) : null;
      if (virtualTable) {
        const assembly = this.createAssemblyItem(image, virtualTable, node);
        node.assemblyList.push(assembly);
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

  /**
   * Core table-pairing logic — does NOT touch availableTables/rawFileData.tableList.
   * Each table keeps its own identity in node.tableSlots (one entry = one draggable column item).
   * Each table also gets its own assembly entry so the output payload is complete.
   */
  private pairTableWithNode(table: Model.ITableListItem, node: Model.IHierarchyNodeRuntime): void {
    if (!node.tableSlots) node.tableSlots = {};

    // ── Same table dropped again — refresh its data in place ──
    if (node.tableSlots[table.tableId]) {
      node.tableSlots[table.tableId] = table;
      node.assemblyList
        .filter((a) => (a.tableListItemId ?? a.assemblyId) === table.tableId)
        .forEach((a) => this.fillAssemblyFromTable(table, a));
      return;
    }

    // Register — makes this table a separate draggable item in the column
    node.tableSlots[table.tableId] = table;
    node.itemOrder.push(table.tableId);

    // 1. Pair with any pending images (creates new assemblies)
    if (node.pendingImages.length > 0) {
      while (node.pendingImages.length > 0) {
        const image = node.pendingImages.shift()!;
        node.itemOrder = node.itemOrder.filter((id) => id !== image.extractedImgId);
        const assembly = this.createAssemblyItem(image, table, node);
        node.assemblyList.push(assembly);
        node.itemOrder.push(image.extractedImgId);
      }
      return;
    }

    // 2. Fill an image-only slot (extractedImgId set but no table yet)
    const imageOnlyAssembly = node.assemblyList.find(
      (a) => !!a.extractedImgId && Object.keys(a.linkedPageProductTable ?? {}).length === 0,
    );
    if (imageOnlyAssembly) {
      this.fillAssemblyFromTable(table, imageOnlyAssembly);
      return;
    }

    // 3. Update the existing assembly's table keys (do NOT create a new assembly)
    const primaryAssembly = node.assemblyList.find((a) => !!a.extractedImgId);
    if (primaryAssembly) {
      this.fillAssemblyFromTable(table, primaryAssembly);
      // extractedImgId is already in itemOrder — do NOT push it again
      return;
    }

    // 4. No images at all — store in pendingTables for later pairing (last resort)
    node.pendingTables.push(table);
  }

  private fillAssemblyFromImage(image: Model.IImageListItem, assembly: Model.IAssemblyItem): void {
    const drawingName = assembly.prespectiveName
      ? `${assembly.productId}_${assembly.prespectiveName}`
      : assembly.productId;
    assembly.extractedImgId = image.extractedImgId;
    assembly.extractedImgVersion = image.extractedImgVersion;
    assembly.pageId = image.pageId;
    assembly.drawingName = drawingName;
    assembly.imageNameAsInPDF = image.imageNameAsInPDF || image.drawingName;
    assembly.svgFileName = `${drawingName}.svg`;
    assembly.svgFileId = image.svgFileId ?? '';
    assembly.svgHeader = this.replaceSvgDrawingName(
      image.svgHeader || '',
      image.drawingName,
      drawingName,
    );
    assembly.hotspotDetails = image.hotspotDetails;
    assembly.imageUrl = image.imageUrl;
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

    // Paired image — null image fields on ALL assemblies sharing this extractedImgId
    const assemblies = node.assemblyList.filter((a) => a.extractedImgId === image.extractedImgId);
    if (!assemblies.length) return;

    const restored = {
      ...this.imageFromAssembly(assemblies[0]),
      isPaired: undefined,
      selected: false,
    };
    this.availableImages.update((list) => [...list, restored]);
    this.rawFileData.imageList = this.availableImages();

    node.itemOrder = node.itemOrder.filter((id) => id !== image.extractedImgId);

    assemblies.forEach((a) => {
      a.extractedImgId = '';
      a.imageNameAsInPDF = undefined;
      a.svgFileId = '';
      a.svgFileName = '';
      a.svgHeader = '';
      a.hotspotDetails = [];
      a.drawingName = '';
      a.imageUrl = undefined;
      a.extractedImgVersion = 0;
      a.originalImgId = '';
      a.originalImgVersion = 0;
    });
    this.cleanupGhostAssemblies(node);

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
      this.rawFileData.tableList = this.availableTables();
      this.emitChange(parentId, 'REMOVE_TABLE');
      this.refreshView();
      this.scheduleArrows();
      return;
    }

    // Paired table — restore from tableSlots, clear from assembly, remove from slot
    const slotTable = node.tableSlots?.[tableKey];
    if (!slotTable) return;

    this.availableTables.update((list) => [
      ...list,
      { ...slotTable, isPaired: undefined, selected: false },
    ]);
    this.rawFileData.tableList = this.availableTables();

    if (node.tableSlots) delete node.tableSlots[tableKey];
    node.itemOrder = node.itemOrder.filter((id) => id !== tableKey);

    if (slotTable.assemblyIdRef) {
      // Split table — remove only this entry from its source assembly
      this.removeTableEntryFromAssembly(node, slotTable);
    } else {
      node.assemblyList
        .filter((a) => (a.tableListItemId ?? a.assemblyId) === tableKey)
        .forEach((a) => {
          a.linkedPageProductTable = {};
          a.mergedProductTable = [];
          a.tableListItemId = undefined;
        });
    }

    this.emitChange(parentId, 'REMOVE_TABLE');
    this.refreshView();
    this.scheduleArrows();
  }

  private moveImageBetweenNodes(
    image: Model.IImageListItem,
    fromParentId: string,
    toParentId: string,
  ): void {
    const fromNode = this.asNode(fromParentId);
    const toNode = this.asNode(toParentId);

    // Remove from pending images
    const pendingIdx = fromNode.pendingImages.findIndex(
      (img) => img.extractedImgId === image.extractedImgId,
    );
    if (pendingIdx !== -1) {
      fromNode.pendingImages.splice(pendingIdx, 1);
      fromNode.itemOrder = fromNode.itemOrder.filter((id) => id !== image.extractedImgId);
      this.pairImageWithNode(image, toNode);
      return;
    }

    // Remove from paired assemblies — null out image fields on ALL sharing extractedImgId
    const assemblies = fromNode.assemblyList.filter(
      (a) => a.extractedImgId === image.extractedImgId,
    );
    if (!assemblies.length) return;
    fromNode.itemOrder = fromNode.itemOrder.filter((id) => id !== image.extractedImgId);
    // Capture the full image object before clearing (preserves imageNameAsInPDF etc.)
    const imageToMove = this.imageFromAssembly(assemblies[0]);
    assemblies.forEach((a) => {
      a.extractedImgId = '';
      a.imageNameAsInPDF = undefined;
      a.svgFileId = '';
      a.svgFileName = '';
      a.svgHeader = '';
      a.hotspotDetails = [];
      a.drawingName = '';
      a.imageUrl = undefined;
      a.extractedImgVersion = 0;
      a.originalImgId = '';
      a.originalImgVersion = 0;
    });
    this.cleanupGhostAssemblies(fromNode);
    this.pairImageWithNode(imageToMove, toNode);
  }

  /**
   * Remove any table-only assembly (no image) whose table is already covered by
   * another assembly in the same node that still has an image.
   * These ghosts are created when a shared-table parallel assembly loses its image
   * while the other assembly referencing the same table remains intact.
   */
  private cleanupGhostAssemblies(node: Model.IHierarchyNodeRuntime): void {
    const coveredTableIds = new Set(
      node.assemblyList
        .filter((a) => !!a.extractedImgId)
        .map((a) => a.tableListItemId ?? a.assemblyId),
    );
    node.assemblyList = node.assemblyList.filter((a) => {
      if (!a.extractedImgId && Object.keys(a.linkedPageProductTable ?? {}).length > 0) {
        return !coveredTableIds.has(a.tableListItemId ?? a.assemblyId);
      }
      return true;
    });
  }

  private moveTableBetweenNodes(
    table: Model.ITableListItem,
    fromParentId: string,
    toParentId: string,
  ): void {
    const fromNode = this.asNode(fromParentId);
    const toNode = this.asNode(toParentId);
    const tableKey = table.tableId;

    // Remove from pending tables
    const pendingIdx = fromNode.pendingTables.findIndex((t) => t.tableId === tableKey);
    if (pendingIdx !== -1) {
      fromNode.pendingTables.splice(pendingIdx, 1);
      fromNode.itemOrder = fromNode.itemOrder.filter((id) => id !== tableKey);
      this.pairTableWithNode(table, toNode);
      return;
    }

    // Get the canonical table object from tableSlots before clearing
    const tableToMove = fromNode.tableSlots?.[tableKey] ?? table;
    if (fromNode.tableSlots) delete fromNode.tableSlots[tableKey];
    fromNode.itemOrder = fromNode.itemOrder.filter((id) => id !== tableKey);

    if (tableToMove.assemblyIdRef) {
      // Split table — remove only this entry from its source assembly
      this.removeTableEntryFromAssembly(fromNode, tableToMove);
    } else {
      fromNode.assemblyList
        .filter((a) => (a.tableListItemId ?? a.assemblyId) === tableKey)
        .forEach((a) => {
          a.linkedPageProductTable = {};
          a.mergedProductTable = [];
          a.tableListItemId = undefined;
        });
    }
    this.pairTableWithNode(tableToMove, toNode);
  }

  private createAssemblyItem(
    image: Model.IImageListItem,
    table: Model.ITableListItem,
    node: Model.IHierarchyNodeRuntime,
  ): Model.IAssemblyItem {
    const firstTable = table.tables[0];
    const productId = node.hierarchyId;
    const prespectiveName = this.generatePrespectiveName(node);
    const drawingName = prespectiveName ? `${productId}_${prespectiveName}` : productId;
    const svgFileName = `${drawingName}.svg`;
    const svgHeader = this.replaceSvgDrawingName(
      image.svgHeader || '',
      image.drawingName,
      drawingName,
    );
    return {
      assemblyId: uuidv4(),
      tableListItemId: table.tableId,
      extractedImgId: image.extractedImgId,
      extractedImgVersion: image.extractedImgVersion,
      selectedImageIndex: 0,
      productId,
      pageId: image.pageId,
      drawingName,
      imageNameAsInPDF: image.imageNameAsInPDF || image.drawingName,
      prespectiveName,
      svgFileId: image.svgFileId ?? '',
      svgFileName,
      svgHeader,
      imageUrl: image.imageUrl,
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

  /** Replace every occurrence of oldName in svgHeader with newName */
  private replaceSvgDrawingName(svgHeader: string, oldName: string, newName: string): string {
    if (!oldName || oldName === newName) return svgHeader;
    return svgHeader.split(oldName).join(newName);
  }

  /** Generate next unique prespectiveName (View A, View B, …) for a new assembly in the node */
  private generatePrespectiveName(node: Model.IHierarchyNodeRuntime): string {
    const used = new Set(node.assemblyList.map((a) => a.prespectiveName).filter(Boolean));
    let idx = 0;
    let name: string;
    do {
      name = `View ${String.fromCharCode(65 + (idx % 26))}${idx >= 26 ? Math.floor(idx / 26) : ''}`;
      idx++;
    } while (used.has(name));
    return name;
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
      this.rightPanelMode() === 'add' && this.classCodeList().includes(this.assemblyForm.classCode);
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
      tableSlots: {},
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
          e.nativeElement.dataset['id'] === pid && e.nativeElement.dataset['level'] === String(i),
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
    this.zoomLevel.set(Number(Math.min(this.zoomLevel() + this.zoomStep, this.maxZoom).toFixed(1)));
  }

  zoomOut(): void {
    this.zoomLevel.set(Number(Math.max(this.zoomLevel() - this.zoomStep, this.minZoom).toFixed(1)));
  }

  resetZoom(): void {
    this.zoomLevel.set(1);
  }

  /* ================= SAVE ================= */

  saveHierarchy(): void {
    console.log('[FinalSetup] SAVE — rawFileData:', JSON.parse(JSON.stringify(this.rawFileData)));
  }

  openHotspot(image: Model.IImageListItem, colIdx: number): void {
    const parentId = this.selectedIds()[colIdx - 1];
    if (!parentId) return;
    const node = this.asNode(parentId);
    const assembly = node?.assemblyList.find((a) => a.extractedImgId === image.extractedImgId);
    if (!assembly) return;

    EditHotspotsComponent.open(this.dialog, assembly)
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        assembly.hotspotDetails = result.hotspotDetails;
        this.emitChange(parentId, 'UPDATE_HOTSPOTS');
      });
  }
}
