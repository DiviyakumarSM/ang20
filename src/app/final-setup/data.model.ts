export interface IPartItem {
  componentProductId: string;
  classCode: string;
  parentClassCode: string;
  useName_EN: string;
  quantity: number;
  classSource: string;
  flag: string;
}

export interface IHotspotDetail {
  hotspotString: string;
  partId: string | null;
  hotspotCoords: number[][];
  partDescription: string | null;
  qty: string | number;
}

export interface IClassCodeInfo {
  classRoot: string;
  classCode: string;
  parentClassCode: string;
}

export interface IPdsInfo {
  serialNumber: string;
  installDate: string;
  description: string;
  modelNumber: string;
}

export interface IExtractedImageByPage {
  extractedImgVersion: number;
  productId: string;
  originalImgVersion: number;
  imageNameAsInPDF: string;
  svgFileId: string | null;
  svgFileName: string;
  hotspotImgId: string | null;
  svgHeader: string;
  secondaryExtractedImgId: string | null;
  extractedImgId: string;
  originalImgId: string;
  drawingName: string;
  productDescription: string | null;
  hotspotDetails: IHotspotDetail[];
  order: number;
  prespectiveName: string | null;
}

export interface IPageTable {
  tableNameAsInPDF: string;
  isAccepted: boolean;
  tableData: string[][];
  tableName: string;
  order: number;
}

export interface ILinkedPageEntry {
  tables: IPageTable[];
  pageKey: string;
  pageId: string;
  pageName: string;
}

export interface IAssemblyItem {
  assemblyId: string;

  extractedImgVersion: number;
  selectedImageIndex: number;
  productId: string;
  originalImgVersion: number;
  classCodeInfo: IClassCodeInfo;
  prespectiveName: string;
  pageId: string;
  svgFileId: string;
  assemblyStatus: string;
  svgFileVersion: number;
  svgFileName: string;
  svgHeader: string;
  userSave: boolean;
  pdsInfo: IPdsInfo;
  extractedImgId: string;
  originalImgId: string;
  drawingName: string;
  status: string;
  hotspotDetails: IHotspotDetail[];
  imageUrl?: string;

  mergedProductTable: string[][];
  extractedImageListByPage: IExtractedImageByPage[];
  linkedPageProductTable: Record<string, ILinkedPageEntry>;
  /** Runtime: tracks which ITableListItem.tableId was used to create this assembly (for dedup) */
  tableListItemId?: string;
}

export interface IHierarchyNode {
  hierarchyId: string;
  parentHierarchyId: string;
  assemblyName: string;
  classRoot: string;
  parentClassCode: string;
  classCode: string;
  childIds: string[];
  assemblyList: IAssemblyItem[];
  partsList: IPartItem[];
}

/** Runtime extension of IHierarchyNode with UI-only tracking fields */
export interface IHierarchyNodeRuntime extends IHierarchyNode {
  /** Ordered list of child-node IDs, assemblyIds, pending image IDs, and pending table IDs */
  itemOrder: string[];
  /** Images dropped but not yet paired with a table */
  pendingImages: IImageListItem[];
  /** Tables dropped but not yet paired with an image */
  pendingTables: ITableListItem[];
}

export interface IImageListItem {
  drawingName: string;
  imageNameAsInPDF: string;
  productId: string;
  productDescription: string | null;
  extractedImgId: string;
  extractedImgVersion: number;
  pageNo: string;
  type: string;
  prespectiveName: string;
  pageId: string;
  hotspotDetails: IHotspotDetail[];
  svgHeader: string;
  svgFileName: string;
  svgFileId: string | null;
  assemblyIdRef: string;
  /** Runtime: checkbox selection state */
  selected?: boolean;
  /** Runtime: true when this image is paired with a table in an IAssemblyItem */
  isPaired?: boolean;
  imageUrl?: string;
}

export interface ITableEntry {
  tableId: string;
  tableNameAsInPDF: string;
  tableName: string;
  isAccepted: boolean;
  order: number;
  tableData: string[][];
}

export interface ITableListItem {
  pageName: string;
  pageNo: string;
  type: string;
  pageId: string;
  tableId: string;
  order: number;
  tableNameAsInPDF: string;
  tableName: string;
  tables: ITableEntry[];
  /** Runtime: checkbox selection state */
  selected?: boolean;
  /** Runtime: true when this table is paired with an image in an IAssemblyItem */
  isPaired?: boolean;
}

export interface IAssemblyHierarchy {
  rootIds: string[];
  nodes: Record<string, IHierarchyNode>;
  classRoot: string;
  imageList: IImageListItem[];
  tableList: ITableListItem[];
}

export interface IResponseData {
  assemblyHierarchy: IAssemblyHierarchy;
}

export interface IAssemblyHierarchyResponse {
  statusCode: number;
  data: IResponseData;
}
