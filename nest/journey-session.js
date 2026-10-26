/**
 * Tracks which exercise a reflection or save belongs to.
 * Closing, logging out, or starting again invalidates the previous one.
 */

export const SAVE_ERROR = 'That did not save. Your answers are still here. You can try again.';

export function createJourneySession() {
  let sessionGeneration = 0;
  let reflectEpoch = 0;
  let activeReflect = 0;
  let reflectController = null;
  let saveLock = null;

  function abortReflect() {
    if (!reflectController) return;
    reflectController.abort();
    reflectController = null;
  }

  return {
    generation() {
      return sessionGeneration;
    },
    invalidate() {
      sessionGeneration += 1;
      reflectEpoch += 1;
      activeReflect = 0;
      abortReflect();
      return sessionGeneration;
    },
    beginReflect() {
      abortReflect();
      reflectEpoch += 1;
      const controller = new AbortController();
      reflectController = controller;
      activeReflect = reflectEpoch;
      return {
        sessionGeneration,
        reflectEpoch,
        signal: controller.signal,
        abort() {
          controller.abort();
        },
      };
    },
    reflectApplies(ticket) {
      return !!(
        ticket &&
        ticket.sessionGeneration === sessionGeneration &&
        ticket.reflectEpoch === activeReflect
      );
    },
    tryBeginSave(memberId) {
      if (saveLock || !memberId) return null;
      saveLock = { sessionGeneration, memberId };
      return saveLock;
    },
    finishSave(lock) {
      if (saveLock === lock) saveLock = null;
    },
    saveApplies(lock, memberId) {
      return !!(
        lock &&
        saveLock === lock &&
        lock.sessionGeneration === sessionGeneration &&
        lock.memberId &&
        lock.memberId === memberId
      );
    },
  };
}

export function saveOutcome(applies, failed) {
  if (!applies) {
    return { updateScreen: false, keepAnswers: true, restoreSave: false };
  }
  if (failed) {
    return {
      updateScreen: true,
      keepAnswers: true,
      restoreSave: true,
      message: SAVE_ERROR,
    };
  }
  return { updateScreen: true, keepAnswers: false, restoreSave: true, saved: true };
}
