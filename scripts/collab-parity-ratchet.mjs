import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CANONICAL_COMMIT = "11e583637c29d1c7ae9f6ae61630e1288df6030b";

const expected = {
  "SyncManager.ts":
    "a9c3e0f19f4d001f5f1ab475d221a36b80ab4966971409b58c42722b6f3ac003",
  "collabStateMachine.ts":
    "26c0f3029a33c6e00435fbec59958a42358e643fe2208aa88e5f1666d31239f0",
  "floor.ts":
    "8e6c868a7595e92c74fd5af789f71d1578e06129dbc23b22481dae89e2f1febc",
  "index.ts":
    "a905c6333d47bf84b35d1941b6ee533f2267d7f04b0d3dc6574984c10bbc7b29",
  "presence.ts":
    "da7afaf04112a01b4c8ff221aef4f1ce22ff91a5b46ebf2205ca9b7640b8873a",
  "session-tools.ts":
    "9b0fa36d88c5f2c81cb91b6fc4e961d5bfcb2b18a5b102c96601c2bde227abf1",
  "socketClient.ts":
    "e417be7ced905c91a76eaa9f3a47b7cfbe39c6eb479507012efea4d8d0d1ffe0",
  "types/index.ts":
    "dd1b286860570c142672afe194f7cb5d9f01d6305b7d1c34b2d3c25532f215f3",
  "useSyncManager.ts":
    "89a658daff71d5aaf5b7972514c74f1fd160c3a8aef23ca54d7f8f7293ec401e",
  "crypto/index.ts":
    "6aa9504750e6f049183f6b6c40bba7ef91e280ecae78723e156c6d4ccf2928fd",
  "crypto/room-key.ts":
    "9d07b8296315f851eba7cc1a8d26cf48b8ba1951e69b2e1a8cb8501eb6ff2cba",
  "utils/createAwarenessUpdateHandler.ts":
    "05d38cf00f54046735ae59f07eadbc14c1780df00f7b3ab6c95f15dbc7fb04b2",
};

const normalize = (file, input) => {
  let source = input;

  if (file === "presence.ts") {
    source = source
      .replaceAll("CollabUser", "IDocCollabUsers")
      .replace(
        "import { IDocCollabUsers } from './types';",
        "import { IDocCollabUsers } from '../types';",
      );
  }

  if (file === "session-tools.ts") {
    source = source.replaceAll("dsheetId", "ddocId");
  }

  if (file === "socketClient.ts") {
    source = source
      .replaceAll("CollabUser", "IDocCollabUsers")
      .replace("  CollabUser,\n", "")
      .replace(
        "import { buildIdentityMap, mergePresence, identitySignature } from './presence';",
        "import { buildIdentityMap, mergePresence, identitySignature } from './presence';\nimport { IDocCollabUsers } from '../types';",
      )
      .replace("  IDocCollabUsers,\n", "")
      .replace("      appType: 'dsheet',\n", "");
  }

  if (file === "types/index.ts") {
    source = source
      .replaceAll("CollabUser", "IDocCollabUsers")
      .replace(
        "import * as Y from 'yjs';",
        "import { Data, IDocCollabUsers } from '../../types';\nimport * as Y from 'yjs';",
      )
      .replace(/\/\*\* dSheet presence identity[\s\S]*?\n}\n\n/, "")
      .replace(
        "  /** Spreadsheet-only awareness color used by Fortune cell cursors. */\n  color?: string;\n",
        "",
      )
      .replace(
        "  onLocalUpdate?: (updatedDocContent: string, updateChunk: string) => void;",
        "  onLocalUpdate?: (\n    updatedDocContent: Data['editorJSONData'],\n    updateChunk: string,\n  ) => void;",
      )
      .replace("export type AppType = 'ddoc' | 'dsheet';\n\n", "")
      .replace("  appType?: AppType;\n", "");
  }

  if (file === "crypto/index.ts") {
    source = source.replace(
      "from '@noble/curves/secp256k1.js';",
      "from '@noble/curves/secp256k1';",
    );
  }

  return source;
};

const root = resolve("src/sync-local");
const failures = [];

for (const [file, expectedHash] of Object.entries(expected)) {
  const source = readFileSync(resolve(root, file), "utf8");
  const hash = createHash("sha256")
    .update(normalize(file, source))
    .digest("hex");
  if (hash !== expectedHash) failures.push({ file, expectedHash, hash });
}

const lifecyclePolicy = readFileSync(
  resolve("src/editor/hooks/collaboration-lifecycle.ts"),
  "utf8",
);
const editorSync = readFileSync(
  resolve("src/editor/hooks/use-editor-sync.tsx"),
  "utf8",
);
const editorData = readFileSync(
  resolve("src/editor/hooks/use-editor-data.tsx"),
  "utf8",
);
const editorContext = readFileSync(
  resolve("src/editor/contexts/editor-context.tsx"),
  "utf8",
);
const editorShell = readFileSync(
  resolve("src/editor/dsheet-editor.tsx"),
  "utf8",
);
const editorWorkbook = readFileSync(
  resolve("src/editor/components/editor-workbook.tsx"),
  "utf8",
);
const editorHandle = readFileSync(
  resolve("src/editor/utils/editor-handle.ts"),
  "utf8",
);
const collabAwareness = readFileSync(
  resolve("src/editor/hooks/use-collab-awareness.tsx"),
  "utf8",
);
const persistenceUtils = readFileSync(
  resolve("src/persistence-utils.ts"),
  "utf8",
);

