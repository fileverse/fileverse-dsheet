import * as Comlink from 'comlink';
import {
  parseXlsxWorkbook,
  type XlsxParseSettings,
  type XlsxParsedWorkbook,
} from '../editor/utils/xlsx-import-pipeline';

/**
 * The dsheet offload worker. One worker, many tasks: add new offloadable
 * operations as methods on this object — the client (dsheet-worker-client)
 * exposes them through the same Comlink proxy. Everything reachable from
 * here must stay DOM/React/Yjs-free; the worker bundle is built standalone
 * and inlined into the package, so main-bundle externals do not exist here.
 */
const dsheetWorkerApi = {
  parseXlsxWorkbook: (
    file: File,
    settings?: XlsxParseSettings,
  ): Promise<XlsxParsedWorkbook> => parseXlsxWorkbook(file, settings),
};

export type DsheetWorkerApi = typeof dsheetWorkerApi;

Comlink.expose(dsheetWorkerApi);
