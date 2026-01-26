export const IMAGES = [
  {
    drawingName: 'page-7_ORDER-1',
    extractedImgId: '383f29a1-a8cc-4b79-a35b-cbc5f6f2b255',
    type: 'image',
  },
  {
    drawingName: 'Hardware Assembly Drawing',
    extractedImgId: 'img-hw-001',
    type: 'image',
  },
  {
    drawingName: 'Fastener Details',
    extractedImgId: 'img-fast-001',
    type: 'image',
  },
  {
    drawingName: 'Bolt Technical Drawing',
    extractedImgId: 'img-bolt-001',
    type: 'image',
  },
  {
    drawingName: 'Electrical Schematic',
    extractedImgId: 'img-elec-001',
    type: 'image',
  },
  {
    drawingName: 'Wiring Diagram',
    extractedImgId: 'img-wire-001',
    type: 'image',
  },
  {
    drawingName: 'Connector Pinout',
    extractedImgId: 'img-conn-001',
    type: 'image',
  },
  {
    drawingName: 'page-8_ORDER-1',
    extractedImgId: '7287b7ed-cd5b-420d-b9bd-5ddc6de2bd31',
    type: 'image',
  },
  {
    drawingName: 'Seal Cross-Section',
    extractedImgId: 'img-seal-001',
    type: 'image',
  },
  {
    drawingName: 'page-9_ORDER-1',
    extractedImgId: '5bd4f35c-3b43-47d4-b69a-d7027eba5455',
    type: 'image',
  },
  {
    drawingName: 'Panel Layout',
    extractedImgId: 'img-panel-001',
    type: 'image',
  },
  {
    drawingName: 'Door Assembly',
    extractedImgId: 'img-door-001',
    type: 'image',
  },
  {
    drawingName: 'page-9_ORDER-2',
    extractedImgId: 'b1572339-79e7-4ef7-b095-7d0b54daa06c',
    type: 'image',
  },
  {
    drawingName: 'Compression Spring Drawing',
    extractedImgId: 'img-comp-spring-001',
    type: 'image',
  },
];

