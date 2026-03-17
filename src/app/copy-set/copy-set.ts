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
  SimpleChange,
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
import { MatIcon } from '@angular/material/icon';
import * as AssemblyModel from './model';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
// import { TwoDSvgEditorComponent } from '../two-d-svg-editor/two-d-svg-editor.component';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-assembly-v1-driller',
  standalone: true,
  imports: [CommonModule, DragDropModule, FormsModule, MatIcon],
  templateUrl: './copy-set.html',
  styleUrls: ['./copy-set.scss'],
})
export class DrillerComponent implements OnInit, OnChanges {
  @Input() rawFileData!: AssemblyModel.IAssemblyHierarchy;
  @Input() aiHintsConfig!: any;
  @Input() selectedIndex!: any;
  @Output() onStructureChange = new EventEmitter<any>();
  @Output() onAssemblySave = new EventEmitter<any>();
  updatedAssemblyList: string[] = [];
  deletedAssemblyList: string[] = [];
  isHierarchyUpdated: boolean = false;
  disableMakeAssembly = signal(true);

  itemRefs = viewChildren<ElementRef>('itemRef');

  isDragging = signal(false);
  invalidHoverId = signal<string | null>(null);
  invalidReason: string | null = null;

  availableImages = signal<AssemblyModel.IExtractedImage[]>([]);
  // Transform TABLES to flatten the nested structure
  availableTables = signal<AssemblyModel.ITablePage[]>([]);
  classCodeList = signal<string[]>([]);

  columns = signal<any[][]>([]);
  selectedIds = signal<string[]>([]);
  connections = signal<{ path: string; active: boolean; invalid?: boolean }[]>([]);

  parentMap = new Map<string, string | null>();
  validationErrors = new Map<string, string>();

  // Right panel state
  rightPanelOpen = signal(false);
  rightPanelMode = signal<'add' | 'edit'>('add');
  rightPanelFor = signal<string>('');
  editingAssemblyId = signal<string | null>(null);
  pendingParentId = signal<string | null>(null);

  // Form fields
  assemblyForm = {
    assemblyName: '',
    classCode: '',
    parentClassCode: '',
    isValid: false,
  };

  // Delete confirmation dialog state
  deleteDialogOpen = signal(false);
  deleteTargetAssembly: any = null;
  deleteTargetLevel: number = 0;

  // Zoom state
  zoomLevel = signal(0.9);
  minZoom = 0.5;
  maxZoom = 2;
  zoomStep = 0.1;

  // SVG dimensions for connector layer
  svgWidth = signal(2000);
  svgHeight = signal(1000);
  svgScrollX = signal(0);
  svgScrollY = signal(0);
  formErrorMessage!: string;

