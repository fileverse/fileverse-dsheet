import { MutableRefObject } from 'react';

/**
 * Scoped guard for RTC remote → local apply.
 *
 * `remoteUpdateRef` used to stay true for seconds (holdRemoteApplyLock), which
 * blocked real user metadata writes via guardRemoteEcho. Depth tracks only the
 * synchronous remote-apply window (plus one paint for structural remounts).
 */
export type RemoteApplyGuardRefs = {
  remoteApplyDepthRef: MutableRefObject<number>;
  remoteUpdateRef: MutableRefObject<boolean>;
};

export function syncRemoteUpdateFlag(refs: RemoteApplyGuardRefs) {
  refs.remoteUpdateRef.current = refs.remoteApplyDepthRef.current > 0;
}

export function beginRemoteApply(refs: RemoteApplyGuardRefs) {
  refs.remoteApplyDepthRef.current += 1;
  syncRemoteUpdateFlag(refs);
}

export function endRemoteApply(refs: RemoteApplyGuardRefs) {
  refs.remoteApplyDepthRef.current = Math.max(
    0,
    refs.remoteApplyDepthRef.current - 1,
  );
  syncRemoteUpdateFlag(refs);
}

export function runUnderRemoteApply(
  refs: RemoteApplyGuardRefs,
  fn: () => void,
) {
  beginRemoteApply(refs);
  try {
    fn();
  } finally {
    endRemoteApply(refs);
  }
}

/** End after Workbook remount hooks have flushed (2 rAF ≈ one paint). */
export function endRemoteApplyAfterPaint(refs: RemoteApplyGuardRefs) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      endRemoteApply(refs);
    });
  });
}
