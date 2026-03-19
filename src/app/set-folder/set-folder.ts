import {
  Component,
  signal,
  viewChildren,
  ElementRef,
  effect,
  Output,
  EventEmitter,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
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
import * as Model from './data.model';
import { mockResponse } from './data';
import { Router, ActivatedRoute } from '@angular/router';

/* ─── Local runtime interfaces ─── */

/** INode extended with runtime-only ordering field */
interface INodeRuntime extends Model.INode {
  itemOrder: string[];
}

/**
 * A single ITable enriched with its parent-assembly context so we can
 * locate and toggle isAccepted without extra lookups.
 * tableId is always present at runtime (auto-generated in ngOnInit if missing).
 */
interface ITableRuntime extends Model.ITable {
  tableId: string; // guaranteed non-nullable at runtime
  assemblyExtractedImgId: string; // parent IAssembly.extractedImgId; empty for tableList tables
  pageKey: string; // key in IAssembly.linkedPageProductTable; equals pageId for tableList tables
  pageId: string;
  pageName: string;
  selected?: boolean;
  isPageListTable?: boolean; // true when sourced from assemblyHierarchy.tableList
}

/** IImage extended with checkbox selection state */
interface IImageRuntime extends Model.IImage {
  selected?: boolean;
}

/** Union of all item types that can appear in a hierarchy column */
type ColumnItem = INodeRuntime | Model.IAssembly | IImageRuntime | ITableRuntime;

/** Union of items that live in the available-images panel */
type AvailableImageItem = IImageRuntime | Model.IAssembly;

/** Data attached to each CDK drop-list container */
interface IDropListData {
  parentId: string | null;
  index: number;
}

/** SVG connector line descriptor */
interface IConnection {
  path: string;
  active: boolean;
  invalid: boolean;
}

/** Payload for the onStructureChange output */
interface IStructureChangeEvent {
  nodeId: string;
  action: string;
  timestamp: string;
}

/** Payload for the onAssemblySave output */
interface ISaveEvent {
  updatedAssemblyList: string[];
  deletedAssemblyList: string[];
  rawFileData: Model.IAssemblyHierarchy;
  isHierarchyUpdated: boolean;
}

/* ─── Component ─── */

@Component({
  selector: 'app-set-folder',
  standalone: true,
  imports: [CommonModule, DragDropModule, FormsModule],
  templateUrl: './set-folder.html',
  styleUrls: ['./set-folder.scss'],
})
export class SetFolder implements OnInit, OnChanges {
  @Input() rawFileData!: Model.IAssemblyHierarchy;
  @Input() aiHintsConfig!: Record<string, unknown>;
  @Input() selectedIndex!: number;
  @Output() onStructureChange = new EventEmitter<IStructureChangeEvent>();
  @Output() onAssemblySave = new EventEmitter<ISaveEvent>();

  updatedAssemblyList: string[] = [];
  deletedAssemblyList: string[] = [];
  isHierarchyUpdated = false;
  disableMakeAssembly = signal(true);
  hasValidationErrors = signal(false);

  itemRefs = viewChildren<ElementRef>('itemRef');

  isDragging = signal(false);
  invalidHoverId = signal<string | null>(null);
  invalidReason: string | null = null;

  availableImages = signal<AvailableImageItem[]>([]);
  availableTables = signal<ITableRuntime[]>([]);
  classCodeList = signal<string[]>([]);

  columns = signal<ColumnItem[][]>([]);
  selectedIds = signal<string[]>([]);
  connections = signal<IConnection[]>([]);

  parentMap = new Map<string, string | null>();
  validationErrors = new Map<string, string>();

  // Tracks inner tableIds that were converted from tableList → linkedPageProductTable
  private pageListTableIds = new Set<string>();
  // Stores original IPageTable metadata for each converted tableId (needed for reverse conversion)
  private pageListTableMeta = new Map<string, Model.IPageTable>();

  // Right panel state
  rightPanelOpen = signal(false);
  rightPanelMode = signal<'add' | 'edit'>('add');
  rightPanelFor = signal<string>('');
  editingNodeId = signal<string | null>(null);
  pendingParentId = signal<string | null>(null);

  // Form fields
  assemblyForm = { assemblyName: '', classCode: '', parentClassCode: '', isValid: false };

  // Delete confirmation dialog state
  deleteTargetNode: INodeRuntime | null = null;
  deleteTargetLevel = 0;
  deleteDialogOpen = signal(false);

  // Zoom state
  zoomLevel = signal(0.9);
  minZoom = 0.5;
  maxZoom = 2;
  zoomStep = 0.1;

  // SVG dimensions
  svgWidth = signal(2000);
  svgHeight = signal(1000);
  svgScrollX = signal(0);
  svgScrollY = signal(0);
  formErrorMessage!: string;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) {
    effect((onCleanup) => {
      this.columns();
      this.selectedIds();
      const t = setTimeout(() => this.calculateArrows(), 60);
      onCleanup(() => clearTimeout(t));
    });
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
      setTimeout(() => {
        const levelsArea = document.querySelector('.levels-area');
        if (levelsArea) {
          levelsArea.addEventListener('scroll', handleScroll, { passive: true });
          onCleanup(() => {
            levelsArea.removeEventListener('scroll', handleScroll);
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
    if (!this.rawFileData) {
      this.rawFileData = mockResponse.data.assemblyHierarchy;
    }
    if (this.rawFileData) {
      this.initNodes();
      this.availableImages.set(
        this.rawFileData.imageList.map(
          (img): AvailableImageItem => ('pageNo' in img ? { ...img } : img),
        ),
      );
      this.refreshAvailableTables();
      this.refreshView();
      this.buildParentMap();
      if (this.rawFileData.rootIds.length) {
        this.selectItem(this.rawFileData.nodes[this.rawFileData.rootIds[0]] as INodeRuntime, 0);
      }
      const classCodeArr = Object.values(this.rawFileData.nodes).map((n) => n.classCode);
      this.classCodeList.set([...new Set(classCodeArr)]);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rawFileData'] && this.rawFileData) {
      this.initNodes();
      this.availableImages.set(
        this.rawFileData.imageList.map(
          (img): AvailableImageItem => ('pageNo' in img ? { ...img } : img),
        ),
      );
      this.refreshAvailableTables();
    }
    if (changes['selectedIndex']) {
      this.refreshView();
    }
  }

  /* ================= INIT ================= */

  /** Ensure runtime fields exist on every node and all ITable.tableId are populated */
  private initNodes(): void {
    Object.values(this.rawFileData.nodes).forEach((n: Model.INode) => {
      const node = n as INodeRuntime;
      if (!node.itemOrder) node.itemOrder = [];

      // Guarantee all tables have IDs
      node.assemblyList?.forEach((assembly: Model.IAssembly) => {
        Object.values(
          assembly.linkedPageProductTable ?? ({} as Record<string, Model.ILinkedPageTable>),
        ).forEach((page: Model.ILinkedPageTable) => {
          page.tables?.forEach((table: Model.ITable) => {
            if (!table.tableId) table.tableId = uuidv4();
          });
        });
      });

      // Build initial itemOrder from childIds + assemblyList + accepted tables
      if (node.itemOrder.length === 0) {
        const acceptedTableIds: string[] = [];
        node.assemblyList?.forEach((assembly: Model.IAssembly) => {
          Object.values(
            assembly.linkedPageProductTable ?? ({} as Record<string, Model.ILinkedPageTable>),
          ).forEach((page: Model.ILinkedPageTable) => {
            page.tables?.forEach((table: Model.ITable) => {
              if (table.isAccepted && table.tableId) acceptedTableIds.push(table.tableId);
            });
          });
        });
        node.itemOrder = [
          ...node.childIds,
          ...node.assemblyList.map((a: Model.IAssembly) => a.extractedImgId),
          ...acceptedTableIds,
        ];
      }
    });

    // Reset all tableList tables to unaccepted on init so they appear in the available panel
    this.rawFileData.tableList?.forEach((pt: Model.IPageTable) => {
      pt.tables?.forEach((t: Model.ITable) => {
        t.isAccepted = false;
      });
    });
  }

  /* ================= TABLE HELPERS ================= */

  /** Convert a raw ITable + parent context into a fully-typed ITableRuntime */
  private toTableRuntime(
    table: Model.ITable,
    assemblyExtractedImgId: string,
    pageKey: string,
    page: Model.ILinkedPageTable,
  ): ITableRuntime {
    return {
      ...table,
      tableId: table.tableId!,
      assemblyExtractedImgId,
      pageKey,
      pageId: page.pageId,
      pageName: page.pageName,
    };
  }

  /** Rebuild availableTables from unaccepted linked tables + unaccepted tableList tables */
  private refreshAvailableTables(): void {
    const tables: ITableRuntime[] = [];
    Object.values(this.rawFileData.nodes).forEach((n: Model.INode) => {
      const node = n as INodeRuntime;
      node.assemblyList?.forEach((assembly: Model.IAssembly) => {
        Object.entries(
          assembly.linkedPageProductTable ?? ({} as Record<string, Model.ILinkedPageTable>),
        ).forEach(([pageKey, page]: [string, Model.ILinkedPageTable]) => {
          page.tables?.forEach((table: Model.ITable) => {
            if (!table.isAccepted && table.tableId) {
              tables.push(this.toTableRuntime(table, assembly.extractedImgId, pageKey, page));
            }
          });
        });
      });
    });
    // Also expose unaccepted IPageTable entries from the top-level tableList
    this.rawFileData.tableList?.forEach((pt: Model.IPageTable) => {
      pt.tables?.forEach((table: Model.ITable) => {
        if (!table.isAccepted && table.tableId) {
          tables.push({
            ...table,
            tableId: table.tableId!,
            assemblyExtractedImgId: '', // no parent assembly yet
            pageKey: pt.pageId,         // used as key in linkedPageProductTable on drop
            pageId: pt.pageId,
            pageName: pt.pageName,
            isPageListTable: true,
          });
        }
      });
    });
    this.availableTables.set(tables);
  }

  /** Find the IPageTable in tableList that owns the given inner tableId */
  private findPageTableByTableId(tableId: string): Model.IPageTable | undefined {
    return this.rawFileData.tableList?.find((pt) =>
      pt.tables?.some((t) => t.tableId === tableId),
    );
  }

  /** Collect all ITableRuntime with isAccepted === true for a given node */
  private getAcceptedTablesForNode(node: INodeRuntime): ITableRuntime[] {
    const tables: ITableRuntime[] = [];
    node.assemblyList?.forEach((assembly: Model.IAssembly) => {
      Object.entries(
        assembly.linkedPageProductTable ?? ({} as Record<string, Model.ILinkedPageTable>),
      ).forEach(([pageKey, page]: [string, Model.ILinkedPageTable]) => {
        page.tables?.forEach((table: Model.ITable) => {
          if (table.isAccepted && table.tableId) {
            tables.push(this.toTableRuntime(table, assembly.extractedImgId, pageKey, page));
          }
        });
      });
    });
    return tables;
  }

  /**
   * Find an accepted table by tableId within a node's assemblies.
   * Used by refreshView to map itemOrder IDs back to column items.
   */
  private findAcceptedTableById(node: INodeRuntime, tableId: string): ITableRuntime | undefined {
    for (const assembly of node.assemblyList ?? []) {
      for (const [pageKey, page] of Object.entries(
        assembly.linkedPageProductTable ?? ({} as Record<string, Model.ILinkedPageTable>),
      )) {
        const table = page.tables?.find((t: Model.ITable) => t.tableId === tableId && t.isAccepted);
        if (table) return this.toTableRuntime(table, assembly.extractedImgId, pageKey, page);
      }
    }
    return undefined;
  }

  /**
   * Toggle isAccepted and handle IPageTable ↔ IAssembly.linkedPageProductTable conversion.
   *
   * • assemblyExtractedImgId === '' → tableList table being ACCEPTED into a node:
   *     converts IPageTable → ILinkedPageTable entry in assembly[0], removes from tableList.
   * • assemblyExtractedImgId set + pageListTableIds.has(tableId) → REJECTING a converted table:
   *     reconstructs IPageTable and restores it to tableList, removes from linkedPageProductTable.
   * • Otherwise → standard toggle on a normal linked table.
   */
  private setTableAccepted(
    tableId: string,
    assemblyExtractedImgId: string,
    pageKey: string,
    node: INodeRuntime,
    accepted: boolean,
  ): void {
    // ── ACCEPT: tableList table dropped into a node ──────────────────────────
    if (!assemblyExtractedImgId) {
      const parentPt = this.findPageTableByTableId(tableId);
      if (!parentPt) return;
      const assembly = node.assemblyList?.[0];
      if (!assembly) return;
      if (!assembly.linkedPageProductTable) assembly.linkedPageProductTable = {};
      const lpKey = parentPt.pageId;
      // Convert IPageTable → ILinkedPageTable (all inner tables accepted)
      assembly.linkedPageProductTable[lpKey] = {
        tables: parentPt.tables.map((t) => ({ ...t, isAccepted: true })),
        pageKey: lpKey,
        pageId: parentPt.pageId,
        pageName: parentPt.pageName,
      };
      // Track origin for reverse conversion
      parentPt.tables?.forEach((t) => {
        if (t.tableId) {
          this.pageListTableIds.add(t.tableId);
          this.pageListTableMeta.set(t.tableId, parentPt);
        }
      });
      // Add any sibling table IDs from the same page to itemOrder
      const extraIds = (parentPt.tables ?? [])
        .map((t) => t.tableId!)
        .filter((id) => id && id !== tableId && !node.itemOrder.includes(id));
      node.itemOrder = [...node.itemOrder, ...extraIds];
      // Remove from tableList
      this.rawFileData.tableList = (this.rawFileData.tableList ?? []).filter(
        (pt) => pt.pageId !== parentPt.pageId,
      );
      return;
    }

    // ── REJECT: converted tableList table removed from a node ────────────────
    if (!accepted && this.pageListTableIds.has(tableId)) {
      const assembly = node.assemblyList?.find(
        (a: Model.IAssembly) => a.extractedImgId === assemblyExtractedImgId,
      );
      const linkedPage = assembly?.linkedPageProductTable?.[pageKey];
      if (linkedPage) {
        const meta = this.pageListTableMeta.get(tableId);
        // Reconstruct IPageTable, restoring original metadata
        const restoredPt: Model.IPageTable = {
          ...(meta ?? ({} as Model.IPageTable)),
          tables: linkedPage.tables.map((t) => ({ ...t, isAccepted: false })),
          pageId: linkedPage.pageId,
          pageName: linkedPage.pageName,
          pageNo: meta?.pageNo ?? pageKey,
          tableId,
          type: 'table',
          order: meta?.order ?? 0,
        };
        if (!(this.rawFileData.tableList ?? []).some((pt) => pt.pageId === linkedPage.pageId)) {
          this.rawFileData.tableList = [...(this.rawFileData.tableList ?? []), restoredPt];
        }
        delete assembly!.linkedPageProductTable![pageKey];
        // Clean up all sibling table IDs from itemOrder and tracking maps
        linkedPage.tables?.forEach((t) => {
          if (t.tableId) {
            node.itemOrder = node.itemOrder?.filter((id) => id !== t.tableId) ?? [];
            this.pageListTableIds.delete(t.tableId);
            this.pageListTableMeta.delete(t.tableId);
          }
        });
      }
      return;
    }

    // ── Standard toggle for normal linked tables ─────────────────────────────
    const assembly = node.assemblyList?.find(
      (a: Model.IAssembly) => a.extractedImgId === assemblyExtractedImgId,
    );
    if (!assembly) return;
    const page = assembly.linkedPageProductTable?.[pageKey];
    if (!page) return;
    const table = page.tables?.find((t: Model.ITable) => t.tableId === tableId);
    if (table) table.isAccepted = accepted;
  }

  /* ================= DROP VALIDATION ================= */

  canEnterAssets = (_drag: CdkDrag<ColumnItem>, _drop: CdkDropList<IDropListData>): boolean => {
    return true;
  };

  onDropAssetsInAvailableList(event: CdkDragDrop<IDropListData>): void {
    this.isDragging.set(false);
    this.invalidHoverId.set(null);
    this.clearInvalidReason();

    const item = event.item.data as ColumnItem;
    const isImage = 'extractedImgId' in item && !('assemblyExtractedImgId' in item);
    const isTable = this.isTableItem(item);
    const itemId = isImage
      ? (item as Model.IAssembly).extractedImgId
      : isTable
        ? (item as ITableRuntime).tableId
        : '';

    const source = event.previousContainer.data as IDropListData;
    const target = event.container.data as IDropListData;

    // Reorder within the same assets panel section
    if (source.parentId === target.parentId) {
      if (isImage) {
        moveItemInArray(this.availableImages(), event.previousIndex, event.currentIndex);
      } else if (isTable) {
        moveItemInArray(this.availableTables(), event.previousIndex, event.currentIndex);
      }
      return;
    }

    // Remove from the source column node
    if (source.parentId && source.parentId !== 'IMAGES' && source.parentId !== 'TABLES') {
      this.removeFromModel(source.parentId, itemId, item);
      this.emitChange(source.parentId, 'REMOVE_TO_ASSETS');
    }

    if (isImage) {
      const imgItem = item as AvailableImageItem;
      const images = this.availableImages();
      const exists = images.find((img) => img.extractedImgId === itemId);
      if (!exists) {
        images.splice(event.currentIndex, 0, imgItem);
        this.availableImages.set([...images]);
        this.rawFileData.imageList = this.availableImages();
      }
    }
    // Tables: refreshAvailableTables() was already called inside removeFromModel → no manual push needed

    this.refreshView();
  }

  canEnter = (drag: CdkDrag<ColumnItem>, drop: CdkDropList<IDropListData>): boolean => {
    const item = drag.data;
    const target = drop.data;
    const itemId = this.getItemId(item);

    if (!target?.parentId) {
      if (!this.isNodeItem(item)) {
        this.setInvalidReason(itemId, 'Only folders allowed at root');
        return false;
      }
      return true;
    }

    if (this.isNodeItem(item) && this.isDescendantFast(itemId, target.parentId)) {
      this.setInvalidReason(itemId, 'Cannot drop into its own descendant');
      return false;
    }

    if (this.isTableItem(item)) {
      const targetNode = this.asNode(target.parentId);
      if (item.isPageListTable) {
        // tableList table: target node must have at least one assembly to host it
        if (!targetNode?.assemblyList?.length) {
          this.setInvalidReason(itemId, 'Add an image to this node before adding a standalone table');
          return false;
        }
      } else {
        // Linked table: target node must contain its parent assembly
        const hasAssembly = targetNode?.assemblyList?.some(
          (a: Model.IAssembly) => a.extractedImgId === item.assemblyExtractedImgId,
        );
        if (!hasAssembly) {
          this.setInvalidReason(itemId, "Table's parent assembly is not in this node");
          return false;
        }
      }
    }

    this.clearInvalidReason();
    return true;
  };

  onDrop(event: CdkDragDrop<IDropListData>): void {
    this.isDragging.set(false);
    this.invalidHoverId.set(null);
    this.clearInvalidReason();

    const item = event.item.data as ColumnItem;
    const itemId = this.getItemId(item);
    const source = event.previousContainer.data as IDropListData;
    const target = event.container.data as IDropListData;

    if (
      !this.canEnter(
        { data: item } as CdkDrag<ColumnItem>,
        { data: target } as CdkDropList<IDropListData>,
      )
    )
      return;

    if (event.previousContainer === event.container) {
      // Reorder within same column
      const node = target.parentId
        ? (this.rawFileData.nodes[target.parentId] as INodeRuntime)
        : null;
      const orderArray = target.parentId ? node!.itemOrder : this.rawFileData.rootIds;
      const sortedOrder = this.sortItemsInOrder(orderArray, target.parentId);

      if (target.parentId && node) {
        node.itemOrder = sortedOrder;
      } else {
        this.rawFileData.rootIds = sortedOrder;
      }
      this.emitChange(target.parentId, 'REORDER');
    } else {
      if (source.parentId === 'IMAGES' || source.parentId === 'TABLES') {
        const itemCopy = { ...item } as ColumnItem;
        this.addToModel(target.parentId, itemId, itemCopy, event.currentIndex);
        this.emitChange(target.parentId, 'ADD_FROM_ASSETS');

        if (source.parentId === 'IMAGES') {
          const images = this.availableImages();
          const index = images.findIndex((el) => el.extractedImgId === itemId);
          if (index > -1) {
            images.splice(index, 1);
            this.availableImages.set([...images]);
            this.rawFileData.imageList = this.availableImages();
          }
        }
        // TABLES: availableTables is rebuilt by refreshAvailableTables() inside addToModel
      } else {
        // Transfer between columns
        this.removeFromModel(source.parentId, itemId, item);
        this.addToModel(target.parentId, itemId, item, event.currentIndex);
        this.updateParentMapForMovedItem(itemId, target.parentId);
        this.updateSelectionAfterMove(itemId, source.index, target.index);
        this.emitChange(source.parentId, 'TRANSFER_OUT');
        this.emitChange(target.parentId, 'TRANSFER_IN');
      }
    }

    this.refreshView();
    requestAnimationFrame(() => {
      this.calculateArrows();
      setTimeout(() => this.calculateArrows(), 50);
      setTimeout(() => this.calculateArrows(), 150);
    });
  }

  /* ================= TYPE GUARDS & ID HELPERS ================= */

  private isNodeItem(item: ColumnItem): item is INodeRuntime {
    return 'hierarchyId' in item;
  }

  private isAssemblyItem(item: ColumnItem): item is Model.IAssembly | IImageRuntime {
    return (
      'extractedImgId' in item && !('hierarchyId' in item) && !('assemblyExtractedImgId' in item)
    );
  }

  private isTableItem(item: ColumnItem): item is ITableRuntime {
    return 'assemblyExtractedImgId' in item;
  }

  private getItemId(item: ColumnItem): string {
    if (this.isNodeItem(item)) return item.hierarchyId;
    if (this.isTableItem(item)) return item.tableId;
    if (this.isAssemblyItem(item)) return item.extractedImgId;
    return '';
  }

  private asNode(nodeId: string): INodeRuntime {
    return this.rawFileData.nodes[nodeId] as INodeRuntime;
  }

  /* ================= SORTING LOGIC ================= */

  private sortItemsInOrder(itemIds: string[], parentId: string | null): string[] {
    const items = itemIds.map((id) => {
      const node = this.rawFileData.nodes[id];
      if (node) return { id, type: 'folder' as const };

      if (parentId) {
        const parent = this.asNode(parentId);
        const image = parent.assemblyList?.find((i: Model.IAssembly) => i.extractedImgId === id);
        if (image) return { id, type: 'image' as const };
        const table = this.findAcceptedTableById(parent, id);
        if (table) return { id, type: 'table' as const };
      }

      return { id, type: 'unknown' as const };
    });

    const typeOrder: Record<string, number> = { folder: 0, image: 1, table: 2, unknown: 3 };
    items.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
    return items.map((i) => i.id);
  }

  /* ================= VALIDATION ================= */

  private validateNode(node: INodeRuntime): void {
    if (!node.hierarchyId) return;
    const hasImages = (node.assemblyList?.length ?? 0) > 0;
    const acceptedTables = this.getAcceptedTablesForNode(node);
    const hasTables = acceptedTables.length > 0;

    // Clear previous errors for this node's items first
    acceptedTables.forEach((t) => this.validationErrors.delete(t.tableId));
    node.assemblyList?.forEach((a: Model.IAssembly) =>
      this.validationErrors.delete(a.extractedImgId),
    );

    // Table exists without an image
    if (hasTables && !hasImages) {
      acceptedTables.forEach((t) => {
        this.validationErrors.set(t.tableId, 'Table exists without any image');
      });
    }

    // Image exists without a table
    if (hasImages && !hasTables) {
      node.assemblyList.forEach((a: Model.IAssembly) => {
        this.validationErrors.set(a.extractedImgId, 'Image exists without any table');
      });
    }
  }

  hasValidationError(item: ColumnItem, _colIdx: number): boolean {
    const id = this.isTableItem(item)
      ? item.tableId
      : this.isAssemblyItem(item)
        ? item.extractedImgId
        : null;
    return id ? this.validationErrors.has(id) : false;
  }

  getValidationError(item: ColumnItem, _colIdx: number): string {
    const id = this.isTableItem(item)
      ? item.tableId
      : this.isAssemblyItem(item)
        ? item.extractedImgId
        : null;
    return id ? (this.validationErrors.get(id) ?? '') : '';
  }

  /* ================= PERFORMANCE ================= */

  buildParentMap(): void {
    this.parentMap.clear();
    Object.values(this.rawFileData.nodes).forEach((n: Model.INode) => {
      const node = n as INodeRuntime;
      node.childIds?.forEach((id: string) => this.parentMap.set(id, node.hierarchyId));
      node.assemblyList?.forEach((i: Model.IAssembly) =>
        this.parentMap.set(i.extractedImgId, node.hierarchyId),
      );
      this.getAcceptedTablesForNode(node).forEach((t) => {
        this.parentMap.set(t.tableId, node.hierarchyId);
      });
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

  isInCompleteAssembly(item: ColumnItem, colIdx: number): boolean {
    if (this.isNodeItem(item)) return false;
    const parentId = this.selectedIds()[colIdx - 1];
    if (!parentId) return false;
    const parentNode = this.asNode(parentId);
    if (!parentNode) return false;
    const acceptedTables = this.getAcceptedTablesForNode(parentNode);
    return (parentNode.assemblyList?.length ?? 0) > 0 && acceptedTables.length > 0;
  }

  setInvalidReason(id: string, reason: string): void {
    this.invalidHoverId.set(id);
    this.invalidReason = reason;
  }

  clearInvalidReason(): void {
    this.invalidReason = null;
  }

  /* ================= VIEW / DATA ================= */

  refreshView(): void {
    this.buildParentMap();
    this.validationErrors.clear();

    const cols: ColumnItem[][] = [];

    const sortedRootIds = this.sortItemsInOrder(this.rawFileData.rootIds, null);
    this.rawFileData.rootIds = sortedRootIds;
    cols.push(sortedRootIds.map((id) => this.asNode(id)).filter((n): n is INodeRuntime => !!n));

    this.selectedIds().forEach((parentId) => {
      const node = this.asNode(parentId);
      if (!node?.hierarchyId) return;

      this.validateNode(node);

      const sortedOrder = this.sortItemsInOrder(node.itemOrder ?? [], parentId);
      node.itemOrder = sortedOrder;

      const col: ColumnItem[] = sortedOrder
        .map((id: string) => {
          const childNode = this.rawFileData.nodes[id];
          if (childNode) return childNode as INodeRuntime;
          const img = node.assemblyList?.find((i: Model.IAssembly) => i.extractedImgId === id);
          if (img) return img;
          return this.findAcceptedTableById(node, id) ?? undefined;
        })
        .filter((item): item is INodeRuntime | Model.IAssembly | ITableRuntime => item != null);

      // Append any accepted tables whose IDs aren't yet tracked in itemOrder
      this.getAcceptedTablesForNode(node).forEach((t) => {
        if (!node.itemOrder.includes(t.tableId)) {
          node.itemOrder.push(t.tableId);
          col.push(t);
        }
      });

      cols.push(col);
    });

    Object.values(this.rawFileData.nodes).forEach((n: Model.INode) =>
      this.validateNode(n as INodeRuntime),
    );

    this.columns.set(cols);
    this.hasValidationErrors.set(this.validationErrors.size > 0);
  }

  selectItem(item: ColumnItem, colIdx: number): void {
    const id = this.getItemId(item);
    const sel = this.selectedIds().slice(0, colIdx);
    sel[colIdx] = id;

    if (colIdx === 0 && this.isNodeItem(item)) {
      this.expandFirstChildren(sel, item);
    }

    this.selectedIds.set(sel);
    this.refreshView();
  }

  private expandFirstChildren(sel: string[], currentItem: INodeRuntime): void {
    let current: INodeRuntime | undefined = currentItem;
    let level = 0;

    while (current?.hierarchyId) {
      const node = this.asNode(current.hierarchyId);
      if (!node?.itemOrder?.length) break;

      const firstChildId = node.itemOrder.find((id) => !!this.rawFileData.nodes[id]?.hierarchyId);
      if (!firstChildId) break;

      const firstChild = this.rawFileData.nodes[firstChildId] as INodeRuntime;
      if (!firstChild) break;

      level++;
      sel[level] = firstChild.hierarchyId;
      current = firstChild;
    }
  }

  /* ================= MUTATIONS ================= */

  deleteAsset(asset: Model.IAssembly | ITableRuntime, parentId: string): void {
    if (!parentId) return;
    const node = this.asNode(parentId);
    const isImage = 'extractedImgId' in asset && !('assemblyExtractedImgId' in asset);
    const assetId = isImage
      ? (asset as Model.IAssembly).extractedImgId
      : (asset as ITableRuntime).tableId;

    node.itemOrder = node.itemOrder?.filter((id) => id !== assetId) ?? [];

    if (isImage) {
      const imgAsset = asset as Model.IAssembly;
      // Reset any accepted tables from this assembly before removing it
      const assemblyInNode = node.assemblyList?.find(
        (i: Model.IAssembly) => i.extractedImgId === assetId,
      );
      if (assemblyInNode) {
        Object.values(assemblyInNode.linkedPageProductTable ?? {}).forEach(
          (page: Model.ILinkedPageTable) => {
            page.tables?.forEach((table: Model.ITable) => {
              if (table.isAccepted && table.tableId) {
                table.isAccepted = false;
                node.itemOrder = node.itemOrder?.filter((id) => id !== table.tableId) ?? [];
              }
            });
          },
        );
      }
      const alreadyAvailable =
        this.availableImages().findIndex((el) => el.extractedImgId === imgAsset.extractedImgId) !==
        -1;
      if (!alreadyAvailable) {
        const value = node.assemblyList?.find((i: Model.IAssembly) => i.extractedImgId === assetId);
        if (value) {
          // Clear parent context before returning to available assets
          if (value.classCodeInfo) value.classCodeInfo.parentClassCode = '';
          this.availableImages.update((list) => [...list, { ...value }]);
          this.rawFileData.imageList = this.availableImages();
        }
      }
      node.assemblyList =
        node.assemblyList?.filter((i: Model.IAssembly) => i.extractedImgId !== assetId) ?? [];
      this.refreshAvailableTables();
    } else {
      // Table: flip isAccepted to false — it will re-appear in availableTables
      const tbl = asset as ITableRuntime;
      this.setTableAccepted(tbl.tableId, tbl.assemblyExtractedImgId, tbl.pageKey, node, false);
      this.refreshAvailableTables();
    }

    this.emitChange(parentId, 'DELETE');
    this.refreshView();
  }

  openHotspotEditor(
    _asset: Model.IAssembly | ITableRuntime,
    _hierarchyId: string,
    _columns: ColumnItem[][],
  ): void {
    // Hotspot editor dialog integration point
  }

  private removeFromModel(parentId: string | null, itemId: string, item: ColumnItem): void {
    if (parentId) {
      const node = this.asNode(parentId);
      node.itemOrder = node.itemOrder?.filter((id) => id !== itemId) ?? [];
      node.childIds = node.childIds.filter((id) => id !== itemId);
      // Assembly being removed: reset its accepted tables before removing
      if (this.isAssemblyItem(item)) {
        const assembly = node.assemblyList?.find(
          (a: Model.IAssembly) => a.extractedImgId === itemId,
        );
        if (assembly) {
          Object.values(assembly.linkedPageProductTable ?? {}).forEach(
            (page: Model.ILinkedPageTable) => {
              page.tables?.forEach((table: Model.ITable) => {
                if (table.isAccepted && table.tableId) {
                  table.isAccepted = false;
                  node.itemOrder = node.itemOrder?.filter((id) => id !== table.tableId) ?? [];
                }
              });
            },
          );
          this.refreshAvailableTables();
        }
      }

      node.assemblyList =
        node.assemblyList?.filter((i: Model.IAssembly) => i.extractedImgId !== itemId) ?? [];

      // Table: set isAccepted = false so it returns to availableTables
      if (this.isTableItem(item)) {
        this.setTableAccepted(item.tableId, item.assemblyExtractedImgId, item.pageKey, node, false);
        this.refreshAvailableTables();
      }

      // Node being detached: clear parentClassCode on all its assemblies
      if (this.isNodeItem(item)) {
        const detachedNode = this.asNode(itemId);
        detachedNode?.assemblyList?.forEach((assembly: Model.IAssembly) => {
          if (assembly.classCodeInfo) assembly.classCodeInfo.parentClassCode = '';
        });
      }
    } else {
      this.rawFileData.rootIds = this.rawFileData.rootIds.filter((id) => id !== itemId);
    }
  }

  private addToModel(
    parentId: string | null,
    itemId: string,
    item: ColumnItem,
    index: number,
  ): void {
    if (parentId) {
      const node = this.asNode(parentId);
      if (!node.itemOrder) node.itemOrder = [];
      if (!node.assemblyList) node.assemblyList = [];

      node.itemOrder.splice(index, 0, itemId);

      if (this.isNodeItem(item)) {
        const targetNode = this.asNode(itemId);
        targetNode.parentClassCode = node.classCode;
        targetNode.parentHierarchyId = node.hierarchyId;
        // Propagate new parentClassCode into every assembly inside the moved node
        targetNode.assemblyList?.forEach((assembly: Model.IAssembly) => {
          if (assembly.classCodeInfo) assembly.classCodeInfo.parentClassCode = node.classCode;
        });
        node.childIds.push(itemId);
      } else if (this.isTableItem(item)) {
        // Set isAccepted = true on the table inside the assembly
        this.setTableAccepted(item.tableId, item.assemblyExtractedImgId, item.pageKey, node, true);
        this.refreshAvailableTables();
      } else if (this.isAssemblyItem(item)) {
        node.assemblyList.push(item as Model.IAssembly);
        this.refreshAvailableTables();
      }

      node.itemOrder = this.sortItemsInOrder(node.itemOrder, parentId);
    } else {
      this.rawFileData.rootIds.splice(index, 0, itemId);
      const rootNode = this.rawFileData.nodes[itemId] as INodeRuntime;
      rootNode.parentClassCode = this.rawFileData.classRoot;
      // Propagate classRoot as parentClassCode into every assembly
      rootNode.assemblyList?.forEach((assembly: Model.IAssembly) => {
        if (assembly.classCodeInfo)
          assembly.classCodeInfo.parentClassCode = this.rawFileData.classRoot;
      });
      this.rawFileData.rootIds = this.sortItemsInOrder(this.rawFileData.rootIds, null);
    }
  }

  /* ================= SVG ================= */

  calculateArrows(): void {
    const lines: IConnection[] = [];
    const els = this.itemRefs();
    const active = this.selectedIds();
    const dragging = this.isDragging();
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
        (e) => e.nativeElement.dataset.id === pid && e.nativeElement.dataset.level === String(i),
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
            e.nativeElement.dataset.id === cid && e.nativeElement.dataset.level === String(i + 1),
        )?.nativeElement as HTMLElement | undefined;
        if (!cEl) return;

        const itemType = cEl.getAttribute('data-type');
        if (itemType === 'table') return;
        const isImage = itemType === 'image';

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
          active: active[i + 1] === cid || isImage,
          invalid: dragging && this.invalidHoverId() === cid,
        });
      });
    });

    this.connections.set(lines);
  }

  /* ================= SELECTION & PARENT UPDATE ================= */

  private updateParentMapForMovedItem(itemId: string, newParentId: string | null): void {
    this.parentMap.set(itemId, newParentId);
    const node = this.rawFileData.nodes[itemId] as INodeRuntime | undefined;
    if (node?.hierarchyId) {
      this.updateDescendantParents(node);
    }
  }

  private updateDescendantParents(node: INodeRuntime): void {
    if (!node?.hierarchyId) return;
    node.childIds?.forEach((childId: string) => {
      this.parentMap.set(childId, node.hierarchyId);
      const childNode = this.rawFileData.nodes[childId] as INodeRuntime | undefined;
      if (childNode) this.updateDescendantParents(childNode);
    });
    node.assemblyList?.forEach((img: Model.IAssembly) =>
      this.parentMap.set(img.extractedImgId, node.hierarchyId),
    );
    this.getAcceptedTablesForNode(node).forEach((t) => {
      this.parentMap.set(t.tableId, node.hierarchyId);
    });
  }

  private updateSelectionAfterMove(
    movedItemId: string,
    sourceColIndex: number,
    targetColIndex: number,
  ): void {
    const currentSelection = this.selectedIds();
    const movedItemIndex = currentSelection.indexOf(movedItemId);
    if (movedItemIndex !== -1) {
      const newSelection = currentSelection.slice(0, movedItemIndex);
      if (targetColIndex < sourceColIndex) {
        newSelection[targetColIndex] = movedItemId;
      }
      this.selectedIds.set(newSelection);
    }
  }

  private emitChange(nodeId: string | null, action: string): void {
    if (
      [
        'TRANSFER_IN',
        'TRANSFER_OUT',
        'DELETE_ASSEMBLY',
        'UPDATE_ASSEMBLY',
        'ADD_ASSEMBLY',
        'ADD_FROM_ASSETS',
        'REMOVE_TO_ASSETS',
        'DELETE',
      ].includes(action)
    ) {
      this.isHierarchyUpdated = true;
    }
    if (
      ['HOTSPOT_UPDATED', 'ADD_FROM_ASSETS', 'REMOVE_TO_ASSETS', 'DELETE'].includes(action) &&
      nodeId
    ) {
      this.updatedAssemblyList = [...new Set([nodeId, ...this.updatedAssemblyList])];
    }
    if (action === 'DELETE_ASSEMBLY' && nodeId) {
      this.deletedAssemblyList = [...new Set([nodeId, ...this.deletedAssemblyList])];
    }
    if (nodeId) {
      this.onStructureChange.emit({ nodeId, action, timestamp: new Date().toISOString() });
    }
    this.disableMakeAssembly.set(false);
  }

  /* ================= RIGHT PANEL MANAGEMENT ================= */

  openAddPanel(parentId: string | null, levelIndex: number, assemblytype: string): void {
    void levelIndex;
    this.rightPanelFor.set(assemblytype);
    this.rightPanelMode.set('add');
    this.pendingParentId.set(parentId);
    this.editingNodeId.set(null);
    this.assemblyForm = { assemblyName: '', classCode: '', parentClassCode: '', isValid: false };
    this.rightPanelOpen.set(true);
  }

  openEditPanel(node: INodeRuntime): void {
    this.rightPanelMode.set('edit');
    this.editingNodeId.set(node.hierarchyId);
    this.pendingParentId.set(null);
    this.assemblyForm = {
      assemblyName: node.assemblyName ?? '',
      classCode: node.classCode ?? '',
      parentClassCode: node.parentClassCode ?? '',
      isValid: false,
    };
    this.rightPanelOpen.set(true);
  }

  onField1Change(value: string): void {
    this.assemblyForm.assemblyName = value ?? '';

    if (this.rightPanelMode() === 'add') {
      this.assemblyForm.classCode = 'CLASS_' + this.toClassName(this.assemblyForm.assemblyName);
    }

    const isEdit = this.rightPanelMode() === 'edit';
    const classCodeConflict = !isEdit && this.classCodeList().includes(this.assemblyForm.classCode);

    if (this.assemblyForm.assemblyName && !classCodeConflict) {
      this.assemblyForm.isValid = true;
      this.formErrorMessage = '';
    } else {
      this.assemblyForm.isValid = false;
      if (!this.assemblyForm.assemblyName) {
        this.formErrorMessage = 'Please enter required fields.';
      } else if (classCodeConflict) {
        this.formErrorMessage = 'Class code exists, try different name';
      }
    }
  }

  private toClassName(value: string): string {
    return (value ?? '').trim().replace(/\s+/g, '_').toUpperCase();
  }

  closeRightPanel(): void {
    this.rightPanelOpen.set(false);
    this.assemblyForm = { assemblyName: '', classCode: '', parentClassCode: '', isValid: false };
  }

  submitAssemblyForm(): void {
    if (this.rightPanelMode() === 'add') {
      this.createNewNode();
    } else {
      this.updateExistingNode();
    }
    this.closeRightPanel();
  }

  /* ================= ADD/UPDATE NODE ================= */

  createNewNode(): void {
    const newId = uuidv4();
    const parentId = this.pendingParentId();

    const newNode: INodeRuntime = {
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
      itemOrder: [],
    };

    this.rawFileData.nodes[newId] = newNode;

    if (!parentId) {
      this.rawFileData.rootIds.push(newId);
      this.rawFileData.rootIds = this.sortItemsInOrder(this.rawFileData.rootIds, null);
    } else {
      const parentNode = this.asNode(parentId);
      parentNode.childIds.push(newId);
      if (!parentNode.itemOrder) parentNode.itemOrder = [];
      parentNode.itemOrder.push(newId);
      parentNode.itemOrder = this.sortItemsInOrder(parentNode.itemOrder, parentId);
    }

    this.classCodeList.update((list) => [...list, this.assemblyForm.classCode]);
    this.buildParentMap();
    this.emitChange(parentId, 'ADD_ASSEMBLY');
    this.refreshView();
    setTimeout(() => this.calculateArrows(), 100);
  }

  updateExistingNode(): void {
    const nodeId = this.editingNodeId();
    if (!nodeId) return;
    const node = this.rawFileData.nodes[nodeId];
    if (!node) return;
    node.assemblyName = this.assemblyForm.assemblyName;
    node.classCode = this.assemblyForm.classCode;
    this.emitChange(nodeId, 'UPDATE_ASSEMBLY');
    this.refreshView();
  }

  addAssembly(parentId: string | null, levelIndex: number, assemblytype: string): void {
    this.openAddPanel(parentId, levelIndex, assemblytype);
  }

  addSubAssembly(parentId: string | null, levelIndex: number, assemblytype: string): void {
    this.openAddPanel(parentId, levelIndex, assemblytype);
  }

  /* ================= DELETE NODE ================= */

  openDeleteConfirmation(node: INodeRuntime, levelIndex: number): void {
    this.deleteTargetNode = node;
    this.deleteTargetLevel = levelIndex;
    this.deleteDialogOpen.set(true);
  }

  closeDeleteDialog(): void {
    this.deleteDialogOpen.set(false);
    this.deleteTargetNode = null;
    this.deleteTargetLevel = 0;
  }

  confirmDeleteNode(): void {
    if (!this.deleteTargetNode) return;
    const nodeId = this.deleteTargetNode.hierarchyId;
    const levelIndex = this.deleteTargetLevel;
    const parentId = levelIndex === 0 ? null : this.selectedIds()[levelIndex - 1];

    if (!parentId) {
      this.rawFileData.rootIds = this.rawFileData.rootIds.filter((id) => id !== nodeId);
    } else {
      const parentNode = this.asNode(parentId);
      if (parentNode) {
        parentNode.childIds = parentNode.childIds.filter((id) => id !== nodeId);
        parentNode.itemOrder = parentNode.itemOrder?.filter((id) => id !== nodeId) ?? [];
      }
    }

    this.recursiveDeleteNode(nodeId);

    const currentSelection = this.selectedIds();
    const deletedIndex = currentSelection.indexOf(nodeId);
    if (deletedIndex !== -1) {
      this.selectedIds.set(currentSelection.slice(0, deletedIndex));
    }

    this.buildParentMap();
    this.emitChange(nodeId, 'DELETE_ASSEMBLY');
    this.refreshView();
    this.closeDeleteDialog();
    setTimeout(() => this.calculateArrows(), 100);
  }

  private recursiveDeleteNode(nodeId: string): void {
    const node = this.rawFileData.nodes[nodeId] as INodeRuntime | undefined;
    if (!node) return;

    // Remove classCode from list
    const index = this.classCodeList().indexOf(node.classCode);
    if (index > -1) {
      this.classCodeList.update((list) => {
        list.splice(index, 1);
        return [...list];
      });
    }

    // Return assemblyList images to available images panel, clearing parent context
    if (node.assemblyList?.length) {
      node.assemblyList.forEach((assembly: Model.IAssembly) => {
        if (assembly.classCodeInfo) assembly.classCodeInfo.parentClassCode = '';
      });
      this.availableImages.update((list) => [
        ...list,
        ...node.assemblyList.map((item: Model.IAssembly): AvailableImageItem => item),
      ]);
      this.rawFileData.imageList = this.availableImages();
    }

    // Collect accepted tables and move them to availableTables BEFORE the node is deleted,
    // because refreshAvailableTables() traverses rawFileData.nodes which won't contain
    // this node after deletion.
    const freedTables: ITableRuntime[] = [];
    node.assemblyList?.forEach((assembly: Model.IAssembly) => {
      Object.entries(
        assembly.linkedPageProductTable ?? ({} as Record<string, Model.ILinkedPageTable>),
      ).forEach(([pageKey, page]: [string, Model.ILinkedPageTable]) => {
        // Check once per page entry whether it was converted from tableList
        const isPageListEntry = page.tables?.some(
          (t) => t.tableId && this.pageListTableIds.has(t.tableId),
        );
        if (isPageListEntry) {
          // Restore the whole page back to tableList and expose it in available panel
          const firstId = page.tables?.find((t) => t.tableId)?.tableId;
          const meta = firstId ? this.pageListTableMeta.get(firstId) : undefined;
          const restoredPt: Model.IPageTable = {
            ...(meta ?? ({} as Model.IPageTable)),
            tables: page.tables.map((t) => ({ ...t, isAccepted: false })),
            pageId: page.pageId,
            pageName: page.pageName,
            pageNo: meta?.pageNo ?? pageKey,
            tableId: firstId ?? '',
            type: 'table',
            order: meta?.order ?? 0,
          };
          if (!(this.rawFileData.tableList ?? []).some((pt) => pt.pageId === page.pageId)) {
            this.rawFileData.tableList = [...(this.rawFileData.tableList ?? []), restoredPt];
          }
          page.tables?.forEach((t) => {
            if (t.tableId) {
              // Expose immediately as an available item
              freedTables.push({
                ...t,
                tableId: t.tableId!,
                assemblyExtractedImgId: '',
                pageKey: page.pageId,
                pageId: page.pageId,
                pageName: page.pageName,
                isPageListTable: true,
              });
              this.pageListTableIds.delete(t.tableId);
              this.pageListTableMeta.delete(t.tableId);
            }
          });
        } else {
          page.tables?.forEach((table: Model.ITable) => {
            if (table.tableId) {
              if (table.isAccepted) {
                freedTables.push(
                  this.toTableRuntime(table, assembly.extractedImgId, pageKey, page),
                );
              }
              table.isAccepted = false;
            }
          });
        }
      });
    });
    if (freedTables.length) {
      this.availableTables.update((list) => [...list, ...freedTables]);
    }

    // Recursively delete child nodes, but skip any that also exist as root-level items
    // (they appear in both rootIds and as children - they should survive the parent deletion)
    node.childIds?.forEach((childId: string) => {
      if (!this.rawFileData.rootIds.includes(childId)) {
        this.recursiveDeleteNode(childId);
      }
    });

    delete this.rawFileData.nodes[nodeId];
    this.parentMap.delete(nodeId);

    node.assemblyList?.forEach((img: Model.IAssembly) => {
      this.validationErrors.delete(img.extractedImgId);
      this.parentMap.delete(img.extractedImgId);
    });
  }

  /* ================= ZOOM CONTROLS ================= */

  zoomIn(): void {
    this.zoomLevel.set(Number(Math.min(this.zoomLevel() + this.zoomStep, this.maxZoom).toFixed(1)));
    setTimeout(() => this.refreshView(), 100);
  }

  zoomOut(): void {
    this.zoomLevel.set(Number(Math.max(this.zoomLevel() - this.zoomStep, this.minZoom).toFixed(1)));
    setTimeout(() => this.refreshView(), 100);
  }

  resetZoom(): void {
    this.zoomLevel.set(1);
    setTimeout(() => this.refreshView(), 100);
  }

  /* ================= SAVE ================= */

  saveHierarchy(): void {
    let obj = {
      updatedAssemblyList: this.updatedAssemblyList.filter(
        (el) => !this.deletedAssemblyList.includes(el),
      ),
      deletedAssemblyList: this.deletedAssemblyList,
      rawFileData: this.rawFileData,
      isHierarchyUpdated: this.isHierarchyUpdated,
    };
    console.log(obj);
    this.onAssemblySave.emit(obj);
  }

  goback(): void {
    this.router.navigate(['../../../../../'], { relativeTo: this.activatedRoute });
  }
}