  constructor(
    private dialog: MatDialog,
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) {
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

  ngOnInit() {
    if (this.rawFileData) {
      this.refreshView();
      this.buildParentMap();
      if (this.rawFileData.rootIds.length) {
        this.selectItem(this.rawFileData.nodes[this.rawFileData.rootIds[0]], 0);
      }
      let classCodeArr = [];
      if (this.rawFileData.nodes) {
        for (let node in this.rawFileData.nodes) {
          classCodeArr.push(this.rawFileData.nodes[node].classCode);
        }
        this.classCodeList.update((value: string[]) => [...new Set([...classCodeArr])]);
      }
      console.log(this.rawFileData);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['rawFileData']) {
      this.rawFileData = this.rawFileData;
      this.availableTables.set(
        this.rawFileData.tableList.map((el: any) => {
          return {
            ...el,
            tableName: el.tables?.[0]?.tableName,
            tableNameAsInPDF: el.tables?.[0]?.tableNameAsInPDF,
          };
        }),
      );
      for (let node in this.rawFileData.nodes) {
        if (this.rawFileData.nodes[node].tables.length > 0) {
          this.rawFileData.nodes[node].tables = this.rawFileData.nodes[node].tables.map(
            (el: AssemblyModel.ITablePage) => {
              return {
                ...el,
                tables: el?.tables?.map((value: AssemblyModel.IExtractedTable) => {
                  return {
                    ...value,
                    pageId: el.pageId,
                    pageName: el.pageName,
                    pageNo: el.pageNo,
                  };
                }),
              };
            },
          );
        }
      }
      this.rawFileData.tableList = this.availableTables();
      this.availableImages.set([...this.rawFileData.imageList]);
    }
    if (changes['selectedIndex']) {
      this.refreshView();
    }
  }

  /* ================= DROP VALIDATION ================= */

  canEnterAssets = (drag: CdkDrag, drop: CdkDropList): boolean => {
    // Items can always return to the assets column
    return true;
  };

  onDropAssetsInAvailableList(event: CdkDragDrop<any>) {
    this.isDragging.set(false);
    this.invalidHoverId.set(null);
    this.clearInvalidReason();

    const item = event.item.data;
    const itemId = item.extractedImgId || item.tableId;
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
        this.rawFileData.imageList = this.availableImages();
      }
    } else {
      const tables = this.availableTables();
      const exists = tables.find((tbl: any) => tbl.tableId === itemId);
      if (!exists) {
        tables.splice(event.currentIndex, 0, item);
        this.availableTables.set([...tables]);
        this.rawFileData.tableList = this.availableTables();
      }
    }

