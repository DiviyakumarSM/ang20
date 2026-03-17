export interface IAssemblyHierarchyApiResponse {
  data: {
    assemblyHierarchy: IAssemblyHierarchy;
  };
  statusCode: number;
}

export interface IAssemblyHierarchy {
  classRoot: string;
  nodes: Record<string, IAssemblyNode>;
  rootIds: string[];
  tableList: ITablePage[];
  imageList: IExtractedImage[];
}

export interface IAssemblyNode {
  classRoot: string;
  classCode: string;
  parentClassCode: string;
  images: IExtractedImage[];
  tables: ITablePage[];
  productId: string;
  assemblyName: string;
  childIds: string[];
  itemOrder: string[];
  mergedProductTable: string[][] | null;
  linkedPageProductTable: Record<string, ILinkedPage> | null; // keys like "page-21"
  hotspotDetails?: IHotspotDetail[] | null;
  assemblyId: string;
  parentAssemblyId: string;
}

export interface IExtractedImage {
  extractedImgVersion: number;
  productId: string;
  pageNo: string;
  extractedImgId: string;
  imageNameAsInPDF: string;
  type: 'image';
  selected?: boolean;
  drawingName: string;
  assemblyIdRef?: string;
  svgFileId?: string | null;
  svgFileName?: string;
  svgHeader?: string;
  imageUrl?: string;
  hotspotDetails: IHotspotDetail[] | null;
  productDescription: string | null;
}

export interface ITablePage {
  tables: IExtractedTable[];
  pageNo: string;
  type: 'table';
  selected?: boolean;
  tableId: string;
  tableName?: string;
  tableNameAsInPDF?: string | null;
  pageId: string;
  pageName: string;
}

export interface IExtractedTable {
  tableNameAsInPDF: string | null;
  isAccepted: boolean;
  tableId: string;
  selected?: boolean;
  assemblyIdRef: string;
  tableData: string[][];
  tableName: string; // e.g. "Table No. 1"
  order: number;
  pageNo: string;
  pageId: string;
  pageName: string;
}

// The table is represented as an array of rows, where each row is an array of strings.
export type ProductTableRow = [sequence: string, partId: string, description: string, qty: string];
export type ProductTable = [header: ProductTableRow, ...rows: ProductTableRow[]];

export type Point = [x: number, y: number];
export type RectCoords = [topLeft: Point, bottomRight: Point];

export interface IHotspotDetail {
  hotspotString: string;
  partId: string;
  hotspotCoords: RectCoords;
  partDescription: string;
  qty: string;
}

export interface ILinkedTable {
  tableNameAsInPDF: string;
  isAccepted: boolean;
  tableData: string[][];
  tableName: string; // e.g., "Table No. 1"
  order: number;
}

export interface ILinkedPage {
  tables: ILinkedTable[];
  pageKey: string; // e.g., "page-21"
  pageId: string; // UUID
  pageName: string; // e.g., "Page No. 21"
}