export const TABLES = [
  {
    id: 'page-7-tab-1',
    tableName: 'Motor Specifications',
    type: 'table',
    order: 1,
    tableData: [
      ['Part No.', 'Description', 'Quantity', 'Material', 'Weight (kg)'],
      ['MT-001', 'Motor Housing', '1', 'Aluminum Alloy', '2.5'],
      ['MT-002', 'Rotor Assembly', '1', 'Steel', '3.2'],
      ['MT-003', 'Stator Coil', '2', 'Copper', '1.8'],
      ['MT-004', 'Bearing Set', '2', 'Ceramic', '0.3'],
    ],
  },
  {
    id: 'page-7-tab-2',
    tableName: 'Hardware Bill of Materials',
    type: 'table',
    order: 2,
    tableData: [
      ['Item', 'Part Number', 'Description', 'Qty', 'Unit Price'],
      ['1', 'HW-101', 'M8 Bolt', '12', '$0.25'],
      ['2', 'HW-102', 'M8 Nut', '12', '$0.15'],
      ['3', 'HW-103', 'Washer', '24', '$0.05'],
      ['4', 'HW-104', 'Lock Washer', '12', '$0.08'],
    ],
  },
  {
    id: 'tab-fast-001',
    tableName: 'Fastener Specifications',
    type: 'table',
    order: 3,
    tableData: [
      ['Type', 'Size', 'Grade', 'Finish', 'Torque (Nm)'],
      ['Hex Bolt', 'M8x20', '8.8', 'Zinc Plated', '25'],
      ['Hex Bolt', 'M10x25', '10.9', 'Black Oxide', '50'],
      ['Socket Cap', 'M6x16', '12.9', 'Stainless', '12'],
      ['Set Screw', 'M5x12', '8.8', 'Plain', '8'],
    ],
  },
  {
    id: 'tab-bolt-001',
    tableName: 'Bolt Dimensions',
    type: 'table',
    order: 4,
    tableData: [
      ['Size', 'Length (mm)', 'Thread Pitch', 'Head Height', 'Diameter'],
      ['M8', '20', '1.25', '5.3', '8.0'],
      ['M10', '25', '1.5', '6.4', '10.0'],
      ['M12', '30', '1.75', '7.5', '12.0'],
      ['M16', '40', '2.0', '10.0', '16.0'],
    ],
  },
  {
    id: 'tab-bolt-002',
    tableName: 'Bolt Material Properties',
    type: 'table',
    order: 5,
    tableData: [
      ['Grade', 'Tensile Strength (MPa)', 'Yield Strength (MPa)', 'Hardness (HRC)', 'Material'],
      ['8.8', '800', '640', '22-32', 'Carbon Steel'],
      ['10.9', '1040', '940', '32-39', 'Alloy Steel'],
      ['12.9', '1220', '1100', '39-44', 'Alloy Steel'],
      ['A4-70', '700', '450', '—', 'Stainless 316'],
    ],
  },
  {
    id: 'tab-elec-001',
    tableName: 'Electrical Components',
    type: 'table',
    order: 6,
    tableData: [
      ['Component', 'Part No.', 'Rating', 'Voltage', 'Current (A)'],
      ['Power Supply', 'PS-2000', '2kW', '220V AC', '9.1'],
      ['Motor Driver', 'MD-500', '500W', '24V DC', '20.8'],
      ['Control Board', 'CB-101', '50W', '12V DC', '4.2'],
      ['Emergency Stop', 'ES-RED', '10A', '250V AC', '10'],
    ],
  },
  {
    id: 'tab-wire-001',
    tableName: 'Wire Specifications',
    type: 'table',
    order: 7,
    tableData: [
      ['Wire Type', 'AWG', 'Color', 'Length (m)', 'Application'],
      ['Stranded Copper', '14', 'Red', '5.0', 'Power +'],
      ['Stranded Copper', '14', 'Black', '5.0', 'Power -'],
      ['Stranded Copper', '18', 'Blue', '3.5', 'Signal'],
      ['Stranded Copper', '20', 'Green', '2.0', 'Ground'],
    ],
  },
  {
    id: 'tab-conn-001',
    tableName: 'Connector Details',
    type: 'table',
    order: 8,
    tableData: [
      ['Connector', 'Type', 'Pins', 'Current Rating', 'Voltage Rating'],
      ['J1', 'Molex Mini-Fit Jr', '4', '13A', '600V'],
      ['J2', 'JST-XH', '6', '3A', '250V'],
      ['J3', 'Phoenix Contact', '8', '24A', '630V'],
      ['J4', 'D-Sub 9', '9', '5A', '300V'],
    ],
  },
  {
    id: 'page-8-tab-2',
    tableName: 'Liner Materials',
    type: 'table',
    order: 9,
    tableData: [
      ['Part', 'Material', 'Thickness (mm)', 'Hardness (Shore A)', 'Temperature Range'],
      ['Inner Liner', 'Nitrile Rubber', '3.0', '70', '-40°C to 100°C'],
      ['Outer Liner', 'EPDM', '2.5', '60', '-50°C to 150°C'],
      ['Seal Ring', 'Viton', '1.5', '75', '-20°C to 200°C'],
      ['Gasket', 'Silicone', '2.0', '50', '-60°C to 230°C'],
    ],
  },
  {
    id: 'tab-seal-001',
    tableName: 'Seal Dimensions',
    type: 'table',
    order: 10,
    tableData: [
      ['Seal Type', 'Inner Dia. (mm)', 'Outer Dia. (mm)', 'Width (mm)', 'Pressure (bar)'],
      ['O-Ring', '50', '54', '2', '150'],
      ['V-Ring', '60', '70', '5', '80'],
      ['U-Cup', '45', '52', '3.5', '200'],
      ['T-Seal', '55', '62', '4', '120'],
    ],
  },
  {
    id: 'page-9-tab-1',
    tableName: 'Body Components',
    type: 'table',
    order: 11,
    tableData: [
      ['Component', 'Material', 'Finish', 'Weight (kg)', 'Qty'],
      ['Main Housing', 'Cast Iron', 'Powder Coat', '15.5', '1'],
      ['Cover Plate', 'Steel', 'Zinc Plated', '2.3', '1'],
      ['Side Panel', 'Aluminum', 'Anodized', '1.8', '2'],
      ['Mounting Bracket', 'Steel', 'Black Oxide', '0.9', '4'],
    ],
  },
  {
    id: 'tab-panel-001',
    tableName: 'Panel Specifications',
    type: 'table',
    order: 12,
    tableData: [
      ['Panel ID', 'Dimensions (mm)', 'Thickness', 'Material', 'Color'],
      ['P-001', '300x200', '2.0', 'Aluminum', 'Silver'],
      ['P-002', '250x150', '1.5', 'Steel', 'Black'],
      ['P-003', '200x100', '1.0', 'Plastic', 'Gray'],
      ['P-004', '350x250', '2.5', 'Aluminum', 'White'],
    ],
  },
  {
    id: 'tab-door-001',
    tableName: 'Access Door Details',
    type: 'table',
    order: 13,
    tableData: [
      ['Door', 'Size (mm)', 'Hinge Type', 'Lock Type', 'Weight (kg)'],
      ['Front Access', '400x300', 'Piano', 'Keyed Cam', '3.2'],
      ['Side Access', '300x200', 'Butt', 'Quarter Turn', '2.1'],
      ['Top Panel', '350x250', 'Concealed', 'Magnetic', '2.8'],
      ['Rear Service', '450x350', 'Heavy Duty', 'Padlock', '4.5'],
    ],
  },
  {
    id: 'page-9-tab-2',
    tableName: 'Spring Specifications',
    type: 'table',
    order: 14,
    tableData: [
      ['Spring Type', 'Wire Dia. (mm)', 'OD (mm)', 'Free Length (mm)', 'Spring Rate (N/mm)'],
      ['Compression', '2.0', '20', '50', '5.2'],
      ['Extension', '1.5', '15', '40', '3.8'],
      ['Torsion', '2.5', '25', '30', '0.15'],
      ['Wave', '1.0', '18', '2.5', '12.5'],
    ],
  },
  {
    id: 'tab-comp-spring-001',
    tableName: 'Compression Spring Data',
    type: 'table',
    order: 15,
    tableData: [
      ['Part No.', 'Coils', 'Material', 'Load @ Compressed (N)', 'Max Deflection (mm)'],
      ['CS-101', '12', 'Music Wire', '250', '25'],
      ['CS-102', '15', 'Stainless 302', '180', '30'],
      ['CS-103', '10', 'Chrome Silicon', '320', '20'],
      ['CS-104', '18', 'Oil Tempered', '150', '35'],
    ],
  },
];

