// import { Component, signal } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';

// @Component({
//   selector: 'app-pdf-viewer',
//   standalone: true,
//   imports: [CommonModule, NgxExtendedPdfViewerModule],

//   // ── Inline HTML Template ──────────────────────────────────────
//   template: `
//     <div class="viewer-container">
//       <ngx-extended-pdf-viewer
//         [src]="pdfSrc()"
//         [(page)]="page"
//         [zoom]="zoom()"
//         [zoomLevels]="[
//           'auto',
//           'page-fit',
//           'page-width',
//           '50%',
//           '75%',
//           '100%',
//           '125%',
//           '150%',
//           '200%',
//         ]"
//         [showToolbar]="true"
//         [showSidebarButton]="true"
//         [showFindButton]="true"
//         [showPagingButtons]="true"
//         [showZoomButtons]="true"
//         [showPresentationModeButton]="true"
//         [showDownloadButton]="true"
//         [showPrintButton]="true"
//         [showThumbnailView]="true"
//         [showOutlineView]="true"
//         [showAttachmentView]="true"
//         [showScrollingButton]="true"
//         [showSpreadButton]="true"
//         [spread]="spreadMode()"
//         [textLayer]="true"
//         [renderText]="true"
//         [renderTextMode]="2"
//         language="en-US"
//         height="100vh"
//         (pdfLoaded)="onPdfLoaded($event)"
//         (pageChange)="onPageChange($event)"
//         (pdfLoadingFailed)="onError($event)"
//       ></ngx-extended-pdf-viewer>
//     </div>
//   `,

//   // ── Inline Styles ─────────────────────────────────────────────
//   styles: [
//     `
//       :host {
//         display: block;
//         height: 100vh;
//         overflow: hidden;
//       }

//       .viewer-container {
//         width: 100%;
//         height: 100%;
//         overflow: hidden;
//         background: #0d0d18;
//       }

//       /* Toolbar */
//       ::ng-deep #toolbarViewer {
//         background: #18182a !important;
//         border-bottom: 1px solid #2a2a44 !important;
//       }

//       ::ng-deep #toolbarViewerLeft,
//       ::ng-deep #toolbarViewerRight,
//       ::ng-deep #toolbarViewerMiddle {
//         background: transparent !important;
//       }

//       ::ng-deep .toolbarButton,
//       ::ng-deep .toolbarButton::before,
//       ::ng-deep select,
//       ::ng-deep input#pageNumber {
//         color: #e0e0f0 !important;
//       }

//       ::ng-deep .toolbarButton:hover {
//         background: #7c6dfa44 !important;
//         border-radius: 6px;
//       }

//       ::ng-deep input#pageNumber {
//         background: #111118 !important;
//         border: 1px solid #3a3a5c !important;
//         border-radius: 5px !important;
//         color: #e0e0f0 !important;
//         text-align: center;
//       }

//       ::ng-deep select#scaleSelect {
//         background: #111118 !important;
//         border: 1px solid #3a3a5c !important;
//         border-radius: 5px !important;
//         color: #e0e0f0 !important;
//       }

//       /* Sidebar */
//       ::ng-deep #sidebarContainer {
//         background: #13131f !important;
//         border-right: 1px solid #2a2a44 !important;
//       }

//       ::ng-deep #sidebarContent {
//         background: #13131f !important;
//       }

//       ::ng-deep #thumbnailView {
//         background: #13131f !important;
//       }

//       /* Thumbnail active highlight */
//       ::ng-deep .thumbnail.selected > .thumbnailSelectionRing {
//         outline: 3px solid #7c6dfa !important;
//       }

//       ::ng-deep .thumbnail:hover > .thumbnailSelectionRing {
//         outline: 2px solid #7c6dfa88 !important;
//       }

//       ::ng-deep .thumbnailSelectionRing {
//         border-radius: 4px;
//       }

//       /* PDF canvas background */
//       ::ng-deep #viewerContainer {
//         background: #0d0d18 !important;
//       }

//       ::ng-deep .page {
//         border: none !important;
//         box-shadow: 0 6px 40px #00000088 !important;
//         border-radius: 4px !important;
//         margin: 12px auto !important;
//       }

//       /* Find bar */
//       ::ng-deep #findbar {
//         background: #18182a !important;
//         border-bottom: 1px solid #2a2a44 !important;
//         color: #e0e0f0 !important;
//       }

//       ::ng-deep #findInput {
//         background: #111118 !important;
//         border: 1px solid #3a3a5c !important;
//         color: #e0e0f0 !important;
//         border-radius: 5px !important;
//       }

//       /* Scrollbar */
//       ::ng-deep ::-webkit-scrollbar {
//         width: 6px;
//       }
//       ::ng-deep ::-webkit-scrollbar-track {
//         background: #0d0d18;
//       }
//       ::ng-deep ::-webkit-scrollbar-thumb {
//         background: #2a2a50;
//         border-radius: 4px;
//       }
//       ::ng-deep ::-webkit-scrollbar-thumb:hover {
//         background: #7c6dfa;
//       }
//     `,
//   ],
// })
// export class PdfViewerComponent {
//   // ✅ Replace with your S3 URL
//   pdfSrc = signal<string>('https://your-s3-bucket.s3.amazonaws.com/file.pdf');

//   page = signal<number>(1);
//   zoom = signal<string | number>('page-width');
//   spreadMode = signal<'off' | 'odd' | 'even'>('off');

//   onPdfLoaded(event: any) {
//     console.log('PDF loaded — total pages:', event.pagesCount);
//   }

//   onPageChange(page: number) {
//     this.page.set(page);
//   }

//   onError(error: any) {
//     console.error('PDF load error:', error);
//   }
// }