const lifecycleChecks = [
  {
    file: "editor/hooks/collaboration-lifecycle.ts",
    contract: "30-second dDoc warm disconnect cadence",
    valid: lifecyclePolicy.includes("COLLAB_WARM_MS = 30_000"),
  },
  {
    file: "editor/hooks/collaboration-lifecycle.ts",
    contract: "livePresence/connectOnOpen keep-alive policy",
    valid:
      lifecyclePolicy.includes("connection.livePresence === true") &&
      lifecyclePolicy.includes("connection.connectOnOpen === true"),
  },
  {
    file: "editor/hooks/use-editor-sync.tsx",
    contract: "published state merges before IndexedDB replay",
    valid:
      editorSync.indexOf(
        "mergePublishedContentIntoYdoc(ydoc, portalContent)",
      ) < editorSync.indexOf("new IndexeddbPersistence(dsheetId, ydoc)"),
  },
  {
    file: "editor/hooks/use-editor-sync.tsx",
    contract: "one Y.Doc is retained for the provider lifetime",
    valid:
      editorSync.includes("useState(() => new Y.Doc())") &&
      !editorSync.includes("}, [dsheetId]);"),
  },
  {
    file: "editor/hooks/use-editor-sync.tsx",
    contract: "IndexedDB failure reports and continues without persistence",
    valid:
      editorSync.includes(
        "onIndexedDbErrorRef.current?.(indexedDbError)",
      ) &&
      editorSync.includes("const onIndexedDbErrorRef = useRef(onIndexedDbError)") &&
      editorSync.includes("continue without IndexedDB"),
  },
  {
    file: "editor/hooks/use-editor-sync.tsx",
    contract: "ordinary React cleanup never terminates the durable session",
    valid: !editorSync.includes("terminateSession();"),
  },
  {
    file: "editor/hooks/use-editor-data.tsx",
    contract: "collaboration keeps the published read-only baseline",
    valid:
      !editorData.includes("if (collabEnabled) return;") &&
      editorData.includes("shouldRenderBootstrappedWorkbook("),
  },
  {
    file: "editor/hooks/use-editor-data.tsx",
    contract: "published hydration is not replayed as a remote workbook update",
    valid: editorData.includes("transaction.origin === 'self'"),
  },
  {
    file: "editor/contexts/editor-context.tsx",
    contract: "initial and reconnect hydration each rebuild Fortune once",
    valid:
      editorContext.includes("getWorkbookHydrationReason(") &&
      /hasHydratedReadyState\s*\?\s*["']reconnect["']\s*:\s*["']initial["']/.test(
        lifecyclePolicy,
      ),
  },
  {
    file: "editor/dsheet-editor.tsx",
    contract: "empty rooms initialize defaults only after durable hydration",
    valid:
      lifecyclePolicy.includes("shouldInitializeDefaultWorkbook") &&
      editorShell.includes("shouldInitializeDefaultWorkbook(") &&
      !editorShell.includes("if (collabEnabled) return;"),
  },
  {
    file: "editor/hooks/collaboration-lifecycle.ts",
    contract: "published artifacts retain their original Yjs identities",
    valid:
      persistenceUtils.includes("Y.applyUpdate(doc, update, origin)") &&
      !persistenceUtils.includes("cloneYValue") &&
      editorSync.includes(
        "mergePublishedContentIntoYdoc(ydoc, portalContent)",
      ),
  },
  {
    file: "editor/components/editor-workbook.tsx",
    contract: "durable-only sessions do not enable live workbook restrictions",
    valid:
      lifecyclePolicy.includes("isLiveCollaborationSession") &&
      editorWorkbook.includes("isRTCActive={isLiveCollabSession}"),
  },
  {
    file: "editor/hooks/use-collab-awareness.tsx",
    contract: "socket membership owns the collaborator roster",
    valid: !collabAwareness.includes("onCollaboratorsChange"),
  },
  {
    file: "editor/hooks/use-collab-awareness.tsx",
    contract: "SyncManager owns local awareness cleanup",
    valid: !collabAwareness.includes("'hook unmount'"),
  },
  {
    file: "editor/utils/editor-handle.ts",
    contract: "Workbook remounts compose every public editor method",
    valid:
      editorShell.includes(
        "React.forwardRef<DSheetEditorHandle, DsheetProps>",
      ) &&
      editorContext.includes("setSheetEditorRef") &&
      editorHandle.includes("refreshIndexedDB") &&
      editorHandle.includes("terminateSession") &&
      editorHandle.includes("updateCollaboratorName") &&
      editorHandle.includes("updateSessionTitle"),
  },
];

const lifecycleFailures = lifecycleChecks.filter(({ valid }) => !valid);

if (failures.length > 0 || lifecycleFailures.length > 0) {
  console.error(
    `dSheet collaboration drifted from dDoc ${CANONICAL_COMMIT}:\n` +
      failures
        .map(
          ({ file, expectedHash, hash }) =>
            `- ${file}: expected ${expectedHash}, received ${hash}`,
        )
        .concat(
          lifecycleFailures.map(
            ({ file, contract }) => `- ${file}: violated ${contract}`,
          ),
        )
        .join("\n"),
  );
  process.exit(1);
}

console.log(
  `dSheet core collaboration transport matches dDoc ${CANONICAL_COMMIT}; configured dSheet integration policies passed.`,
);
