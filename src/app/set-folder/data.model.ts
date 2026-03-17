export interface IResponse {
  data: IData;
  statusCode: number;
}

export interface IData {
  assemblyHierarchy: IAssemblyHierarchy;
}

export interface IAssemblyHierarchy {
  classRoot: string;
  nodes: Record<string, INode>;
  rootIds: string[];
  tableList: IPageTable[];
  imageList: (IImage | IAssembly)[];
}

export interface INode {
  assemblyName: string;
  classCode: string;
  classRoot: string;
  parentClassCode: string;
  parentHierarchyId: string;
  childIds: string[];
  hierarchyId: string;
  assemblyList: IAssembly[];
}

export interface IAssembly {
  extractedImgVersion: number;
  selectedImageIndex: number;
  productId: string;
  assemblyId: string;
  originalImgVersion: number;
  classCodeInfo: IClassCodeInfo;
  prespectiveName: string;
  pageId: string;
  svgFileId: string;
  assemblyStatus: string;
  svgFileVersion?: number;
  svgFileName?: string;
  svgHeader?: string;
  userSave: boolean;
  pdsInfo: IPdsInfo;
  extractedImgId: string;
  originalImgId: string;
  mergedProductTable: string[][];
  extractedImageListByPage: IExtractedImage[];
  drawingName: string;
  hotspotDetails: IHotspot[];
  linkedPageProductTable: Record<string, ILinkedPageTable>;
  status?: string;
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

export interface IExtractedImage {
  extractedImgVersion: number;
  productId: string;
  originalImgVersion: number;
  prespectiveName: string | null;
  imageNameAsInPDF: string;
  svgFileId: string | null;
  svgFileName: string | null;
  hotspotImgId: string | null;
  svgHeader: string | null;
  secondaryExtractedImgId: string | null;
  extractedImgId: string;
  originalImgId: string;
  drawingName: string;
  productDescription: string | null;
  hotspotDetails: IHotspot[];
  order: number;
}

export interface IHotspot {
  hotspotString: string;
  partId: string | null;
  hotspotCoords: number[][];
  partDescription: string | null;
  qty: string | number;
}

export interface ILinkedPageTable {
  tables: ITable[];
  pageKey: string;
  pageId: string;
  pageName: string;
}

export interface IPageTable {
  tables: ITable[];
  pageNo: string;
  tableId: string;
  type: string;
  pageId: string;
  pageName: string;
  order: number;
}

export interface ITable {
  tableNameAsInPDF: string | null;
  isAccepted: boolean;
  tableId?: string;
  tableData: string[][];
  tableName: string;
  order: number;
}

export interface IImage {
  extractedImgVersion: number;
  productId: string;
  pageNo: string;
  extractedImgId: string;
  imageNameAsInPDF: string;
  type: string;
  pageId: string;
  drawingName: string;
  productDescription: string | null;
  hotspotDetails: IHotspot[];
  assemblyIdRef?: string;
}
