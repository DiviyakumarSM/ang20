export interface AssemblyHierarchyApiResponse {
  data: {
    assemblyHierarchy: AssemblyHierarchy;
  };
  statusCode: number;
}

export interface AssemblyHierarchy {
  classRoot: string;
  nodes: Record<string, AssemblyNode>;
  rootIds: string[];
  tableList: TablePage[];
  imageList: ExtractedImage[];
}

export interface AssemblyNode {
  classRoot: string;
  classCode: string;
  parentClassCode: string;

  images: ExtractedImage[];
  tables: TablePage[];

  assemblyName: string;
  childIds: string[];
  itemOrder: string[];

  assemblyId: string;
  parentAssemblyId: string;
}

export interface ExtractedImage {
  extractedImgVersion: number;
  productId: string;
  pageNo: string;
  extractedImgId: string;
  imageNameAsInPDF: string;
  type: 'image';
  drawingName: string;
  productDescription: string | null;
}

export interface TablePage {
  tables: ExtractedTable[];
  pageNo: string;
  type: 'table';
  pageId: string;
  pageName: string;
}

export interface ExtractedTable {
  tableNameAsInPDF: string | null;
  isAccepted: boolean;
  tableId: string;

  /**
   * Table is represented as rows/columns of strings.
   * First row is usually the header.
   */
  tableData: string[][];

  tableName: string; // e.g. "Table No. 1"
  order: number;
}
