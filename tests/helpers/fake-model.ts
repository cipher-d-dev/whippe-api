/**
 * A tiny in-memory stand-in for a Mongoose model, for tests where no MongoDB is
 * available. Queries use real Mongo syntax (matched by mingo). Ids are strings.
 */
import { Query as Mingo } from 'mingo';

type Doc = Record<string, any>;
let seq = 0;
export const newId = () => (++seq).toString(16).padStart(24, '0');

const isOid = (v: any) => v && typeof v === 'object' && v._bsontype === 'ObjectId';
export function norm(v: any): any {
  if (isOid(v)) return String(v);
  if (v instanceof Date || v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(norm);
  if (typeof v.toHexString === 'function') return v.toHexString();
  const out: Doc = {};
  for (const [k, x] of Object.entries(v)) if (typeof x !== 'function') out[k] = norm(x);
  return out;
}

function setPath(d: Doc, path: string, value: unknown) {
  const parts = path.split('.');
  let cur = d;
  for (const p of parts.slice(0, -1)) cur = cur[p] ??= {};
  cur[parts[parts.length - 1]] = value;
}

class Q<T> implements PromiseLike<T> {
  private sortSpec?: Doc;
  private n?: number;
  constructor(private run: (sort?: Doc, n?: number) => T) {}
  sort(s: Doc) { this.sortSpec = s; return this; }
  limit(n: number) { this.n = n; return this; }
  select() { return this; }
  populate() { return this; }
  lean() { return this; }
  then<A, B>(ok?: ((v: T) => A | PromiseLike<A>) | null, bad?: ((e: any) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run(this.sortSpec, this.n)).then(ok, bad);
  }
}

export function fakeModel(name: string) {
  const store: Doc[] = [];
  const wrap = (d: Doc) => {
    Object.defineProperties(d, {
      save: { value: async () => { Object.assign(d, norm({ ...d }), { updatedAt: new Date() }); return d; }, enumerable: false, configurable: true },
      deleteOne: { value: async () => { store.splice(store.indexOf(d), 1); }, enumerable: false, configurable: true },
      markModified: { value: () => undefined, enumerable: false, configurable: true },
    });
    return d;
  };
  const match = (f: Doc = {}) => { const q = new Mingo(norm(f)); return store.filter((d) => q.test(d)); };
  const sorted = (rows: Doc[], s?: Doc, n?: number) => {
    let r = [...rows];
    if (s) {
      const keys = Object.entries(s);
      r.sort((a, b) => {
        for (const [k, dir] of keys) {
          const x = a[k] ?? null, y = b[k] ?? null;
          if (x === y) continue;
          if (x === null) return 1;
          if (y === null) return -1;
          return (x < y ? -1 : 1) * (dir as number);
        }
        return 0;
      });
    }
    return n !== undefined ? r.slice(0, n) : r;
  };
  const insert = (d: Doc) => {
    const now = new Date();
    const doc = wrap({ _id: newId(), createdAt: now, updatedAt: now, ...norm(d) });
    store.push(doc);
    return doc;
  };
  return {
    name,
    store,
    insert,
    create: async (d: Doc) => insert(d),
    find: (f?: Doc) => new Q((s, n) => sorted(match(f), s, n)),
    findOne: (f?: Doc) => new Q((s) => sorted(match(f), s)[0] ?? null),
    findById: (id: any) => new Q(() => store.find((d) => d._id === String(id)) ?? null),
    exists: async (f: Doc) => match(f).length > 0,
    countDocuments: async (f?: Doc) => match(f).length,
    distinct: async (k: string) => [...new Set(store.map((d) => d[k]))],
    findOneAndUpdate: async (f: Doc, u: Doc, o: Doc = {}) => {
      const found = match(f)[0];
      if (found) { if (u.$set) for (const [k, v] of Object.entries(u.$set)) setPath(found, k, norm(v)); return found; }
      if (!o.upsert) return null;
      return insert({ ...f, ...(u.$setOnInsert ?? {}), ...(u.$set ?? {}) });
    },
    updateOne: async (f: Doc, u: Doc) => { const d = match(f)[0]; if (d && u.$set) for (const [k, v] of Object.entries(u.$set)) setPath(d, k, norm(v)); return { modifiedCount: d ? 1 : 0 }; },
    updateMany: async (f: Doc, u: Doc) => { const rows = match(f); for (const d of rows) for (const [k, v] of Object.entries(u.$set ?? {})) setPath(d, k, norm(v)); return { modifiedCount: rows.length }; },
    deleteMany: async (f: Doc) => { const rows = match(f); for (const d of rows) store.splice(store.indexOf(d), 1); return { deletedCount: rows.length }; },
  };
}
