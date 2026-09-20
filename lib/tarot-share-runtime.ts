import type { ReadingShareSource } from "./tarot-share-contract";
import { resolvePublicOrigin } from "./tarot-share-config";
import { ShareService } from "./tarot-share-service";
import { ShareStorageUnavailableError, UnavailableShareStore } from "./tarot-share-store";

const unavailableSource: ReadingShareSource = {
  async loadShareableReading() {
    throw new ShareStorageUnavailableError();
  },
};

/**
 * The production seam stays unavailable until the explicitly authorized
 * reading_shares/share_events migration and adapter exist. This is intentionally
 * not an in-memory fallback.
 */
export function getProductionShareService(): ShareService {
  return new ShareService({
    store: new UnavailableShareStore(),
    source: unavailableSource,
    origin: resolvePublicOrigin(),
  });
}
