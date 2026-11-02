import { DBSchema, IDBPDatabase, openDB } from "idb";
import { BrowserDocument } from "./types";

interface PrivacyDriveDatabase extends DBSchema {
  documents: {
    key: string;
    value: BrowserDocument;
    indexes: { "by-created": number; "by-owner-created": [string, number] };
  };
}

let database: Promise<IDBPDatabase<PrivacyDriveDatabase>> | undefined;

const getDatabase = () => {
  if (!database) {
    database = openDB<PrivacyDriveDatabase>("privacydrive-browser", 2, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        const store = oldVersion < 1
          ? db.createObjectStore("documents", { keyPath: "id" })
          : transaction.objectStore("documents");
        if (oldVersion < 1) store.createIndex("by-created", "createdAt");
        if (oldVersion < 2) store.createIndex("by-owner-created", ["ownerId", "createdAt"]);
      },
    });
  }
  return database;
};

export async function listBrowserDocuments(ownerId: string): Promise<BrowserDocument[]> {
  const range = IDBKeyRange.bound([ownerId, 0], [ownerId, Number.MAX_SAFE_INTEGER]);
  const values = await (await getDatabase()).getAllFromIndex("documents", "by-owner-created", range);
  return values.reverse();
}

export async function claimLegacyBrowserDocuments(ownerId: string): Promise<void> {
  const db = await getDatabase();
  const transaction = db.transaction("documents", "readwrite");
  let cursor = await transaction.store.openCursor();
  while (cursor) {
    if (!cursor.value.ownerId) await cursor.update({ ...cursor.value, ownerId });
    cursor = await cursor.continue();
  }
  await transaction.done;
}

export async function saveBrowserDocument(document: BrowserDocument, ownerId: string): Promise<void> {
  await (await getDatabase()).put("documents", { ...document, ownerId });
}

export async function removeBrowserDocument(id: string, ownerId: string): Promise<void> {
  const db = await getDatabase();
  const document = await db.get("documents", id);
  if (document?.ownerId === ownerId) await db.delete("documents", id);
}
