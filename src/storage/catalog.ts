import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export type CatalogDeck = {id: string; title: string; source: string; revision: string; updated: string};
export class Catalog {
  readonly db: DatabaseSync;
  constructor(readonly directory: string) {
    mkdirSync(directory, {recursive: true});
    this.db = new DatabaseSync(path.join(directory, 'catalog.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS decks (id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL UNIQUE, revision TEXT NOT NULL, updated TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS inspections (deck_id TEXT NOT NULL, revision TEXT NOT NULL, recorded TEXT NOT NULL, PRIMARY KEY(deck_id, revision));
      CREATE TABLE IF NOT EXISTS builds (id INTEGER PRIMARY KEY, deck_id TEXT NOT NULL, revision TEXT NOT NULL, output TEXT NOT NULL, status TEXT NOT NULL, diagnostics TEXT NOT NULL, recorded TEXT NOT NULL);`);
  }
  list() {return this.db.prepare('SELECT * FROM decks ORDER BY updated DESC').all() as CatalogDeck[];}
  get(id: string) {const deck = this.db.prepare('SELECT * FROM decks WHERE id=?').get(id) as CatalogDeck | undefined; if (!deck) throw new Error(`Unknown presentation: ${id}`); return deck;}
  register(id: string, title: string, source: string, revision: string) {
    const existing = this.list().find(d => d.id === id);
    if (existing && existing.source !== source) throw new Error(`Presentation ID already belongs to ${existing.source}`);
    const now = new Date().toISOString();
    this.db.prepare('INSERT INTO decks VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, revision=excluded.revision, updated=excluded.updated').run(id, title, source, revision, now);
    this.db.prepare('INSERT OR IGNORE INTO inspections VALUES (?, ?, ?)').run(id, revision, now);
    return this.get(id);
  }
  recordBuild(id: string, revision: string, output: string, status: string, diagnostics: string) {
    this.db.prepare('INSERT INTO builds (deck_id, revision, output, status, diagnostics, recorded) VALUES (?, ?, ?, ?, ?, ?)').run(id, revision, output, status, diagnostics, new Date().toISOString());
  }
  close() {this.db.close();}
}
