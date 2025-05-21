# Dsheet Editor

[dsheet.new](http://dsheet.new/) is your onchain, privacy-first alternative to G\**gle D*cs: peer-to-peer, end-to-end encrypted, and decentralized. It enables secure, real-time, and async collaboration without compromising user privacy.

<img width="4410" alt="github_banner_final@3x" src="./package/assets/sheet.png" />

This repository contains:

- `/package` – The core package code.
- Example & demo source code to showcase dSheets functionalities.

## Usage

### Prequisites

To use dSheet, ensure your project is set up with Tailwind CSS and have a Tailwind configuration file.

### Install & import

Add the following imports :

```javascript
import { DSheetEditor } from '@fileverse-dev/dsheet';
import '@fileverse-dev/dsheet/styles'; // in App.jsx/App.tsx
```

### Update Tailwind Config

In your tailwind config, add this line to content array :

`@fileverse-dev/dsheet/dist/index.es.js`

You should now be set to use dSheets!

# dSheetProps Interface

The `DsheetProps` interface is a TypeScript interface that defines the properties for a page-related component. It includes properties for handling preview mode, managing publishing data, and optionally storing metadata and content associated with the page.

## Core Props

| Property                 | Type                                          | Description                                     |
| ------------------------ | --------------------------------------------- | ----------------------------------------------- |
| `portalContent`         | `JSONContent`                                 | Initial content of the editor                   |
| `onChange`               | `(changes: JSONContent, chunk?: any) => void` | Callback triggered on editor content changes    |
| `ref`                    | `React.RefObject`                             | Reference to access editor instance             |
| `isReadOnly`          | `boolean`                                     | Controls if editor is in preview/read-only mode |
| `dsheetId`          | `string`                                     | Used as room id for collaboration |

### Steps to run this example locally

- `cd demo`
- `npm i`
- `npm run dev`

It will open up a vite server, that will have the Dsheet Editor.

⚠️ This repository is currently undergoing rapid development, over the time more customization and API will be added.

## Architecture

The dSheet Editor has been refactored to follow a clean architecture with separation of concerns:

### Data Layer

- `DSheetDataProvider` - Core class that manages all YJS document operations, including:
  - Real-time collaboration via WebRTC
  - Persistence via IndexedDB
  - Data import/export
  - Sheet data operations

### React Integration

- `useDSheetData` - React hook that provides a simple interface to the data provider
- `useTemplateManager` - Dedicated hook for template handling
- `useXLSXImportAdapter` - Simplified XLSX import functionality

### Utility Layer

- `csv-import-adapter.ts` - CSV import functionality
- `export-adapters.ts` - Export functions for XLSX, CSV, and JSON formats
- `custom-toolbar-items.ts` - UI components for the toolbar

### Main Component

- `SpreadsheetEditor` - The main React component that ties everything together

This architecture provides several benefits:

1. **Separation of Concerns** - Each part of the system has a clear responsibility
2. **Maintainability** - Easier to modify or extend specific parts of the system
3. **Testability** - Components and functions can be tested in isolation
4. **Performance** - Optimized rendering and data flow
5. **Type Safety** - Improved TypeScript typing throughout the codebase