    this.refreshView();
  }

  canEnter = (drag: CdkDrag, drop: CdkDropList): boolean => {
    const item = drag.data;
    const target = drop.data;
    const itemId = item.assemblyId || item.extractedImgId || item.tableId;

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
    const itemId = item.assemblyId || item.extractedImgId || item.tableId;
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
        if (source.parentId === 'IMAGES') {
          let images = this.availableImages();
          let index = images.findIndex(
            (el: AssemblyModel.IExtractedImage) => el.extractedImgId === itemId,
          );
          if (index > -1) {
            images.splice(index, 1);
            this.availableImages.set([...images]);
            this.rawFileData.imageList = this.availableImages();
          }
        }
        if (source.parentId === 'TABLES') {
          let tables = this.availableTables();
          let index = tables.findIndex((el: AssemblyModel.ITablePage) => el.tableId === itemId);
          if (index > -1) {
            tables.splice(index, 1);
            this.availableTables.set([...tables]);
            this.rawFileData.tableList = this.availableTables();
          }
        }
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

        const table = this.findTableById(parent?.tables, id);
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
    const hasTables = node.tables?.some((page: any) => page.tables?.length > 0);

    if (hasTables && !hasImages) {
      node.tables?.forEach((page: any) => {
        page.tables?.forEach((table: any) => {
          this.validationErrors.set(table.tableId, 'Table exists without any image');
        });
      });
    } else {
      node.tables?.forEach((page: any) => {
        page.tables?.forEach((table: any) => {
          this.validationErrors.delete(table.tableId);
        });
      });
    }
  }

  hasValidationError(item: any, colIdx: number): boolean {
    const id = item.tableId || item.extractedImgId;
    return id ? this.validationErrors.has(id) : false;
  }

  getValidationError(item: any, colIdx: number): string {
    const id = item.tableId || item.extractedImgId;
    return id ? this.validationErrors.get(id) || '' : '';
  }

  /* ================= PERFORMANCE ================= */

  buildParentMap() {
    this.parentMap.clear();
    Object.values(this.rawFileData.nodes).forEach((n: any) => {
      if (n.childIds) n.childIds.forEach((id: string) => this.parentMap.set(id, n.assemblyId));
      if (n.images)
        n.images.forEach((i: any) => this.parentMap.set(i.extractedImgId, n.assemblyId));
      if (n.tables)
        n.tables.forEach((page: any) =>
          page.tables?.forEach((t: any) => this.parentMap.set(t.tableId, n.assemblyId)),
        );
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

  /** Find a table by tableId within nested TablePage structure */
  private findTableById(tablePages: any[], tableId: string): any | undefined {
    for (const page of tablePages || []) {
      const found = page.tables?.find((t: any) => t.tableId === tableId);
      if (found) return found;
    }
    return undefined;
  }

  /** Remove a table by tableId from nested TablePage structure */
  private removeTableById(tablePages: AssemblyModel.ITablePage[], tableId: string): void {
    let tableIndex: number = tablePages.findIndex((el: any) => el.tableId === tableId);
    if (tableIndex > -1) {
      let removedTableObj: AssemblyModel.ITablePage = tablePages[tableIndex];
      this.availableTables.update(() => [
        ...this.availableTables(),
        {
          ...removedTableObj,
          assemblyIdRef: '',
          tableNameAsInPDF: removedTableObj.tables[0].tableNameAsInPDF,
          tableName: removedTableObj.tables[0].tableName,
        },
      ]);
      tablePages.splice(tableIndex, 1);
      this.rawFileData['tableList'] = this.availableTables();
    }

    console.log(this.availableTables());
  }

  /** Add a table to a node's nested TablePage structure */
  private addTableToNode(node: any, table: any): void {
    // Use pageId from the table item (added during availableTables flattening)
    const pageId = table.pageId || 'default-page';
    let existingPage = node.tables.find((p: any) => p.pageId === pageId);

    if (existingPage) {
      existingPage.tables.push({
        ...table,
        assemblyIdRef: node.assemblyId,
      });
    } else {
      // Create a new TablePage wrapper
      // node.tables.push({
      //   tables: [table],
      //   pageNo: table.pageNo || 'page-1',
      //   type: 'table',
      //   pageId: pageId,
      //   assemblyIdRef: node.assemblyId,
      //   pageName: table.pageName || 'Page',
      // });
      node.tables.push({
        ...table,
        assemblyIdRef: node.assemblyId,
      });
    }
    this.updateHotspotDetails(node.assemblyId);
    // this.rawFileData.nodes[node.assemblyId].linkedPageProductTable = this.toLinkedPages(table)
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
            this.findTableById(node.tables, id),
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
    const id = item.assemblyId || item.extractedImgId || item.tableId;
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
    const assetId = asset.extractedImgId || asset.tableId;

    node.itemOrder = node.itemOrder.filter((id: string) => id !== assetId);
    if (asset.extractedImgId) {
      if (
        this.availableImages().findIndex(
          (el: AssemblyModel.IExtractedImage) => el.extractedImgId === asset.extractedImgId,
        ) === -1
      ) {
        let value: AssemblyModel.IExtractedImage | undefined = node.images.find(
          (i: any) => i.extractedImgId === assetId,
        );
        if (value) {
          this.availableImages.update((el: any) => [
            ...this.availableImages(),
            {
              ...value,
              assemblyIdRef: '',
            },
          ]);
          this.rawFileData.imageList = this.availableImages();
        }
      }
    }
    node.images = node.images.filter((i: any) => i.extractedImgId !== assetId);
    if (asset.tableId) {
      this.removeTableById(node.tables, assetId);
      this.updateHotspotDetails(node.assemblyId);
    }
    // this.rawFileData.nodes[node.assemblyId].linkedPageProductTable = this.toLinkedPages(node.tables)

    this.emitChange(parentId, 'DELETE');
    this.refreshView();
  }

  openHotspotEditor(asset: any, assemblyId: string, ttt: any) {
    // console.log('Asset :', asset);
    // console.log('ttt :', ttt);
    // let image: AssemblyModel.IExtractedImage = this.rawFileData.nodes[assemblyId].images[0]
    let obj: any = {};
    if (asset.extractedImgId) {
      obj = {
        extractedImgId: asset.extractedImgId,
        extractedImgVersion: asset.extractedImgVersion,
        productId: asset.productId,
        prespectiveName: asset.drawingName,
        hotspotDetails: asset.hotspotDetails || [],
      };
    } else {
      let image: AssemblyModel.IExtractedImage = this.rawFileData.nodes[assemblyId].images[0];
      if (image) {
        obj = {
          extractedImgId: image.extractedImgId,
          extractedImgVersion: image.extractedImgVersion,
          productId: image.productId,
          prespectiveName: image.drawingName,
          hotspotDetails: image.hotspotDetails || [],
        };
      } else {
        return;
      }
    }
    const dialogConfig = new MatDialogConfig();
    obj['hotspotDetails'] =
      obj.hotspotDetails?.length > 0
        ? obj?.hotspotDetails?.sort((a: any, b: any) =>
            Number(a.hotspotString) > Number(b.hotspotString) ? 1 : -1,
          )
        : [];
    let hotspotDetailsString: string = JSON.stringify(obj.hotspotDetails);
    dialogConfig.data = obj;
    // dialogConfig.width = '950px';
    // const dialogRef = this.dialog.open(TwoDSvgEditorComponent, {
    //   disableClose: true,
    //   width: '90vw',
    //   height: '90vh',
    //   maxHeight: '100vh',
    //   data: dialogConfig,
    // });
    //  dialogRef.afterClosed().subscribe((result) => {
    //   if(result && result.isFormValid) {
    //     if(result.cancelledDialog) {
    //       asset.hotspotDetails = JSON.parse(hotspotDetailsString);
    //     } else {
    //       let index: number = this.rawFileData.nodes[assemblyId].images.findIndex((el:AssemblyModel.IExtractedImage) => el.extractedImgId === obj.extractedImgId && el.extractedImgVersion === obj.extractedImgVersion)
    //       if(index > -1) {
    //         this.rawFileData.nodes[assemblyId].images[index].hotspotDetails = result.data.hotspotDetails || []
    //       }

    //       this.emitChange(assemblyId, 'HOTSPOT_UPDATED')
    //     }
    //   } else {
    //      obj.hotspotDetails = JSON.parse(hotspotDetailsString);
    //   }})
  }

  toLinkedPages(pages: AssemblyModel.ITablePage[]): Record<string, AssemblyModel.ILinkedPage> {
    return pages.reduce<Record<string, AssemblyModel.ILinkedPage>>((acc, page) => {
      const pageKey = `${page.pageNo}`;

      const tables = (page.tables ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map<AssemblyModel.ILinkedTable>((t) => ({
          tableNameAsInPDF: t.tableNameAsInPDF ?? '',
          isAccepted: true,
          tableData: t.tableData as string[][],
          tableName: t.tableName,
          order: t.order,
        }));

      if (tables.length === 0) {
        return acc; // skip this page
      }

      acc[pageKey] = {
        pageKey,
        pageId: page.pageId,
        pageName: page.pageName,
        tables,
      };

      return acc;
    }, {});
  }

  private removeFromModel(parentId: string | null, itemId: string, item: any) {
    if (parentId) {
      const node = this.rawFileData.nodes[parentId];
      node.itemOrder = node.itemOrder.filter((id: string) => id !== itemId);
      node.childIds = node.childIds.filter((id: string) => id !== itemId);
      node.images = node.images.filter((i: any) => i.extractedImgId !== itemId);
      this.removeTableById(node.tables, itemId);
      this.updateHotspotDetails(parentId);
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
      // node.parentClassCode = this.rawFileData.nodes[parentId].classCode
      if (item.assemblyId) {
        this.rawFileData.nodes[itemId].parentClassCode = node.classCode;
        this.rawFileData.nodes[itemId].parentAssemblyId = node.assemblyId;
        node.childIds.push(itemId);
      } else if (item.extractedImgId) {
        node.images.push({
          ...item,
          assemblyIdRef: node.assemblyId,
        });
        this.updateHotspotDetails(node.assemblyId);
      } else if (item.tableId && item.tableName) {
        this.addTableToNode(node, item);
        this.updateHotspotDetails(node.assemblyId);
      }

      // Re-sort after adding
      node.itemOrder = this.sortItemsInOrder(node.itemOrder, parentId);
    } else {
      this.rawFileData.rootIds.splice(index, 0, itemId);
      this.rawFileData.nodes[itemId].parentClassCode = this.rawFileData.classRoot;
      this.rawFileData.nodes[itemId].parentAssemblyId =
        this.rawFileData.classRoot !==
        this.rawFileData.nodes[this.rawFileData.nodes[itemId].parentAssemblyId].classRoot
          ? this.rawFileData.nodes[this.rawFileData.nodes[itemId].parentAssemblyId].assemblyId
          : '';
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
      const pEl = els.find(
        (e) => e.nativeElement.dataset.id === pid && e.nativeElement.dataset.level === String(i),
      )?.nativeElement;
      const next = this.columns()[i + 1];
      if (!pEl || !next) return;

      const p = pEl.getBoundingClientRect();

      // Calculate position relative to levels-area viewport, then add scroll for content position
      // The SVG transform will offset back, so arrows stay aligned with scrolled content
      const sx = p.right - areaRect.left + scrollLeft;
      const sy = p.top - areaRect.top + scrollTop + p.height / 2;

      next.forEach((c) => {
        const cid = c.assemblyId || c.extractedImgId || c.tableId;
        const cEl = els.find(
          (e) =>
            e.nativeElement.dataset.id === cid && e.nativeElement.dataset.level === String(i + 1),
        )?.nativeElement;
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
      node.tables.forEach((page: any) => {
        page.tables?.forEach((table: any) => {
          this.parentMap.set(table.tableId, node.assemblyId);
        });
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
    // console.log(action);
    // console.log(this.rawFileData);
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
    if (['DELETE_ASSEMBLY'].includes(action) && nodeId) {
      this.deletedAssemblyList = [...new Set([nodeId, ...this.deletedAssemblyList])];
    }
    if (nodeId)
      // console.log(this.rawFileData.nodes[nodeId]);
      this.onStructureChange.emit({
        nodeId: nodeId || 'ROOT',
        action,
        timestamp: new Date().toISOString(),
      });
    this.disableMakeAssembly.set(false);
  }

  /* ================= RIGHT PANEL MANAGEMENT ================= */

  openAddPanel(parentId: string | null, levelIndex: number, assemblytype: string) {
    this.rightPanelFor.set(assemblytype);
    this.rightPanelMode.set('add');
    this.pendingParentId.set(parentId);
    this.editingAssemblyId.set(null);

    // Reset form
    this.assemblyForm = {
      assemblyName: '',
      classCode: '',
      parentClassCode: '',
      isValid: false,
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
      parentClassCode: assembly.parentClassCode,
      isValid: false,
    };

    this.rightPanelOpen.set(true);
  }

  onField1Change(value: string) {
    this.assemblyForm.assemblyName = value ?? '';
    // if(!this.assemblyForm.classCode.startsWith('CLASS_')) {
    this.assemblyForm.classCode = 'CLASS_' + this.toClassName(this.assemblyForm.assemblyName);
    // }
    console.log(this.classCodeList());
    if (
      this.assemblyForm.assemblyName &&
      !this.classCodeList().includes(this.assemblyForm.classCode)
    ) {
      this.assemblyForm.isValid = true;
      this.formErrorMessage = '';
    } else {
      this.assemblyForm.isValid = false;
      if (!this.assemblyForm.assemblyName) {
        this.formErrorMessage = 'Please enter required fields.';
      }
      if (
        this.assemblyForm.assemblyName &&
        this.rightPanelMode() === 'add' &&
        this.classCodeList().filter((el) => el === this.assemblyForm.classCode).length > 0
      ) {
        this.formErrorMessage = 'Class code exists, try different name';
      }
      if (
        this.assemblyForm.assemblyName &&
        this.rightPanelMode() === 'edit' &&
        this.classCodeList().filter((el) => el === this.assemblyForm.classCode).length > 0
      ) {
        this.formErrorMessage = 'Class code exists, try different name';
      }
    }
  }

  private toClassName(value: string): string {
    return (value ?? '')
      .trim()
      .replace(/\s+/g, '_') // spaces -> underscore
      .toUpperCase(); // uppercase
  }

  closeRightPanel() {
    this.rightPanelOpen.set(false);
    this.assemblyForm = {
      assemblyName: '',
      classCode: '',
      parentClassCode: '',
      isValid: false,
    };
  }

  submitAssemblyForm() {
    // Validation
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

    const newAssembly: AssemblyModel.IAssemblyNode = {
      assemblyId: newId,
      assemblyName: this.assemblyForm.assemblyName,
      classCode: this.assemblyForm.classCode,
      childIds: [],
      images: [],
      tables: [],
      itemOrder: [],
      mergedProductTable: null,
      hotspotDetails: null,
      linkedPageProductTable: null,
      classRoot: this.rawFileData.classRoot,
      productId: this.assemblyForm.classCode.replace('CLASS_', ''),
      parentAssemblyId: parentId ? parentId : '',
      parentClassCode: parentId
        ? this.rawFileData.nodes[parentId].classCode
        : this.rawFileData.classRoot,
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
  addAssembly(parentId: string | null, levelIndex: number, assemblytype: string) {
    this.openAddPanel(parentId, levelIndex, assemblytype);
  }

  addSubAssembly(parentId: string | null, levelIndex: number, assemblytype: string) {
    this.openAddPanel(parentId, levelIndex, assemblytype);
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
    this.emitChange(assemblyId, 'DELETE_ASSEMBLY');
    this.refreshView();
    this.closeDeleteDialog();

    // Recalculate arrows
    setTimeout(() => this.calculateArrows(), 100);
  }

  private recursiveDeleteAssembly(assemblyId: string) {
    const node = this.rawFileData.nodes[assemblyId];
    if (!node) return;

    // Recursively delete all child assemblies

    // Remove classcode from classcode list
    let index: number = this.classCodeList().indexOf(this.rawFileData.nodes[assemblyId].classCode);
    this.classCodeList.update((value: string[]) => {
      value.splice(index, 1);
      return value;
    });

    if (node.images.length > 0) {
      this.availableImages.update((el: any) => [
        ...this.availableImages(),
        ...node.images.map((elx: AssemblyModel.IExtractedImage) => {
          return {
            ...elx,
            assemblyIdRef: '',
          };
        }),
      ]);
      this.rawFileData.imageList = this.availableImages();
    }
    if (node.tables.length > 0) {
      this.availableTables.update((el: any) => [
        ...el,
        ...node.tables.map((elx: AssemblyModel.ITablePage) => {
          return {
            ...elx,
            tableNameAsInPDF: elx.tables[0].tableNameAsInPDF,
            tableName: elx.tables[0].tableName,
            assemblyIdRef: '',
          };
        }),
      ]);
      this.rawFileData.imageList = this.availableImages();
    }
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
      node.tables.forEach((page: any) => {
        page.tables?.forEach((table: any) => {
          this.validationErrors.delete(table.tableId);
          this.parentMap.delete(table.tableId);
        });
      });
    }
  }

  /* ================= ZOOM CONTROLS ================= */

  zoomIn() {
    const newZoom = Math.min(this.zoomLevel() + this.zoomStep, this.maxZoom);
    this.zoomLevel.set(Number(newZoom.toFixed(1)));
    setTimeout(() => this.refreshView(), 100);
  }

  zoomOut() {
    const newZoom = Math.max(this.zoomLevel() - this.zoomStep, this.minZoom);
    this.zoomLevel.set(Number(newZoom.toFixed(1)));
    setTimeout(() => this.refreshView(), 100);
  }

  resetZoom() {
    this.zoomLevel.set(1);
    setTimeout(() => this.refreshView(), 100);
  }

  /* =============== Hotspot update ========== */

  getMergedProductTable(tables: Record<string, AssemblyModel.ILinkedPage> | null): string[][] {
    let result: string[][] = [];
    for (let pageNum in tables) {
      if (tables[`${pageNum}`]?.tables?.length > 0) {
        for (let i = 0; i < tables[`${pageNum}`]?.tables.length; i++) {
          result.push(...tables[`${pageNum}`]?.tables[i].tableData);
        }
      }
    }
    return result;
  }

  prefillExtractedDataProductTable(
    mergedProductTable: string[][] | null,
    hotspotDetails: AssemblyModel.IHotspotDetail[] | null,
  ): AssemblyModel.IHotspotDetail[] | null {
    const extractedProductTable = mergedProductTable || [];
    let [headerProductTable] = mergedProductTable || [];
    headerProductTable = headerProductTable?.map((item: any) => item.toString());
    if (extractedProductTable?.length > 0) {
      let productIdIndex = -1;
      if (this.aiHintsConfig?.partId?.length > 0) {
        let partIdList = this.aiHintsConfig.partId;
        for (let i = 0; i < partIdList.length; i++) {
          let index = headerProductTable?.findIndex((item: any) =>
            item.toLowerCase().trim().includes(partIdList[i].toLowerCase().trim()),
          );
          if (index > -1) {
            productIdIndex = index;
            break;
          }
        }
        // when AI alters header column using aihints properly below code will help to identify part id column
        if (productIdIndex === -1) {
          productIdIndex = headerProductTable?.findIndex(
            (item: any) => item.toLowerCase().trim() === 'part id',
          );
        }
      } else {
        if (
          headerProductTable?.findIndex((item: any) => item.toLowerCase() === 'stock number') > -1
        ) {
          productIdIndex = headerProductTable?.findIndex(
            (item: any) => item.toLowerCase() === 'stock number',
          );
        } else if (
          headerProductTable?.findIndex((item: any) => item.toLowerCase() === 'description.1') > -1
        ) {
          productIdIndex = headerProductTable?.findIndex(
            (item: any) => item.toLowerCase() === 'description.1',
          );
        } else {
          productIdIndex = headerProductTable?.findIndex(
            (item: any) => item.toLowerCase() === 'part id',
          );
        }
      }

      let hotSpotIdIndex = -1;
      if (this.aiHintsConfig?.sequence?.length > 0) {
        let sequenceList = this.aiHintsConfig.sequence;
        for (let i = 0; i < sequenceList.length; i++) {
          let index = headerProductTable?.findIndex((item: any) =>
            item.toLowerCase().trim().includes(sequenceList[i].toLowerCase().trim()),
          );
          if (index > -1) {
            hotSpotIdIndex = index;
            break;
          }
        }
        // when AI alter header column using aihints
        if (hotSpotIdIndex === -1) {
          hotSpotIdIndex = headerProductTable?.findIndex(
            (item: any) => item.toLowerCase().trim() === 'sequence',
          );
        }
      } else {
        hotSpotIdIndex = headerProductTable?.findIndex(
          (item: any) => item.toLowerCase().trim() === 'sequence',
        );
      }

      let qtyIndex = -1;
      if (this.aiHintsConfig?.qty?.length > 0) {
        let qtyList = this.aiHintsConfig.qty;
        for (let i = 0; i < qtyList.length; i++) {
          let index = headerProductTable?.findIndex((item: any) =>
            item.toLowerCase().trim().includes(qtyList[i].toLowerCase().trim()),
          );
          if (index > -1) {
            qtyIndex = index;
            break;
          }
        }
        // when AI alter header column using aihints
        if (qtyIndex === -1) {
          qtyIndex = headerProductTable?.findIndex(
            (item: any) => item.toLowerCase().trim() === 'qty',
          );
        }
      } else {
        qtyIndex = headerProductTable?.findIndex(
          (item: any) => item.toLowerCase().trim() === 'qty',
        );
      }
      if (productIdIndex !== -1 && hotSpotIdIndex !== -1) {
        let hotSpotArray: AssemblyModel.IHotspotDetail[] | null = hotspotDetails || [];
        if (hotSpotArray?.length > 0) {
          return hotSpotArray?.map((item: any) => {
            const hotspotId = item.hotspotString;
            const result = extractedProductTable?.filter((row: any) => {
              const extractedHotspotId = row[hotSpotIdIndex];
              return (
                extractedHotspotId &&
                hotspotId &&
                extractedHotspotId?.toString()?.toLowerCase()?.trim().replace(/^0+/, '') ==
                  hotspotId?.toString()?.toLowerCase()?.trim()
              );
            });
            if (result && result?.length > 0) {
              const [extractedProduct] = result;
              // const [ , extractedQty, extractedProductId ] = extractedProduct;
              if (!/^\d+$/.test(extractedProduct?.[qtyIndex]?.toString())) {
                extractedProduct[qtyIndex] = '0';
              }
              const extractedQty = extractedProduct[qtyIndex] || '0';
              const extractedProductId = extractedProduct[productIdIndex] || '';
              item.qty = extractedQty;
              item.partId =
                productIdIndex > -1
                  ? extractedProductId && item?.duplicated
                    ? item.partId
                    : extractedProductId
                  : '';
              return item;
            } else {
              return {
                ...item,
                partId: '',
                qty: '0',
              };
            }
          });
        } else {
          return [];
        }
      } else {
        return hotspotDetails;
      }
    } else {
      if (hotspotDetails) {
        return hotspotDetails?.map((el: AssemblyModel.IHotspotDetail) => {
          return {
            ...el,
            partId: '',
            qty: '0',
          };
        });
      } else {
        return [];
      }
    }
  }

  updateHotspotDetails(assemblyId: string) {
    console.log('============');
    console.log(this.rawFileData.nodes[assemblyId]);
    this.rawFileData.nodes[assemblyId].linkedPageProductTable = this.toLinkedPages(
      this.rawFileData.nodes[assemblyId].tables,
    );
    this.rawFileData.nodes[assemblyId].mergedProductTable = this.getMergedProductTable(
      this.rawFileData.nodes[assemblyId].linkedPageProductTable,
    );
    if (this.rawFileData.nodes[assemblyId].mergedProductTable.length > 0) {
      this.rawFileData.nodes[assemblyId].images = this.rawFileData.nodes[assemblyId].images.map(
        (value: AssemblyModel.IExtractedImage) => {
          return {
            ...value,
            hotspotDetails: this.prefillExtractedDataProductTable(
              this.rawFileData.nodes[assemblyId].mergedProductTable,
              value.hotspotDetails,
            ),
          };
        },
      );
    }

    this.emitChange(assemblyId, 'HOTSPOT_UPDATED');
    console.log(this.rawFileData.nodes[assemblyId]);
    console.log('============');
  }

  /* ================= Save Assembly ================= */

  saveAiHierarchy() {
    this.onAssemblySave.emit({
      updatedAssemblyList: this.updatedAssemblyList.filter((el: string) => {
        return !this.deletedAssemblyList.includes(el); // To remove deleted assembly from updated assembly list
      }),
      deletedAssemblyList: this.deletedAssemblyList,
      rawFileData: this.rawFileData,
      isHierarchyUpdated: this.isHierarchyUpdated,
    });
  }

  goback() {
    this.router.navigate(['../../../../../'], { relativeTo: this.activatedRoute });
  }
}