export const DATA = {
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
        '9a7f3c45-2b1d-4e89-a5c3-d8f2e6b9c4a1',
        'page-7-tab-1',
      ],
      childIds: ['355e0d23-1371-4848-85f9-b6bcc7583f0a', '9a7f3c45-2b1d-4e89-a5c3-d8f2e6b9c4a1'],
      images: [
        {
          drawingName: 'page-7_ORDER-1',
          extractedImgId: '383f29a1-a8cc-4b79-a35b-cbc5f6f2b255',
          type: 'image',
        },
      ],
      tables: [
        {
          id: 'page-7-tab-1',
          tableName: 'Motor Specifications',
          type: 'table',
          order: 1,
          tableData: [
            ['Part No.', 'Description', 'Quantity', 'Material', 'Weight (kg)'],
            ['MT-001', 'Motor Housing', '1', 'Aluminum Alloy', '2.5'],
            ['MT-002', 'Rotor Assembly', '1', 'Steel', '3.2'],
            ['MT-003', 'Stator Coil', '2', 'Copper', '1.8'],
            ['MT-004', 'Bearing Set', '2', 'Ceramic', '0.3'],
          ],
        },
      ],
    },
    '355e0d23-1371-4848-85f9-b6bcc7583f0a': {
      assemblyId: '355e0d23-1371-4848-85f9-b6bcc7583f0a',
      assemblyName: 'HARDWARE',
      itemOrder: ['img-hw-001', 'c8d9e2a1-5f6b-4c3d-9e8a-1b2c3d4e5f6a', 'page-7-tab-2'],
      childIds: ['c8d9e2a1-5f6b-4c3d-9e8a-1b2c3d4e5f6a'],
      images: [
        {
          drawingName: 'Hardware Assembly Drawing',
          extractedImgId: 'img-hw-001',
          type: 'image',
        },
      ],
      tables: [
        {
          id: 'page-7-tab-2',
          tableName: 'Hardware Bill of Materials',
          type: 'table',
          order: 2,
          tableData: [
            ['Item', 'Part Number', 'Description', 'Qty', 'Unit Price'],
            ['1', 'HW-101', 'M8 Bolt', '12', '$0.25'],
            ['2', 'HW-102', 'M8 Nut', '12', '$0.15'],
            ['3', 'HW-103', 'Washer', '24', '$0.05'],
            ['4', 'HW-104', 'Lock Washer', '12', '$0.08'],
          ],
        },
      ],
    },
    'c8d9e2a1-5f6b-4c3d-9e8a-1b2c3d4e5f6a': {
      assemblyId: 'c8d9e2a1-5f6b-4c3d-9e8a-1b2c3d4e5f6a',
      assemblyName: 'FASTENERS',
      itemOrder: ['img-fast-001', '2e4a6c8d-9f1b-4a3c-8e7d-5b6a9c1d2e3f', 'tab-fast-001'],
      childIds: ['2e4a6c8d-9f1b-4a3c-8e7d-5b6a9c1d2e3f'],
      images: [
        {
          drawingName: 'Fastener Details',
          extractedImgId: 'img-fast-001',
          type: 'image',
        },
      ],
      tables: [
        {
          id: 'tab-fast-001',
          tableName: 'Fastener Specifications',
          type: 'table',
          order: 3,
          tableData: [
            ['Type', 'Size', 'Grade', 'Finish', 'Torque (Nm)'],
            ['Hex Bolt', 'M8x20', '8.8', 'Zinc Plated', '25'],
            ['Hex Bolt', 'M10x25', '10.9', 'Black Oxide', '50'],
            ['Socket Cap', 'M6x16', '12.9', 'Stainless', '12'],
            ['Set Screw', 'M5x12', '8.8', 'Plain', '8'],
          ],
        },
      ],
    },
    '2e4a6c8d-9f1b-4a3c-8e7d-5b6a9c1d2e3f': {
      assemblyId: '2e4a6c8d-9f1b-4a3c-8e7d-5b6a9c1d2e3f',
      assemblyName: 'BOLTS',
      itemOrder: ['img-bolt-001', 'tab-bolt-001', 'tab-bolt-002'],
      childIds: [],
      images: [
        {
          drawingName: 'Bolt Technical Drawing',
          extractedImgId: 'img-bolt-001',
          type: 'image',
        },
      ],
      tables: [
        {
          id: 'tab-bolt-001',
          tableName: 'Bolt Dimensions',
          type: 'table',
          order: 4,
          tableData: [
            ['Size', 'Length (mm)', 'Thread Pitch', 'Head Height', 'Diameter'],
            ['M8', '20', '1.25', '5.3', '8.0'],
            ['M10', '25', '1.5', '6.4', '10.0'],
            ['M12', '30', '1.75', '7.5', '12.0'],
            ['M16', '40', '2.0', '10.0', '16.0'],
          ],
        },
        {
          id: 'tab-bolt-002',
          tableName: 'Bolt Material Properties',
          type: 'table',
          order: 5,
          tableData: [
            [
              'Grade',
              'Tensile Strength (MPa)',
              'Yield Strength (MPa)',
              'Hardness (HRC)',
              'Material',
            ],
            ['8.8', '800', '640', '22-32', 'Carbon Steel'],
            ['10.9', '1040', '940', '32-39', 'Alloy Steel'],
            ['12.9', '1220', '1100', '39-44', 'Alloy Steel'],
            ['A4-70', '700', '450', '—', 'Stainless 316'],
          ],
        },
      ],
    },
    '9a7f3c45-2b1d-4e89-a5c3-d8f2e6b9c4a1': {
      assemblyId: '9a7f3c45-2b1d-4e89-a5c3-d8f2e6b9c4a1',
      assemblyName: 'ELECTRICAL',
      itemOrder: ['img-elec-001', '5d3c1a9b-7e2f-4b6a-9c8d-3e1f2a4b5c6d', 'tab-elec-001'],
      childIds: ['5d3c1a9b-7e2f-4b6a-9c8d-3e1f2a4b5c6d'],
      images: [
        {
          drawingName: 'Electrical Schematic',
          extractedImgId: 'img-elec-001',
          type: 'image',
        },
      ],
      tables: [
        {
          id: 'tab-elec-001',
          tableName: 'Electrical Components',
          type: 'table',
          order: 6,
          tableData: [
            ['Component', 'Part No.', 'Rating', 'Voltage', 'Current (A)'],
            ['Power Supply', 'PS-2000', '2kW', '220V AC', '9.1'],
            ['Motor Driver', 'MD-500', '500W', '24V DC', '20.8'],
            ['Control Board', 'CB-101', '50W', '12V DC', '4.2'],
            ['Emergency Stop', 'ES-RED', '10A', '250V AC', '10'],
          ],
        },
      ],
    },
    '5d3c1a9b-7e2f-4b6a-9c8d-3e1f2a4b5c6d': {
      assemblyId: '5d3c1a9b-7e2f-4b6a-9c8d-3e1f2a4b5c6d',
      assemblyName: 'WIRING',
      itemOrder: ['img-wire-001', '8b4e2f1c-6a9d-4c3e-7b5a-9d1c2e3f4a5b', 'tab-wire-001'],
      childIds: ['8b4e2f1c-6a9d-4c3e-7b5a-9d1c2e3f4a5b'],
      images: [
        {
          drawingName: 'Wiring Diagram',
          extractedImgId: 'img-wire-001',
          type: 'image',
        },
      ],
      tables: [
        {
          id: 'tab-wire-001',
          tableName: 'Wire Specifications',
          type: 'table',
          order: 7,
          tableData: [
            ['Wire Type', 'AWG', 'Color', 'Length (m)', 'Application'],
            ['Stranded Copper', '14', 'Red', '5.0', 'Power +'],
            ['Stranded Copper', '14', 'Black', '5.0', 'Power -'],
            ['Stranded Copper', '18', 'Blue', '3.5', 'Signal'],
            ['Stranded Copper', '20', 'Green', '2.0', 'Ground'],
          ],
        },
      ],
    },
    '8b4e2f1c-6a9d-4c3e-7b5a-9d1c2e3f4a5b': {
      assemblyId: '8b4e2f1c-6a9d-4c3e-7b5a-9d1c2e3f4a5b',
      assemblyName: 'CONNECTORS',
      itemOrder: ['img-conn-001', 'tab-conn-001'],
      childIds: [],
      images: [
        {
          drawingName: 'Connector Pinout',
          extractedImgId: 'img-conn-001',
          type: 'image',
        },
      ],
      tables: [
        {
          id: 'tab-conn-001',
          tableName: 'Connector Details',
          type: 'table',
          order: 8,
          tableData: [
            ['Connector', 'Type', 'Pins', 'Current Rating', 'Voltage Rating'],
            ['J1', 'Molex Mini-Fit Jr', '4', '13A', '600V'],
            ['J2', 'JST-XH', '6', '3A', '250V'],
            ['J3', 'Phoenix Contact', '8', '24A', '630V'],
            ['J4', 'D-Sub 9', '9', '5A', '300V'],
          ],
        },
      ],
    },
    '277b621d-4d34-42ac-bd9e-02d96b078402': {
      assemblyId: '277b621d-4d34-42ac-bd9e-02d96b078402',
      assemblyName: 'LINERS',
      itemOrder: [
        '7287b7ed-cd5b-420d-b9bd-5ddc6de2bd31',
        '6f8a9b1c-3d4e-5a7b-9c2d-1e3f4a5b6c7d',
        'page-8-tab-2',
      ],
      childIds: ['6f8a9b1c-3d4e-5a7b-9c2d-1e3f4a5b6c7d'],
      images: [
        {
          drawingName: 'page-8_ORDER-1',
          extractedImgId: '7287b7ed-cd5b-420d-b9bd-5ddc6de2bd31',
          type: 'image',
        },
      ],
      tables: [
        {
          id: 'page-8-tab-2',
          tableName: 'Liner Materials',
          type: 'table',
          order: 9,
          tableData: [
            ['Part', 'Material', 'Thickness (mm)', 'Hardness (Shore A)', 'Temperature Range'],
            ['Inner Liner', 'Nitrile Rubber', '3.0', '70', '-40°C to 100°C'],
            ['Outer Liner', 'EPDM', '2.5', '60', '-50°C to 150°C'],
            ['Seal Ring', 'Viton', '1.5', '75', '-20°C to 200°C'],
            ['Gasket', 'Silicone', '2.0', '50', '-60°C to 230°C'],
          ],
        },
      ],
    },
    '6f8a9b1c-3d4e-5a7b-9c2d-1e3f4a5b6c7d': {
      assemblyId: '6f8a9b1c-3d4e-5a7b-9c2d-1e3f4a5b6c7d',
      assemblyName: 'SEALS',
      itemOrder: ['img-seal-001', 'tab-seal-001'],
      childIds: [],
      images: [
        {
          drawingName: 'Seal Cross-Section',
          extractedImgId: 'img-seal-001',
          type: 'image',
        },
      ],
      tables: [
        {
          id: 'tab-seal-001',
          tableName: 'Seal Dimensions',
          type: 'table',
          order: 10,
          tableData: [
            ['Seal Type', 'Inner Dia. (mm)', 'Outer Dia. (mm)', 'Width (mm)', 'Pressure (bar)'],
            ['O-Ring', '50', '54', '2', '150'],
            ['V-Ring', '60', '70', '5', '80'],
            ['U-Cup', '45', '52', '3.5', '200'],
            ['T-Seal', '55', '62', '4', '120'],
          ],
        },
      ],
    },
    '1652b17f-215b-4900-8fa5-30e537c32fe4': {
      assemblyId: '1652b17f-215b-4900-8fa5-30e537c32fe4',
      assemblyName: 'BODY',
      itemOrder: [
        '5bd4f35c-3b43-47d4-b69a-d7027eba5455',
        '3a5b7c9d-1e2f-4a6b-8c9d-2e3f4a5b6c7d',
        'page-9-tab-1',
      ],
      childIds: ['3a5b7c9d-1e2f-4a6b-8c9d-2e3f4a5b6c7d'],
      images: [
        {
          drawingName: 'page-9_ORDER-1',
          extractedImgId: '5bd4f35c-3b43-47d4-b69a-d7027eba5455',
          type: 'image',
        },
      ],
      tables: [
        {
          id: 'page-9-tab-1',
          tableName: 'Body Components',
          type: 'table',
          order: 11,
          tableData: [
            ['Component', 'Material', 'Finish', 'Weight (kg)', 'Qty'],
            ['Main Housing', 'Cast Iron', 'Powder Coat', '15.5', '1'],
            ['Cover Plate', 'Steel', 'Zinc Plated', '2.3', '1'],
            ['Side Panel', 'Aluminum', 'Anodized', '1.8', '2'],
            ['Mounting Bracket', 'Steel', 'Black Oxide', '0.9', '4'],
          ],
        },
      ],
    },
    '3a5b7c9d-1e2f-4a6b-8c9d-2e3f4a5b6c7d': {
      assemblyId: '3a5b7c9d-1e2f-4a6b-8c9d-2e3f4a5b6c7d',
      assemblyName: 'PANELS',
      itemOrder: ['img-panel-001', '7c9e1a3b-5d6f-4a8b-9c1d-2e3f4a5b6c7d', 'tab-panel-001'],
      childIds: ['7c9e1a3b-5d6f-4a8b-9c1d-2e3f4a5b6c7d'],
      images: [
        {
          drawingName: 'Panel Layout',
          extractedImgId: 'img-panel-001',
          type: 'image',
        },
      ],
      tables: [
        {
          id: 'tab-panel-001',
          tableName: 'Panel Specifications',
          type: 'table',
          order: 12,
          tableData: [
            ['Panel ID', 'Dimensions (mm)', 'Thickness', 'Material', 'Color'],
            ['P-001', '300x200', '2.0', 'Aluminum', 'Silver'],
            ['P-002', '250x150', '1.5', 'Steel', 'Black'],
            ['P-003', '200x100', '1.0', 'Plastic', 'Gray'],
            ['P-004', '350x250', '2.5', 'Aluminum', 'White'],
          ],
        },
      ],
    },
    '7c9e1a3b-5d6f-4a8b-9c1d-2e3f4a5b6c7d': {
      assemblyId: '7c9e1a3b-5d6f-4a8b-9c1d-2e3f4a5b6c7d',
      assemblyName: 'ACCESS_DOORS',
      itemOrder: ['img-door-001', 'tab-door-001'],
      childIds: [],
      images: [
        {
          drawingName: 'Door Assembly',
          extractedImgId: 'img-door-001',
          type: 'image',
        },
      ],
      tables: [
        {
          id: 'tab-door-001',
          tableName: 'Access Door Details',
          type: 'table',
          order: 13,
          tableData: [
            ['Door', 'Size (mm)', 'Hinge Type', 'Lock Type', 'Weight (kg)'],
            ['Front Access', '400x300', 'Piano', 'Keyed Cam', '3.2'],
            ['Side Access', '300x200', 'Butt', 'Quarter Turn', '2.1'],
            ['Top Panel', '350x250', 'Concealed', 'Magnetic', '2.8'],
            ['Rear Service', '450x350', 'Heavy Duty', 'Padlock', '4.5'],
          ],
        },
      ],
    },
    'b8810a2a-9cc1-4cc9-bf42-e62f15a96d35': {
      assemblyId: 'b8810a2a-9cc1-4cc9-bf42-e62f15a96d35',
      assemblyName: 'SPRINGS',
      itemOrder: [
        'b1572339-79e7-4ef7-b095-7d0b54daa06c',
        '9d1e3f5a-7b9c-4d2e-6f8a-1c3b5d7e9f1a',
        'page-9-tab-2',
      ],
      childIds: ['9d1e3f5a-7b9c-4d2e-6f8a-1c3b5d7e9f1a'],
      images: [
        {
          drawingName: 'page-9_ORDER-2',
          extractedImgId: 'b1572339-79e7-4ef7-b095-7d0b54daa06c',
          type: 'image',
        },
      ],
      tables: [
        {
          id: 'page-9-tab-2',
          tableName: 'Spring Specifications',
          type: 'table',
          order: 14,
          tableData: [
            ['Spring Type', 'Wire Dia. (mm)', 'OD (mm)', 'Free Length (mm)', 'Spring Rate (N/mm)'],
            ['Compression', '2.0', '20', '50', '5.2'],
            ['Extension', '1.5', '15', '40', '3.8'],
            ['Torsion', '2.5', '25', '30', '0.15'],
            ['Wave', '1.0', '18', '2.5', '12.5'],
          ],
        },
      ],
    },
    '9d1e3f5a-7b9c-4d2e-6f8a-1c3b5d7e9f1a': {
      assemblyId: '9d1e3f5a-7b9c-4d2e-6f8a-1c3b5d7e9f1a',
      assemblyName: 'COMPRESSION_SPRINGS',
      itemOrder: ['img-comp-spring-001', 'tab-comp-spring-001'],
      childIds: [],
      images: [
        {
          drawingName: 'Compression Spring Drawing',
          extractedImgId: 'img-comp-spring-001',
          type: 'image',
        },
      ],
      tables: [
        {
          id: 'tab-comp-spring-001',
          tableName: 'Compression Spring Data',
          type: 'table',
          order: 15,
          tableData: [
            ['Part No.', 'Coils', 'Material', 'Load @ Compressed (N)', 'Max Deflection (mm)'],
            ['CS-101', '12', 'Music Wire', '250', '25'],
            ['CS-102', '15', 'Stainless 302', '180', '30'],
            ['CS-103', '10', 'Chrome Silicon', '320', '20'],
            ['CS-104', '18', 'Oil Tempered', '150', '35'],
          ],
        },
      ],
    },
  },
};
