import { DBSchema, IDBPDatabase, openDB } from "idb";
import { BrowserDocument } from "./types";

interface PrivacyDriveDatabase extends DBSchema {
  documents: {
    key: string;
    value: BrowserDocument;
    indexes: { "by-created": number };
  };
}

let database: Promise<IDBPDatabase<PrivacyDriveDatabase>> | undefined;

const getDatabase = () => {
  if (!database) {
    database = openDB<PrivacyDriveDatabase>("privacydrive-browser", 1, {
      upgrade(db) {
        const store = db.createObjectStore("documents", { keyPath: "id" });
        store.createIndex("by-created", "createdAt");
      },
    });
  }
  return database;
};

export async function listBrowserDocuments(): Promise<BrowserDocument[]> {
  const values = await (await getDatabase()).getAllFromIndex("documents", "by-created");
  return values.reverse();
}

export async function saveBrowserDocument(document: BrowserDocument): Promise<void> {
  await (await getDatabase()).put("documents", document);
}

export async function removeBrowserDocument(id: string): Promise<void> {
  await (await getDatabase()).delete("documents", id);
}
