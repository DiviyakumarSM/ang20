import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DrillerOrgComponent } from './test/original';
import { AssemblyDrillerComponent } from './assembly-driller-component/assembly-driller-component';
import { Drillerv1Component } from './test/v1';
import { SetFolder } from './set-folder/set-folder';

@Component({
  selector: 'app-root',
  imports: [AssemblyDrillerComponent, Drillerv1Component, SetFolder],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('ang20');
  data = {
    rootIds: [
      'fa930973-0287-40d8-96e4-e849fc50caff',
      '277b621d-4d34-42ac-bd9e-02d96b078402',
      '1652b17f-215b-4900-8fa5-30e537c32fe4',
      'b8810a2a-9cc1-4cc9-bf42-e62f15a96d35',
    ],
    nodes: {
      'fa930973-0287-40d8-96e4-e849fc50caff': {
        assemblyId: 'fa930973-0287-40d8-96e4-e849fc50caff',
        assemblyName: 'MOTOR_OVERVIEW',
        itemOrder: [
          '383f29a1-a8cc-4b79-a35b-cbc5f6f2b255',
          '355e0d23-1371-4848-85f9-b6bcc7583f0a',
          'page-7-tab-1',
        ],
        childIds: ['355e0d23-1371-4848-85f9-b6bcc7583f0a'],
        images: [
          {
            drawingName: 'page-7_ORDER-1',
            extractedImgId: '383f29a1-a8cc-4b79-a35b-cbc5f6f2b255',
            type: 'image',
          },
        ],
        tables: [{ id: 'page-7-tab-1', tableName: 'Table No. 1', type: 'table' }],
      },
      '355e0d23-1371-4848-85f9-b6bcc7583f0a': {
        assemblyId: '355e0d23-1371-4848-85f9-b6bcc7583f0a',
        assemblyName: 'HARDWARE',
        itemOrder: ['page-7-tab-2'],
        childIds: [],
        images: [],
        tables: [{ id: 'page-7-tab-2', tableName: 'Table No. 2', type: 'table' }],
      },
      '277b621d-4d34-42ac-bd9e-02d96b078402': {
        assemblyId: '277b621d-4d34-42ac-bd9e-02d96b078402',
        assemblyName: 'LINERS',
        itemOrder: ['7287b7ed-cd5b-420d-b9bd-5ddc6de2bd31', 'page-8-tab-2'],
        childIds: [],
        images: [
          {
            drawingName: 'page-8_ORDER-1',
            extractedImgId: '7287b7ed-cd5b-420d-b9bd-5ddc6de2bd31',
            type: 'image',
          },
        ],
        tables: [{ id: 'page-8-tab-2', tableName: 'Table No. 2', type: 'table' }],
      },
      '1652b17f-215b-4900-8fa5-30e537c32fe4': {
        assemblyId: '1652b17f-215b-4900-8fa5-30e537c32fe4',
        assemblyName: 'BODY',
        itemOrder: ['5bd4f35c-3b43-47d4-b69a-d7027eba5455', 'page-9-tab-1'],
        childIds: [],
        images: [
          {
            drawingName: 'page-9_ORDER-1',
            extractedImgId: '5bd4f35c-3b43-47d4-b69a-d7027eba5455',
            type: 'image',
          },
        ],
        tables: [{ id: 'page-9-tab-1', tableName: 'Table No. 1', type: 'table' }],
      },
      'b8810a2a-9cc1-4cc9-bf42-e62f15a96d35': {
        assemblyId: 'b8810a2a-9cc1-4cc9-bf42-e62f15a96d35',
        assemblyName: 'SPRINGS',
        itemOrder: ['b1572339-79e7-4ef7-b095-7d0b54daa06c', 'page-9-tab-2'],
        childIds: [],
        images: [
          {
            drawingName: 'page-9_ORDER-2',
            extractedImgId: 'b1572339-79e7-4ef7-b095-7d0b54daa06c',
            type: 'image',
          },
        ],
        tables: [{ id: 'page-9-tab-2', tableName: 'Table No. 2', type: 'table' }],
      },
    },
  };
}
