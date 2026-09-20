import type { ReadingShareSource } from "./tarot-share-contract";
import { getTarotRepository } from "./tarot-repository";
import { resolvePublicOrigin } from "./tarot-share-config";
import { ShareService } from "./tarot-share-service";
import { createDatabaseReadingShareSource } from "./tarot-share-source";
import { DatabaseShareStore, ShareStorageUnavailableError, UnavailableShareStore } from "./tarot-share-store";

const unavailableSource: ReadingShareSource = {
  async loadShareableReading() {
    throw new ShareStorageUnavailableError();
  },
};

export async function getProductionShareService(): Promise<ShareService> {
  try {
    const { getRuntimeDatabase } = await import("./runtime");
    const database = getRuntimeDatabase();
    const repository = getTarotRepository(database);
    return new ShareService({
      store: new DatabaseShareStore(database),
      source: createDatabaseReadingShareSource({ database, repository }),
      origin: resolvePublicOrigin(),
    });
  } catch {
    // Runtime storage failures remain fail-closed and are mapped by the existing route shells.
    return new ShareService({
      store: new UnavailableShareStore(),
      source: unavailableSource,
      origin: resolvePublicOrigin(),
    });
  }
}
