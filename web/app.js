// gen/InferGenerate.ts
var API_NAME = "infer.generate";
var API_VERSION = 1;
var SCHEMA = 9792305935782336085n;
var CALL_DEADLINE_MS = 8e3;
var HEADER = 17;
var MAX_PAYLOAD = 16 << 20;
var K_HELLO = 0;
var K_REQ = 1;
var K_RESP = 2;
var K_ERR = 3;
var K_SUB = 5;
var K_ITEM = 6;
var K_END = 7;
var WireError = class extends Error {
};
var Timeout = class extends WireError {
};
var Closed = class extends WireError {
};
var DecodeError = class extends WireError {
};
var Refused = class extends WireError {
  kind;
  detail;
  extra;
  constructor(kind, detail, extra = {}) {
    super(detail === void 0 ? kind : `${kind}: ${String(detail)}`);
    this.kind = kind;
    this.detail = detail;
    this.extra = extra;
  }
};
var W = class {
  buf = new Uint8Array(64);
  len = 0;
  room(n) {
    if (this.len + n <= this.buf.length)
      return;
    const nb = new Uint8Array(Math.max(this.buf.length * 2, this.len + n));
    nb.set(this.buf.subarray(0, this.len));
    this.buf = nb;
  }
  byte(b) {
    this.room(1);
    this.buf[this.len++] = b;
  }
  bytes(b) {
    this.room(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }
  varint(v) {
    if (typeof v === "number") {
      while (v >= 128) {
        this.byte(v % 128 | 128);
        v = Math.floor(v / 128);
      }
      this.byte(v);
    } else {
      while (v >= 0x80n) {
        this.byte(Number(v & 0x7fn) | 128);
        v >>= 7n;
      }
      this.byte(Number(v));
    }
  }
  out() {
    return this.buf.slice(0, this.len);
  }
};
var R = class {
  i = 0;
  b;
  constructor(b) {
    this.b = b;
  }
  take(n) {
    if (n < 0 || this.i + n > this.b.length)
      throw new DecodeError("unexpected end of data");
    const v = this.b.subarray(this.i, this.i + n);
    this.i += n;
    return v;
  }
  byte() {
    return this.take(1)[0];
  }
  varint() {
    let x = 0, mul = 1;
    for (let n = 0; n < 8; n++) {
      const c = this.byte();
      x += (c & 127) * mul;
      if (!(c & 128))
        return x;
      mul *= 128;
    }
    throw new DecodeError("varint too long for a number");
  }
  varbig() {
    let x = 0n, sh = 0n;
    for (let n = 0; n < 20; n++) {
      const c = this.byte();
      x |= BigInt(c & 127) << sh;
      if (!(c & 128))
        return x;
      sh += 7n;
    }
    throw new DecodeError("varint too long");
  }
  dv(n) {
    const s = this.take(n);
    return new DataView(s.buffer, s.byteOffset, n);
  }
};
var te = new TextEncoder();
var td = new TextDecoder("utf-8", { fatal: true });
function uint(bits) {
  const mx = 2 ** bits - 1;
  return {
    enc(w, v) {
      if (!Number.isInteger(v) || v < 0 || v > mx)
        throw new RangeError(`u${bits} out of range: ${v}`);
      w.varint(v);
    },
    dec(r) {
      const v = r.varint();
      if (v > mx)
        throw new DecodeError(`u${bits} overflow`);
      return v;
    }
  };
}
function sint(bits) {
  const lo = -(2 ** (bits - 1)), hi = 2 ** (bits - 1) - 1;
  return {
    enc(w, v) {
      if (!Number.isInteger(v) || v < lo || v > hi)
        throw new RangeError(`i${bits} out of range: ${v}`);
      w.varint(v >= 0 ? v * 2 : -v * 2 - 1);
    },
    dec(r) {
      const z = r.varint();
      const v = z % 2 === 0 ? z / 2 : -(z + 1) / 2;
      if (v < lo || v > hi)
        throw new DecodeError(`i${bits} overflow`);
      return v;
    }
  };
}
function ubig(bits) {
  const mx = (1n << BigInt(bits)) - 1n;
  return {
    enc(w, v) {
      if (typeof v !== "bigint" || v < 0n || v > mx)
        throw new RangeError(`u${bits} out of range: ${v}`);
      w.varint(v);
    },
    dec(r) {
      const v = r.varbig();
      if (v > mx)
        throw new DecodeError(`u${bits} overflow`);
      return v;
    }
  };
}
function sbig(bits) {
  const b = BigInt(bits);
  const lo = -(1n << b - 1n), hi = (1n << b - 1n) - 1n;
  return {
    enc(w, v) {
      if (typeof v !== "bigint" || v < lo || v > hi)
        throw new RangeError(`i${bits} out of range: ${v}`);
      w.varint(v << 1n ^ v >> b - 1n);
    },
    dec(r) {
      const z = r.varbig();
      const v = z >> 1n ^ -(z & 1n);
      if (v < lo || v > hi)
        throw new DecodeError(`i${bits} overflow`);
      return v;
    }
  };
}
var u16 = uint(16);
var u32 = uint(32);
var i16 = sint(16);
var i32 = sint(32);
var u64 = ubig(64);
var u128 = ubig(128);
var i64 = sbig(64);
var i128 = sbig(128);
var f32 = {
  enc(w, v) {
    const d = new DataView(new ArrayBuffer(4));
    d.setFloat32(0, v, true);
    w.bytes(new Uint8Array(d.buffer));
  },
  dec: (r) => r.dv(4).getFloat32(0, true)
};
var f64 = {
  enc(w, v) {
    const d = new DataView(new ArrayBuffer(8));
    d.setFloat64(0, v, true);
    w.bytes(new Uint8Array(d.buffer));
  },
  dec: (r) => r.dv(8).getFloat64(0, true)
};
var bool = {
  enc: (w, v) => w.byte(v ? 1 : 0),
  dec(r) {
    const c = r.byte();
    if (c > 1)
      throw new DecodeError("bad bool");
    return c === 1;
  }
};
var str = {
  enc(w, v) {
    const d = te.encode(v);
    w.varint(d.length);
    w.bytes(d);
  },
  dec(r) {
    try {
      return td.decode(r.take(r.varint()));
    } catch (e) {
      if (e instanceof WireError)
        throw e;
      throw new DecodeError(String(e));
    }
  }
};
var unit = { enc() {
}, dec: () => null };
var bytes = {
  enc(w, v) {
    w.varint(v.length);
    w.bytes(v);
  },
  dec: (r) => r.take(r.varint()).slice()
};
function vec(c) {
  return {
    enc(w, v) {
      w.varint(v.length);
      for (const x of v)
        c.enc(w, x);
    },
    dec(r) {
      const n = r.varint();
      if (n > MAX_PAYLOAD)
        throw new DecodeError("vec too long");
      const o = [];
      for (let i = 0; i < n; i++)
        o.push(c.dec(r));
      return o;
    }
  };
}
function res(ok, err) {
  return {
    enc(w, v) {
      if ("ok" in v) {
        w.byte(0);
        ok.enc(w, v.ok);
      } else {
        w.byte(1);
        err.enc(w, v.err);
      }
    },
    dec(r) {
      const t = r.byte();
      if (t === 0)
        return { ok: ok.dec(r) };
      if (t === 1)
        return { err: err.dec(r) };
      throw new DecodeError("bad result tag");
    }
  };
}
var TABLE = {};
function ref(name) {
  return { enc: (w, v) => TABLE[name].enc(w, v), dec: (r) => TABLE[name].dec(r) };
}
function struct(fields) {
  return {
    enc(w, v) {
      for (const [k, c] of fields)
        c.enc(w, v[k]);
    },
    dec(r) {
      const o = {};
      for (const [k, c] of fields)
        o[k] = c.dec(r);
      return o;
    }
  };
}
function enumOf(variants) {
  return {
    enc(w, v) {
      const i = variants.findIndex(([n]) => n === v.tag);
      if (i < 0)
        throw new RangeError(`not a variant of this enum: ${JSON.stringify(v)}`);
      w.varint(i);
      for (const [k, c] of variants[i][1])
        c.enc(w, v[k]);
    },
    dec(r) {
      const i = r.varint();
      if (i >= variants.length)
        throw new DecodeError(`enum variant ${i} out of range`);
      const o = { tag: variants[i][0] };
      for (const [k, c] of variants[i][1])
        o[k] = c.dec(r);
      return o;
    }
  };
}
function encode(c, v) {
  const w = new W();
  c.enc(w, v);
  return w.out();
}
function decode(c, body) {
  const r = new R(body);
  const v = c.dec(r);
  if (r.i !== body.length)
    throw new DecodeError("trailing bytes");
  return v;
}
function frame(kind, id, op, payload = new Uint8Array()) {
  const b = new Uint8Array(HEADER + payload.length);
  const d = new DataView(b.buffer);
  d.setUint32(0, payload.length, true);
  b[4] = kind;
  d.setBigUint64(5, BigInt(id), true);
  d.setUint32(13, op, true);
  b.set(payload, HEADER);
  return b;
}
function adaptError(r) {
  const i = r.varint();
  switch (i) {
    case 0:
      return { kind: "Narrow", field: str.dec(r), value: str.dec(r) };
    case 1:
      return { kind: "NoVariant", field: str.dec(r), variant: str.dec(r) };
    case 2:
      return { kind: "Missing", field: str.dec(r) };
    case 3:
      return { kind: "NoPath" };
    case 4:
      return { kind: "Decode", why: str.dec(r) };
    default:
      throw new DecodeError(`unknown AdaptError variant ${i}`);
  }
}
function refusal(body) {
  const r = new R(body);
  const i = r.varint();
  switch (i) {
    case 0:
      return { ok: r.varbig() };
    case 1: {
      const ours = r.varbig(), theirs = r.varbig(), api = str.dec(r);
      return new Refused("Schema", `server has schema 0x${ours.toString(16)}, this client 0x${theirs.toString(16)} (api ${api})`, { ours, theirs, api });
    }
    case 4:
      return new Refused("UnknownOp", r.varint());
    case 8: {
      const ours = r.varbig(), theirs = r.varbig(), api = str.dec(r), update = str.dec(r);
      return new Refused("SchemaAt", `server has schema 0x${ours.toString(16)}, this client 0x${theirs.toString(16)} (api ${api}): ${update}`, { ours, theirs, api, update });
    }
    case 9: {
      const api = str.dec(r), op = r.varint(), op_name = str.dec(r), ours = r.varint(), theirs = r.varint();
      const why = adaptError(r);
      return new Refused("Adapt", `${api} op ${op_name} (#${op}) v${theirs} <-> v${ours}: ${JSON.stringify(why)}`, { api, op, op_name, ours, theirs, why });
    }
    case 10: {
      const api = str.dec(r), op = r.varint(), op_name = str.dec(r), ours = r.varbig(), theirs = r.varbig();
      return new Refused("SchemaMismatch", `${api} op ${op_name} (#${op}): server shape 0x${ours.toString(16)}, this client 0x${theirs.toString(16)}`, { api, op, op_name, ours, theirs });
    }
    default: {
      const names = { 2: "Gate", 3: "Right", 5: "NoCell", 6: "Decode", 7: "Remote" };
      if (!(i in names))
        throw new DecodeError(`unknown Refusal variant ${i}`);
      return new Refused(names[i], str.dec(r));
    }
  }
}
function refused(body) {
  try {
    const r = refusal(body);
    return r instanceof Refused ? r : new Refused("Ok");
  } catch {
    return new Refused("Remote", "bad error body");
  }
}
var HELLO_DOMAIN = "ce-wire-hello-v1";
var PKCS8_ED25519 = Uint8Array.from([48, 46, 2, 1, 0, 48, 5, 6, 3, 43, 101, 112, 4, 34, 4, 32]);
function b64u(s) {
  const t = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(t, (c) => c.charCodeAt(0));
}
function grantFromLink(href = location.href) {
  const u = new URL(href);
  const f = new URLSearchParams(u.hash.slice(1));
  const g = f.get("g");
  if (!g)
    return null;
  const [k, c] = g.split(".");
  const url = f.get("w") ?? `${u.protocol === "https:" ? "wss" : "ws"}://${u.host}/wire`;
  return { url, seed: b64u(k), chain: b64u(c) };
}
var WebKey = class _WebKey {
  nodeId;
  key;
  constructor(nodeId, key) {
    this.nodeId = nodeId;
    this.key = key;
  }
  static async fromSeed(seed) {
    const der = new Uint8Array(48);
    der.set(PKCS8_ED25519);
    der.set(seed, 16);
    const key = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, true, ["sign"]);
    const jwk = await crypto.subtle.exportKey("jwk", key);
    return new _WebKey(b64u(jwk.x), key);
  }
  async sign(data) {
    return new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, this.key, data));
  }
};
async function webProof(g, api = API_NAME, schema = SCHEMA) {
  const k = await WebKey.fromSeed(g.seed);
  const unixMs = BigInt(Date.now());
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const s = new W();
  str.enc(s, HELLO_DOMAIN);
  str.enc(s, api);
  u64.enc(s, schema);
  u64.enc(s, unixMs);
  s.bytes(nonce);
  s.bytes(k.nodeId);
  bytes.enc(s, g.chain);
  const sig = await k.sign(s.out());
  const p = new W();
  p.bytes(k.nodeId);
  u64.enc(p, unixMs);
  p.bytes(nonce);
  bytes.enc(p, g.chain);
  bytes.enc(p, sig);
  return p.out();
}
var Subscription = class {
  q = [];
  waiter = null;
  done = false;
  c;
  id;
  op;
  codec;
  constructor(c, id, op, codec) {
    this.c = c;
    this.id = id;
    this.op = op;
    this.codec = codec;
  }
  /** @internal */
  push(m) {
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w(m);
    } else
      this.q.push(m);
  }
  /** Next item, or `undefined` when the server ended the stream normally. */
  async next(timeoutMs) {
    if (this.done)
      return void 0;
    const m = await new Promise((res5, rej) => {
      if (this.q.length)
        return res5(this.q.shift());
      let t;
      this.waiter = (x) => {
        if (t)
          clearTimeout(t);
        res5(x);
      };
      if (timeoutMs !== void 0)
        t = setTimeout(() => {
          this.waiter = null;
          rej(new Timeout("no item"));
        }, timeoutMs);
    });
    if (m === null) {
      this.finish();
      throw new Closed("connection closed");
    }
    const [kind, body] = m;
    if (kind === K_ITEM)
      return decode(this.codec, body);
    this.finish();
    if (kind === K_END)
      return void 0;
    throw refused(body);
  }
  finish() {
    this.done = true;
    this.c.subs.delete(this.id);
  }
  close() {
    if (this.done)
      return;
    this.finish();
    this.c.send(frame(K_END, this.id, this.op));
  }
  async *[Symbol.asyncIterator]() {
    try {
      for (; ; ) {
        const v = await this.next();
        if (v === void 0)
          return;
        yield v;
      }
    } finally {
      this.close();
    }
  }
};
var ConnBase = class _ConnBase {
  session = 0n;
  deadlineMs = CALL_DEADLINE_MS;
  nextId = 1;
  buf = new Uint8Array(0);
  pending = /* @__PURE__ */ new Map();
  /** @internal */
  subs = /* @__PURE__ */ new Map();
  closed = false;
  first = null;
  ws;
  constructor(ws) {
    this.ws = ws;
    ws.binaryType = "arraybuffer";
    ws.onmessage = (e) => this.onData(new Uint8Array(e.data));
    ws.onclose = () => this.onClose();
  }
  onData(d) {
    if (this.buf.length) {
      const b = new Uint8Array(this.buf.length + d.length);
      b.set(this.buf);
      b.set(d, this.buf.length);
      this.buf = b;
    } else
      this.buf = d;
    for (; ; ) {
      if (this.buf.length < HEADER)
        return;
      const v = new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.length);
      const len = v.getUint32(0, true);
      if (len > MAX_PAYLOAD)
        return void this.ws.close();
      if (this.buf.length < HEADER + len)
        return;
      const kind = this.buf[4];
      const id = Number(v.getBigUint64(5, true));
      const body = this.buf.slice(HEADER, HEADER + len);
      this.buf = this.buf.subarray(HEADER + len);
      if (this.first) {
        const f = this.first;
        this.first = null;
        f([kind, id, body]);
        continue;
      }
      const sub = kind === K_ITEM || kind === K_END || kind === K_ERR ? this.subs.get(id) : void 0;
      if (sub) {
        sub.push([kind, body]);
        if (kind !== K_ITEM)
          this.subs.delete(id);
        continue;
      }
      const w = this.pending.get(id);
      if (w) {
        this.pending.delete(id);
        w([kind, body]);
      }
    }
  }
  onClose() {
    this.closed = true;
    if (this.first) {
      const f = this.first;
      this.first = null;
      f(null);
    }
    for (const w of this.pending.values())
      w(null);
    this.pending.clear();
    for (const s of this.subs.values())
      s.push(null);
    this.subs.clear();
  }
  /** @internal */
  send(b) {
    if (this.closed)
      throw new Closed("connection closed");
    this.ws.send(b);
  }
  /** @internal Open `url`, say Hello as `api`, wait for the answer. */
  static async open(url, hello, waitMs) {
    const ws = new WebSocket(url);
    await new Promise((res5, rej) => {
      const t = setTimeout(() => {
        ws.close();
        rej(new Timeout(`connect ${url}`));
      }, waitMs);
      ws.onopen = () => {
        clearTimeout(t);
        res5();
      };
      ws.onerror = () => {
        clearTimeout(t);
        rej(new WireError(`connect ${url}: refused or unreachable`));
      };
    });
    const c = new _ConnBase(ws);
    const ans = new Promise((res5, rej) => {
      c.first = res5;
      setTimeout(() => {
        if (c.first === res5) {
          c.first = null;
          ws.close();
          rej(new Timeout("no Hello answer"));
        }
      }, waitMs);
    });
    ws.send(frame(K_HELLO, 0, 0, hello));
    const m = await ans;
    if (m === null)
      throw new Closed("connection closed");
    const r = refusal(m[2]);
    if (m[0] !== K_HELLO || r instanceof Refused) {
      ws.close();
      throw r instanceof Refused ? r : new Refused("Ok");
    }
    c.session = r.ok;
    return c;
  }
  /** @internal */
  async call(op, qc, pc, req, waitMs = 0) {
    const deadlineMs = Math.max(this.deadlineMs, waitMs);
    const payload = encode(qc, req);
    const id = this.nextId++;
    const got = await new Promise((res5, rej) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        rej(new Timeout(`op ${op} took over ${deadlineMs} ms`));
      }, deadlineMs);
      this.pending.set(id, (m) => {
        clearTimeout(t);
        res5(m);
      });
      try {
        this.send(frame(K_REQ, id, op, payload));
      } catch (e) {
        clearTimeout(t);
        this.pending.delete(id);
        rej(e);
      }
    });
    if (got === null)
      throw new Closed("connection closed");
    if (got[0] === K_RESP)
      return decode(pc, got[1]);
    throw refused(got[1]);
  }
  /** @internal */
  subscribeOp(op, qc, ic, req) {
    const payload = encode(qc, req);
    const id = this.nextId++;
    const sub = new Subscription(this, id, op, ic);
    if (this.closed)
      throw new Closed("connection closed");
    this.subs.set(id, sub);
    this.send(frame(K_SUB, id, op, payload));
    return sub;
  }
  close() {
    this.ws.close();
  }
};
async function connectWeb(g, waitMs, instance = "") {
  const key = instance ? `${API_NAME}#${instance}` : API_NAME;
  const w = new W();
  str.enc(w, key);
  u32.enc(w, API_VERSION);
  u64.enc(w, SCHEMA);
  bytes.enc(w, g.everyone !== void 0 ? new TextEncoder().encode("ceeveryn" + g.everyone) : await webProof(g, key));
  bool.enc(w, false);
  return ConnBase.open(g.url, w.out(), waitMs);
}
TABLE["Health"] = struct([["ok", bool], ["version", str], ["uptime_s", u64]]);
TABLE["Msg"] = struct([["role", str], ["content", str]]);
TABLE["GenReq"] = struct([["model", str], ["messages", vec(ref("Msg"))], ["max_tokens", u32], ["temp", f32], ["prefix", str], ["start_idx", u32], ["req_id", str]]);
TABLE["Token"] = struct([["req_id", str], ["idx", u32], ["text", str], ["device_class", str], ["node", str], ["t_ms", u64], ["sig", str]]);
TABLE["Done"] = struct([["reason", str], ["spent", u32], ["budget_left", i64], ["tok_s", f32]]);
TABLE["GenItem"] = enumOf([["Token", [["f0", ref("Token")]]], ["Done", [["f0", ref("Done")]]], ["Moved", [["f0", str]]], ["Refused", [["f0", ref("GenError")]]]]);
TABLE["GenError"] = enumOf([["Invalid", [["f0", str]]], ["Busy", [["f0", str]]], ["Budget", [["f0", str]]], ["NotHere", [["f0", str]]], ["Failed", [["f0", str]]]]);
TABLE["ModelInfo"] = struct([["name", str], ["ctx", u32], ["quant", str], ["license", str]]);
TABLE["HolderInfo"] = struct([["node", str], ["device_class", str], ["model", str], ["busy", u32], ["slots", u32], ["tok_s", f32], ["withdrawn", bool], ["until", u64], ["mem_free_mb", u64], ["load1", f32], ["cores", u32]]);
TABLE["WithdrawReq"] = struct([["for_s", u32]]);
TABLE["Withdrawn"] = struct([["streams_moved", u32], ["until", u64], ["at_ms", u64]]);
TABLE["SpawnReq"] = struct([["node", str], ["n", u32]]);
TABLE["SpawnResp"] = struct([["ids", vec(str)]]);
TABLE["InstancesReq"] = struct([["node", str]]);
TABLE["InstancesResp"] = struct([["ids", vec(str)]]);
TABLE["StopIdReq"] = struct([["id", str]]);
TABLE["StopIdResp"] = struct([["stopped", bool]]);
TABLE["DeployReq"] = struct([["node", str], ["version", str]]);
TABLE["DeployResp"] = struct([["ok", bool], ["version", str]]);
TABLE["BenchReq"] = struct([["op", str], ["n", u32]]);
TABLE["BenchResp"] = struct([["p50_ms", f64], ["p95_ms", f64], ["errors", u32]]);
TABLE["CellOpsError"] = enumOf([["Invalid", [["f0", str]]], ["Failed", [["f0", str]]]]);
var InferGenerateClient = class _InferGenerateClient {
  conn;
  constructor(conn2) {
    this.conn = conn2;
  }
  /** Through the wire.ws-door in `g` (default: the grant in this page's link); `instance` names one instance of the api (Rust by_instance). */
  static async connect(g = grantFromLink(), waitMs = 1e4, instance = "") {
    if (!g)
      throw new Refused("Gate", "no grant in this link (#g=...)");
    return new _InferGenerateClient(await connectWeb(g, waitMs, instance));
  }
  close() {
    this.conn.close();
  }
  /** op HealthOp (needs infer.generate:health). */
  healthOp() {
    return this.conn.call(1, unit, ref("Health"), null);
  }
  /** op Models (needs infer.generate:read). */
  models() {
    return this.conn.call(2, unit, vec(ref("ModelInfo")), null);
  }
  /** op Holder (needs infer.generate:read). */
  holder() {
    return this.conn.call(3, unit, ref("HolderInfo"), null);
  }
  /** op Withdraw (needs infer.generate:withdraw). */
  withdraw(req) {
    return this.conn.call(4, ref("WithdrawReq"), res(ref("Withdrawn"), ref("GenError")), req);
  }
  /** op CellSpawn (needs infer.generate:spawn). */
  cellSpawn(req) {
    return this.conn.call(900, ref("SpawnReq"), res(ref("SpawnResp"), ref("CellOpsError")), req);
  }
  /** op CellInstances (needs infer.generate:instances). */
  cellInstances(req) {
    return this.conn.call(901, ref("InstancesReq"), res(ref("InstancesResp"), ref("CellOpsError")), req);
  }
  /** op CellStop (needs infer.generate:stop). */
  cellStop(req) {
    return this.conn.call(902, ref("StopIdReq"), res(ref("StopIdResp"), ref("CellOpsError")), req);
  }
  /** op CellDeploy (needs infer.generate:deploy). */
  cellDeploy(req) {
    return this.conn.call(903, ref("DeployReq"), res(ref("DeployResp"), ref("CellOpsError")), req);
  }
  /** op CellBench (needs infer.generate:bench). */
  cellBench(req) {
    return this.conn.call(904, ref("BenchReq"), res(ref("BenchResp"), ref("CellOpsError")), req);
  }
  /** stream Generate (needs infer.generate:generate). */
  generate(req) {
    return this.conn.subscribeOp(10, ref("GenReq"), ref("GenItem"), req);
  }
};

// gen/PlaceNear.ts
var API_NAME2 = "place.near";
var API_VERSION2 = 1;
var SCHEMA2 = 10720766776545291851n;
var CALL_DEADLINE_MS2 = 8e3;
var HEADER2 = 17;
var MAX_PAYLOAD2 = 16 << 20;
var K_HELLO2 = 0;
var K_REQ2 = 1;
var K_RESP2 = 2;
var K_ERR2 = 3;
var K_SUB2 = 5;
var K_ITEM2 = 6;
var K_END2 = 7;
var WireError2 = class extends Error {
};
var Timeout2 = class extends WireError2 {
};
var Closed2 = class extends WireError2 {
};
var DecodeError2 = class extends WireError2 {
};
var Refused2 = class extends WireError2 {
  kind;
  detail;
  extra;
  constructor(kind, detail, extra = {}) {
    super(detail === void 0 ? kind : `${kind}: ${String(detail)}`);
    this.kind = kind;
    this.detail = detail;
    this.extra = extra;
  }
};
var W2 = class {
  buf = new Uint8Array(64);
  len = 0;
  room(n) {
    if (this.len + n <= this.buf.length)
      return;
    const nb = new Uint8Array(Math.max(this.buf.length * 2, this.len + n));
    nb.set(this.buf.subarray(0, this.len));
    this.buf = nb;
  }
  byte(b) {
    this.room(1);
    this.buf[this.len++] = b;
  }
  bytes(b) {
    this.room(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }
  varint(v) {
    if (typeof v === "number") {
      while (v >= 128) {
        this.byte(v % 128 | 128);
        v = Math.floor(v / 128);
      }
      this.byte(v);
    } else {
      while (v >= 0x80n) {
        this.byte(Number(v & 0x7fn) | 128);
        v >>= 7n;
      }
      this.byte(Number(v));
    }
  }
  out() {
    return this.buf.slice(0, this.len);
  }
};
var R2 = class {
  i = 0;
  b;
  constructor(b) {
    this.b = b;
  }
  take(n) {
    if (n < 0 || this.i + n > this.b.length)
      throw new DecodeError2("unexpected end of data");
    const v = this.b.subarray(this.i, this.i + n);
    this.i += n;
    return v;
  }
  byte() {
    return this.take(1)[0];
  }
  varint() {
    let x = 0, mul = 1;
    for (let n = 0; n < 8; n++) {
      const c = this.byte();
      x += (c & 127) * mul;
      if (!(c & 128))
        return x;
      mul *= 128;
    }
    throw new DecodeError2("varint too long for a number");
  }
  varbig() {
    let x = 0n, sh = 0n;
    for (let n = 0; n < 20; n++) {
      const c = this.byte();
      x |= BigInt(c & 127) << sh;
      if (!(c & 128))
        return x;
      sh += 7n;
    }
    throw new DecodeError2("varint too long");
  }
  dv(n) {
    const s = this.take(n);
    return new DataView(s.buffer, s.byteOffset, n);
  }
};
var te2 = new TextEncoder();
var td2 = new TextDecoder("utf-8", { fatal: true });
function uint2(bits) {
  const mx = 2 ** bits - 1;
  return {
    enc(w, v) {
      if (!Number.isInteger(v) || v < 0 || v > mx)
        throw new RangeError(`u${bits} out of range: ${v}`);
      w.varint(v);
    },
    dec(r) {
      const v = r.varint();
      if (v > mx)
        throw new DecodeError2(`u${bits} overflow`);
      return v;
    }
  };
}
function sint2(bits) {
  const lo = -(2 ** (bits - 1)), hi = 2 ** (bits - 1) - 1;
  return {
    enc(w, v) {
      if (!Number.isInteger(v) || v < lo || v > hi)
        throw new RangeError(`i${bits} out of range: ${v}`);
      w.varint(v >= 0 ? v * 2 : -v * 2 - 1);
    },
    dec(r) {
      const z = r.varint();
      const v = z % 2 === 0 ? z / 2 : -(z + 1) / 2;
      if (v < lo || v > hi)
        throw new DecodeError2(`i${bits} overflow`);
      return v;
    }
  };
}
function ubig2(bits) {
  const mx = (1n << BigInt(bits)) - 1n;
  return {
    enc(w, v) {
      if (typeof v !== "bigint" || v < 0n || v > mx)
        throw new RangeError(`u${bits} out of range: ${v}`);
      w.varint(v);
    },
    dec(r) {
      const v = r.varbig();
      if (v > mx)
        throw new DecodeError2(`u${bits} overflow`);
      return v;
    }
  };
}
function sbig2(bits) {
  const b = BigInt(bits);
  const lo = -(1n << b - 1n), hi = (1n << b - 1n) - 1n;
  return {
    enc(w, v) {
      if (typeof v !== "bigint" || v < lo || v > hi)
        throw new RangeError(`i${bits} out of range: ${v}`);
      w.varint(v << 1n ^ v >> b - 1n);
    },
    dec(r) {
      const z = r.varbig();
      const v = z >> 1n ^ -(z & 1n);
      if (v < lo || v > hi)
        throw new DecodeError2(`i${bits} overflow`);
      return v;
    }
  };
}
var u162 = uint2(16);
var u322 = uint2(32);
var i162 = sint2(16);
var i322 = sint2(32);
var u642 = ubig2(64);
var u1282 = ubig2(128);
var i642 = sbig2(64);
var i1282 = sbig2(128);
var f322 = {
  enc(w, v) {
    const d = new DataView(new ArrayBuffer(4));
    d.setFloat32(0, v, true);
    w.bytes(new Uint8Array(d.buffer));
  },
  dec: (r) => r.dv(4).getFloat32(0, true)
};
var f642 = {
  enc(w, v) {
    const d = new DataView(new ArrayBuffer(8));
    d.setFloat64(0, v, true);
    w.bytes(new Uint8Array(d.buffer));
  },
  dec: (r) => r.dv(8).getFloat64(0, true)
};
var bool2 = {
  enc: (w, v) => w.byte(v ? 1 : 0),
  dec(r) {
    const c = r.byte();
    if (c > 1)
      throw new DecodeError2("bad bool");
    return c === 1;
  }
};
var str2 = {
  enc(w, v) {
    const d = te2.encode(v);
    w.varint(d.length);
    w.bytes(d);
  },
  dec(r) {
    try {
      return td2.decode(r.take(r.varint()));
    } catch (e) {
      if (e instanceof WireError2)
        throw e;
      throw new DecodeError2(String(e));
    }
  }
};
var unit2 = { enc() {
}, dec: () => null };
var bytes2 = {
  enc(w, v) {
    w.varint(v.length);
    w.bytes(v);
  },
  dec: (r) => r.take(r.varint()).slice()
};
function vec2(c) {
  return {
    enc(w, v) {
      w.varint(v.length);
      for (const x of v)
        c.enc(w, x);
    },
    dec(r) {
      const n = r.varint();
      if (n > MAX_PAYLOAD2)
        throw new DecodeError2("vec too long");
      const o = [];
      for (let i = 0; i < n; i++)
        o.push(c.dec(r));
      return o;
    }
  };
}
function res2(ok, err) {
  return {
    enc(w, v) {
      if ("ok" in v) {
        w.byte(0);
        ok.enc(w, v.ok);
      } else {
        w.byte(1);
        err.enc(w, v.err);
      }
    },
    dec(r) {
      const t = r.byte();
      if (t === 0)
        return { ok: ok.dec(r) };
      if (t === 1)
        return { err: err.dec(r) };
      throw new DecodeError2("bad result tag");
    }
  };
}
var TABLE2 = {};
function ref2(name) {
  return { enc: (w, v) => TABLE2[name].enc(w, v), dec: (r) => TABLE2[name].dec(r) };
}
function struct2(fields) {
  return {
    enc(w, v) {
      for (const [k, c] of fields)
        c.enc(w, v[k]);
    },
    dec(r) {
      const o = {};
      for (const [k, c] of fields)
        o[k] = c.dec(r);
      return o;
    }
  };
}
function enumOf2(variants) {
  return {
    enc(w, v) {
      const i = variants.findIndex(([n]) => n === v.tag);
      if (i < 0)
        throw new RangeError(`not a variant of this enum: ${JSON.stringify(v)}`);
      w.varint(i);
      for (const [k, c] of variants[i][1])
        c.enc(w, v[k]);
    },
    dec(r) {
      const i = r.varint();
      if (i >= variants.length)
        throw new DecodeError2(`enum variant ${i} out of range`);
      const o = { tag: variants[i][0] };
      for (const [k, c] of variants[i][1])
        o[k] = c.dec(r);
      return o;
    }
  };
}
function encode2(c, v) {
  const w = new W2();
  c.enc(w, v);
  return w.out();
}
function decode2(c, body) {
  const r = new R2(body);
  const v = c.dec(r);
  if (r.i !== body.length)
    throw new DecodeError2("trailing bytes");
  return v;
}
function frame2(kind, id, op, payload = new Uint8Array()) {
  const b = new Uint8Array(HEADER2 + payload.length);
  const d = new DataView(b.buffer);
  d.setUint32(0, payload.length, true);
  b[4] = kind;
  d.setBigUint64(5, BigInt(id), true);
  d.setUint32(13, op, true);
  b.set(payload, HEADER2);
  return b;
}
function adaptError2(r) {
  const i = r.varint();
  switch (i) {
    case 0:
      return { kind: "Narrow", field: str2.dec(r), value: str2.dec(r) };
    case 1:
      return { kind: "NoVariant", field: str2.dec(r), variant: str2.dec(r) };
    case 2:
      return { kind: "Missing", field: str2.dec(r) };
    case 3:
      return { kind: "NoPath" };
    case 4:
      return { kind: "Decode", why: str2.dec(r) };
    default:
      throw new DecodeError2(`unknown AdaptError variant ${i}`);
  }
}
function refusal2(body) {
  const r = new R2(body);
  const i = r.varint();
  switch (i) {
    case 0:
      return { ok: r.varbig() };
    case 1: {
      const ours = r.varbig(), theirs = r.varbig(), api = str2.dec(r);
      return new Refused2("Schema", `server has schema 0x${ours.toString(16)}, this client 0x${theirs.toString(16)} (api ${api})`, { ours, theirs, api });
    }
    case 4:
      return new Refused2("UnknownOp", r.varint());
    case 8: {
      const ours = r.varbig(), theirs = r.varbig(), api = str2.dec(r), update = str2.dec(r);
      return new Refused2("SchemaAt", `server has schema 0x${ours.toString(16)}, this client 0x${theirs.toString(16)} (api ${api}): ${update}`, { ours, theirs, api, update });
    }
    case 9: {
      const api = str2.dec(r), op = r.varint(), op_name = str2.dec(r), ours = r.varint(), theirs = r.varint();
      const why = adaptError2(r);
      return new Refused2("Adapt", `${api} op ${op_name} (#${op}) v${theirs} <-> v${ours}: ${JSON.stringify(why)}`, { api, op, op_name, ours, theirs, why });
    }
    case 10: {
      const api = str2.dec(r), op = r.varint(), op_name = str2.dec(r), ours = r.varbig(), theirs = r.varbig();
      return new Refused2("SchemaMismatch", `${api} op ${op_name} (#${op}): server shape 0x${ours.toString(16)}, this client 0x${theirs.toString(16)}`, { api, op, op_name, ours, theirs });
    }
    default: {
      const names = { 2: "Gate", 3: "Right", 5: "NoCell", 6: "Decode", 7: "Remote" };
      if (!(i in names))
        throw new DecodeError2(`unknown Refusal variant ${i}`);
      return new Refused2(names[i], str2.dec(r));
    }
  }
}
function refused2(body) {
  try {
    const r = refusal2(body);
    return r instanceof Refused2 ? r : new Refused2("Ok");
  } catch {
    return new Refused2("Remote", "bad error body");
  }
}
var HELLO_DOMAIN2 = "ce-wire-hello-v1";
var PKCS8_ED255192 = Uint8Array.from([48, 46, 2, 1, 0, 48, 5, 6, 3, 43, 101, 112, 4, 34, 4, 32]);
function b64u2(s) {
  const t = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(t, (c) => c.charCodeAt(0));
}
function grantFromLink2(href = location.href) {
  const u = new URL(href);
  const f = new URLSearchParams(u.hash.slice(1));
  const g = f.get("g");
  if (!g)
    return null;
  const [k, c] = g.split(".");
  const url = f.get("w") ?? `${u.protocol === "https:" ? "wss" : "ws"}://${u.host}/wire`;
  return { url, seed: b64u2(k), chain: b64u2(c) };
}
var WebKey2 = class _WebKey {
  nodeId;
  key;
  constructor(nodeId, key) {
    this.nodeId = nodeId;
    this.key = key;
  }
  static async fromSeed(seed) {
    const der = new Uint8Array(48);
    der.set(PKCS8_ED255192);
    der.set(seed, 16);
    const key = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, true, ["sign"]);
    const jwk = await crypto.subtle.exportKey("jwk", key);
    return new _WebKey(b64u2(jwk.x), key);
  }
  async sign(data) {
    return new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, this.key, data));
  }
};
async function webProof2(g, api = API_NAME2, schema = SCHEMA2) {
  const k = await WebKey2.fromSeed(g.seed);
  const unixMs = BigInt(Date.now());
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const s = new W2();
  str2.enc(s, HELLO_DOMAIN2);
  str2.enc(s, api);
  u642.enc(s, schema);
  u642.enc(s, unixMs);
  s.bytes(nonce);
  s.bytes(k.nodeId);
  bytes2.enc(s, g.chain);
  const sig = await k.sign(s.out());
  const p = new W2();
  p.bytes(k.nodeId);
  u642.enc(p, unixMs);
  p.bytes(nonce);
  bytes2.enc(p, g.chain);
  bytes2.enc(p, sig);
  return p.out();
}
var Subscription2 = class {
  q = [];
  waiter = null;
  done = false;
  c;
  id;
  op;
  codec;
  constructor(c, id, op, codec) {
    this.c = c;
    this.id = id;
    this.op = op;
    this.codec = codec;
  }
  /** @internal */
  push(m) {
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w(m);
    } else
      this.q.push(m);
  }
  /** Next item, or `undefined` when the server ended the stream normally. */
  async next(timeoutMs) {
    if (this.done)
      return void 0;
    const m = await new Promise((res5, rej) => {
      if (this.q.length)
        return res5(this.q.shift());
      let t;
      this.waiter = (x) => {
        if (t)
          clearTimeout(t);
        res5(x);
      };
      if (timeoutMs !== void 0)
        t = setTimeout(() => {
          this.waiter = null;
          rej(new Timeout2("no item"));
        }, timeoutMs);
    });
    if (m === null) {
      this.finish();
      throw new Closed2("connection closed");
    }
    const [kind, body] = m;
    if (kind === K_ITEM2)
      return decode2(this.codec, body);
    this.finish();
    if (kind === K_END2)
      return void 0;
    throw refused2(body);
  }
  finish() {
    this.done = true;
    this.c.subs.delete(this.id);
  }
  close() {
    if (this.done)
      return;
    this.finish();
    this.c.send(frame2(K_END2, this.id, this.op));
  }
  async *[Symbol.asyncIterator]() {
    try {
      for (; ; ) {
        const v = await this.next();
        if (v === void 0)
          return;
        yield v;
      }
    } finally {
      this.close();
    }
  }
};
var ConnBase2 = class _ConnBase {
  session = 0n;
  deadlineMs = CALL_DEADLINE_MS2;
  nextId = 1;
  buf = new Uint8Array(0);
  pending = /* @__PURE__ */ new Map();
  /** @internal */
  subs = /* @__PURE__ */ new Map();
  closed = false;
  first = null;
  ws;
  constructor(ws) {
    this.ws = ws;
    ws.binaryType = "arraybuffer";
    ws.onmessage = (e) => this.onData(new Uint8Array(e.data));
    ws.onclose = () => this.onClose();
  }
  onData(d) {
    if (this.buf.length) {
      const b = new Uint8Array(this.buf.length + d.length);
      b.set(this.buf);
      b.set(d, this.buf.length);
      this.buf = b;
    } else
      this.buf = d;
    for (; ; ) {
      if (this.buf.length < HEADER2)
        return;
      const v = new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.length);
      const len = v.getUint32(0, true);
      if (len > MAX_PAYLOAD2)
        return void this.ws.close();
      if (this.buf.length < HEADER2 + len)
        return;
      const kind = this.buf[4];
      const id = Number(v.getBigUint64(5, true));
      const body = this.buf.slice(HEADER2, HEADER2 + len);
      this.buf = this.buf.subarray(HEADER2 + len);
      if (this.first) {
        const f = this.first;
        this.first = null;
        f([kind, id, body]);
        continue;
      }
      const sub = kind === K_ITEM2 || kind === K_END2 || kind === K_ERR2 ? this.subs.get(id) : void 0;
      if (sub) {
        sub.push([kind, body]);
        if (kind !== K_ITEM2)
          this.subs.delete(id);
        continue;
      }
      const w = this.pending.get(id);
      if (w) {
        this.pending.delete(id);
        w([kind, body]);
      }
    }
  }
  onClose() {
    this.closed = true;
    if (this.first) {
      const f = this.first;
      this.first = null;
      f(null);
    }
    for (const w of this.pending.values())
      w(null);
    this.pending.clear();
    for (const s of this.subs.values())
      s.push(null);
    this.subs.clear();
  }
  /** @internal */
  send(b) {
    if (this.closed)
      throw new Closed2("connection closed");
    this.ws.send(b);
  }
  /** @internal Open `url`, say Hello as `api`, wait for the answer. */
  static async open(url, hello, waitMs) {
    const ws = new WebSocket(url);
    await new Promise((res5, rej) => {
      const t = setTimeout(() => {
        ws.close();
        rej(new Timeout2(`connect ${url}`));
      }, waitMs);
      ws.onopen = () => {
        clearTimeout(t);
        res5();
      };
      ws.onerror = () => {
        clearTimeout(t);
        rej(new WireError2(`connect ${url}: refused or unreachable`));
      };
    });
    const c = new _ConnBase(ws);
    const ans = new Promise((res5, rej) => {
      c.first = res5;
      setTimeout(() => {
        if (c.first === res5) {
          c.first = null;
          ws.close();
          rej(new Timeout2("no Hello answer"));
        }
      }, waitMs);
    });
    ws.send(frame2(K_HELLO2, 0, 0, hello));
    const m = await ans;
    if (m === null)
      throw new Closed2("connection closed");
    const r = refusal2(m[2]);
    if (m[0] !== K_HELLO2 || r instanceof Refused2) {
      ws.close();
      throw r instanceof Refused2 ? r : new Refused2("Ok");
    }
    c.session = r.ok;
    return c;
  }
  /** @internal */
  async call(op, qc, pc, req, waitMs = 0) {
    const deadlineMs = Math.max(this.deadlineMs, waitMs);
    const payload = encode2(qc, req);
    const id = this.nextId++;
    const got = await new Promise((res5, rej) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        rej(new Timeout2(`op ${op} took over ${deadlineMs} ms`));
      }, deadlineMs);
      this.pending.set(id, (m) => {
        clearTimeout(t);
        res5(m);
      });
      try {
        this.send(frame2(K_REQ2, id, op, payload));
      } catch (e) {
        clearTimeout(t);
        this.pending.delete(id);
        rej(e);
      }
    });
    if (got === null)
      throw new Closed2("connection closed");
    if (got[0] === K_RESP2)
      return decode2(pc, got[1]);
    throw refused2(got[1]);
  }
  /** @internal */
  subscribeOp(op, qc, ic, req) {
    const payload = encode2(qc, req);
    const id = this.nextId++;
    const sub = new Subscription2(this, id, op, ic);
    if (this.closed)
      throw new Closed2("connection closed");
    this.subs.set(id, sub);
    this.send(frame2(K_SUB2, id, op, payload));
    return sub;
  }
  close() {
    this.ws.close();
  }
};
async function connectWeb2(g, waitMs, instance = "") {
  const key = instance ? `${API_NAME2}#${instance}` : API_NAME2;
  const w = new W2();
  str2.enc(w, key);
  u322.enc(w, API_VERSION2);
  u642.enc(w, SCHEMA2);
  bytes2.enc(w, g.everyone !== void 0 ? new TextEncoder().encode("ceeveryn" + g.everyone) : await webProof2(g, key));
  bool2.enc(w, false);
  return ConnBase2.open(g.url, w.out(), waitMs);
}
TABLE2["Health"] = struct2([["ok", bool2], ["version", str2], ["uptime_s", u642]]);
TABLE2["Ref"] = struct2([["label", str2], ["kind", str2], ["to", str2]]);
TABLE2["Sample"] = struct2([["node", str2], ["rtt_ms", f642]]);
TABLE2["RankReq"] = struct2([["api", str2], ["major", u162], ["samples", vec2(ref2("Sample"))], ["pool", vec2(str2)]]);
TABLE2["Ranked"] = struct2([["node", str2], ["rtt_ms", f642], ["score", f642], ["holder", bool2], ["why", str2], ["refs", vec2(ref2("Ref"))]]);
TABLE2["WatchReq"] = struct2([["api", str2], ["major", u162], ["hysteresis_ms", u322], ["sustain", u322], ["every_ms", u322]]);
TABLE2["Advice"] = struct2([["api", str2], ["holder", str2], ["best", str2], ["holder_rtt_ms", f642], ["best_rtt_ms", f642], ["gain_ms", f642], ["streak", u322], ["suggest", bool2], ["why", str2], ["refs", vec2(ref2("Ref"))]]);
TABLE2["PlaceError"] = enumOf2([["Invalid", [["f0", str2]]], ["NoSamples", []], ["Failed", [["f0", str2]]]]);
TABLE2["Room"] = struct2([["node", str2], ["free_mem_mb", u642], ["load1", f322], ["cores", u322], ["busy", u322], ["slots", u322]]);
TABLE2["RankRoomReq"] = struct2([["api", str2], ["major", u162], ["samples", vec2(ref2("Sample"))], ["pool", vec2(str2)], ["room", vec2(ref2("Room"))]]);
TABLE2["SpawnReq"] = struct2([["node", str2], ["n", u322]]);
TABLE2["SpawnResp"] = struct2([["ids", vec2(str2)]]);
TABLE2["InstancesReq"] = struct2([["node", str2]]);
TABLE2["InstancesResp"] = struct2([["ids", vec2(str2)]]);
TABLE2["StopIdReq"] = struct2([["id", str2]]);
TABLE2["StopIdResp"] = struct2([["stopped", bool2]]);
TABLE2["DeployReq"] = struct2([["node", str2], ["version", str2]]);
TABLE2["DeployResp"] = struct2([["ok", bool2], ["version", str2]]);
TABLE2["BenchReq"] = struct2([["op", str2], ["n", u322]]);
TABLE2["BenchResp"] = struct2([["p50_ms", f642], ["p95_ms", f642], ["errors", u322]]);
TABLE2["CellOpsError"] = enumOf2([["Invalid", [["f0", str2]]], ["Failed", [["f0", str2]]]]);
var PlaceNearClient = class _PlaceNearClient {
  conn;
  constructor(conn2) {
    this.conn = conn2;
  }
  /** Through the wire.ws-door in `g` (default: the grant in this page's link); `instance` names one instance of the api (Rust by_instance). */
  static async connect(g = grantFromLink2(), waitMs = 1e4, instance = "") {
    if (!g)
      throw new Refused2("Gate", "no grant in this link (#g=...)");
    return new _PlaceNearClient(await connectWeb2(g, waitMs, instance));
  }
  close() {
    this.conn.close();
  }
  /** op HealthOp (needs place.near:health). */
  healthOp() {
    return this.conn.call(1, unit2, ref2("Health"), null);
  }
  /** op Rank (needs place.near:rank). */
  rank(req) {
    return this.conn.call(2, ref2("RankReq"), res2(vec2(ref2("Ranked")), ref2("PlaceError")), req, 8e3);
  }
  /** op RankRoom (needs place.near:rank). */
  rankRoom(req) {
    return this.conn.call(4, ref2("RankRoomReq"), res2(vec2(ref2("Ranked")), ref2("PlaceError")), req, 8e3);
  }
  /** op CellSpawn (needs place.near:spawn). */
  cellSpawn(req) {
    return this.conn.call(900, ref2("SpawnReq"), res2(ref2("SpawnResp"), ref2("CellOpsError")), req);
  }
  /** op CellInstances (needs place.near:instances). */
  cellInstances(req) {
    return this.conn.call(901, ref2("InstancesReq"), res2(ref2("InstancesResp"), ref2("CellOpsError")), req);
  }
  /** op CellStop (needs place.near:stop). */
  cellStop(req) {
    return this.conn.call(902, ref2("StopIdReq"), res2(ref2("StopIdResp"), ref2("CellOpsError")), req);
  }
  /** op CellDeploy (needs place.near:deploy). */
  cellDeploy(req) {
    return this.conn.call(903, ref2("DeployReq"), res2(ref2("DeployResp"), ref2("CellOpsError")), req);
  }
  /** op CellBench (needs place.near:bench). */
  cellBench(req) {
    return this.conn.call(904, ref2("BenchReq"), res2(ref2("BenchResp"), ref2("CellOpsError")), req);
  }
  /** stream Watch (needs place.near:watch). */
  watch(req) {
    return this.conn.subscribeOp(3, ref2("WatchReq"), ref2("Advice"), req);
  }
};

// gen/NetRtt.ts
var API_NAME3 = "net.rtt";
var API_VERSION3 = 1;
var SCHEMA3 = 13895670401115001803n;
var CALL_DEADLINE_MS3 = 8e3;
var HEADER3 = 17;
var MAX_PAYLOAD3 = 16 << 20;
var K_HELLO3 = 0;
var K_REQ3 = 1;
var K_RESP3 = 2;
var K_ERR3 = 3;
var K_SUB3 = 5;
var K_ITEM3 = 6;
var K_END3 = 7;
var WireError3 = class extends Error {
};
var Timeout3 = class extends WireError3 {
};
var Closed3 = class extends WireError3 {
};
var DecodeError3 = class extends WireError3 {
};
var Refused3 = class extends WireError3 {
  kind;
  detail;
  extra;
  constructor(kind, detail, extra = {}) {
    super(detail === void 0 ? kind : `${kind}: ${String(detail)}`);
    this.kind = kind;
    this.detail = detail;
    this.extra = extra;
  }
};
var W3 = class {
  buf = new Uint8Array(64);
  len = 0;
  room(n) {
    if (this.len + n <= this.buf.length)
      return;
    const nb = new Uint8Array(Math.max(this.buf.length * 2, this.len + n));
    nb.set(this.buf.subarray(0, this.len));
    this.buf = nb;
  }
  byte(b) {
    this.room(1);
    this.buf[this.len++] = b;
  }
  bytes(b) {
    this.room(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }
  varint(v) {
    if (typeof v === "number") {
      while (v >= 128) {
        this.byte(v % 128 | 128);
        v = Math.floor(v / 128);
      }
      this.byte(v);
    } else {
      while (v >= 0x80n) {
        this.byte(Number(v & 0x7fn) | 128);
        v >>= 7n;
      }
      this.byte(Number(v));
    }
  }
  out() {
    return this.buf.slice(0, this.len);
  }
};
var R3 = class {
  i = 0;
  b;
  constructor(b) {
    this.b = b;
  }
  take(n) {
    if (n < 0 || this.i + n > this.b.length)
      throw new DecodeError3("unexpected end of data");
    const v = this.b.subarray(this.i, this.i + n);
    this.i += n;
    return v;
  }
  byte() {
    return this.take(1)[0];
  }
  varint() {
    let x = 0, mul = 1;
    for (let n = 0; n < 8; n++) {
      const c = this.byte();
      x += (c & 127) * mul;
      if (!(c & 128))
        return x;
      mul *= 128;
    }
    throw new DecodeError3("varint too long for a number");
  }
  varbig() {
    let x = 0n, sh = 0n;
    for (let n = 0; n < 20; n++) {
      const c = this.byte();
      x |= BigInt(c & 127) << sh;
      if (!(c & 128))
        return x;
      sh += 7n;
    }
    throw new DecodeError3("varint too long");
  }
  dv(n) {
    const s = this.take(n);
    return new DataView(s.buffer, s.byteOffset, n);
  }
};
var te3 = new TextEncoder();
var td3 = new TextDecoder("utf-8", { fatal: true });
function uint3(bits) {
  const mx = 2 ** bits - 1;
  return {
    enc(w, v) {
      if (!Number.isInteger(v) || v < 0 || v > mx)
        throw new RangeError(`u${bits} out of range: ${v}`);
      w.varint(v);
    },
    dec(r) {
      const v = r.varint();
      if (v > mx)
        throw new DecodeError3(`u${bits} overflow`);
      return v;
    }
  };
}
function sint3(bits) {
  const lo = -(2 ** (bits - 1)), hi = 2 ** (bits - 1) - 1;
  return {
    enc(w, v) {
      if (!Number.isInteger(v) || v < lo || v > hi)
        throw new RangeError(`i${bits} out of range: ${v}`);
      w.varint(v >= 0 ? v * 2 : -v * 2 - 1);
    },
    dec(r) {
      const z = r.varint();
      const v = z % 2 === 0 ? z / 2 : -(z + 1) / 2;
      if (v < lo || v > hi)
        throw new DecodeError3(`i${bits} overflow`);
      return v;
    }
  };
}
function ubig3(bits) {
  const mx = (1n << BigInt(bits)) - 1n;
  return {
    enc(w, v) {
      if (typeof v !== "bigint" || v < 0n || v > mx)
        throw new RangeError(`u${bits} out of range: ${v}`);
      w.varint(v);
    },
    dec(r) {
      const v = r.varbig();
      if (v > mx)
        throw new DecodeError3(`u${bits} overflow`);
      return v;
    }
  };
}
function sbig3(bits) {
  const b = BigInt(bits);
  const lo = -(1n << b - 1n), hi = (1n << b - 1n) - 1n;
  return {
    enc(w, v) {
      if (typeof v !== "bigint" || v < lo || v > hi)
        throw new RangeError(`i${bits} out of range: ${v}`);
      w.varint(v << 1n ^ v >> b - 1n);
    },
    dec(r) {
      const z = r.varbig();
      const v = z >> 1n ^ -(z & 1n);
      if (v < lo || v > hi)
        throw new DecodeError3(`i${bits} overflow`);
      return v;
    }
  };
}
var u163 = uint3(16);
var u323 = uint3(32);
var i163 = sint3(16);
var i323 = sint3(32);
var u643 = ubig3(64);
var u1283 = ubig3(128);
var i643 = sbig3(64);
var i1283 = sbig3(128);
var f643 = {
  enc(w, v) {
    const d = new DataView(new ArrayBuffer(8));
    d.setFloat64(0, v, true);
    w.bytes(new Uint8Array(d.buffer));
  },
  dec: (r) => r.dv(8).getFloat64(0, true)
};
var bool3 = {
  enc: (w, v) => w.byte(v ? 1 : 0),
  dec(r) {
    const c = r.byte();
    if (c > 1)
      throw new DecodeError3("bad bool");
    return c === 1;
  }
};
var str3 = {
  enc(w, v) {
    const d = te3.encode(v);
    w.varint(d.length);
    w.bytes(d);
  },
  dec(r) {
    try {
      return td3.decode(r.take(r.varint()));
    } catch (e) {
      if (e instanceof WireError3)
        throw e;
      throw new DecodeError3(String(e));
    }
  }
};
var unit3 = { enc() {
}, dec: () => null };
var bytes3 = {
  enc(w, v) {
    w.varint(v.length);
    w.bytes(v);
  },
  dec: (r) => r.take(r.varint()).slice()
};
function vec3(c) {
  return {
    enc(w, v) {
      w.varint(v.length);
      for (const x of v)
        c.enc(w, x);
    },
    dec(r) {
      const n = r.varint();
      if (n > MAX_PAYLOAD3)
        throw new DecodeError3("vec too long");
      const o = [];
      for (let i = 0; i < n; i++)
        o.push(c.dec(r));
      return o;
    }
  };
}
function res3(ok, err) {
  return {
    enc(w, v) {
      if ("ok" in v) {
        w.byte(0);
        ok.enc(w, v.ok);
      } else {
        w.byte(1);
        err.enc(w, v.err);
      }
    },
    dec(r) {
      const t = r.byte();
      if (t === 0)
        return { ok: ok.dec(r) };
      if (t === 1)
        return { err: err.dec(r) };
      throw new DecodeError3("bad result tag");
    }
  };
}
var TABLE3 = {};
function ref3(name) {
  return { enc: (w, v) => TABLE3[name].enc(w, v), dec: (r) => TABLE3[name].dec(r) };
}
function struct3(fields) {
  return {
    enc(w, v) {
      for (const [k, c] of fields)
        c.enc(w, v[k]);
    },
    dec(r) {
      const o = {};
      for (const [k, c] of fields)
        o[k] = c.dec(r);
      return o;
    }
  };
}
function enumOf3(variants) {
  return {
    enc(w, v) {
      const i = variants.findIndex(([n]) => n === v.tag);
      if (i < 0)
        throw new RangeError(`not a variant of this enum: ${JSON.stringify(v)}`);
      w.varint(i);
      for (const [k, c] of variants[i][1])
        c.enc(w, v[k]);
    },
    dec(r) {
      const i = r.varint();
      if (i >= variants.length)
        throw new DecodeError3(`enum variant ${i} out of range`);
      const o = { tag: variants[i][0] };
      for (const [k, c] of variants[i][1])
        o[k] = c.dec(r);
      return o;
    }
  };
}
function encode3(c, v) {
  const w = new W3();
  c.enc(w, v);
  return w.out();
}
function decode3(c, body) {
  const r = new R3(body);
  const v = c.dec(r);
  if (r.i !== body.length)
    throw new DecodeError3("trailing bytes");
  return v;
}
function frame3(kind, id, op, payload = new Uint8Array()) {
  const b = new Uint8Array(HEADER3 + payload.length);
  const d = new DataView(b.buffer);
  d.setUint32(0, payload.length, true);
  b[4] = kind;
  d.setBigUint64(5, BigInt(id), true);
  d.setUint32(13, op, true);
  b.set(payload, HEADER3);
  return b;
}
function adaptError3(r) {
  const i = r.varint();
  switch (i) {
    case 0:
      return { kind: "Narrow", field: str3.dec(r), value: str3.dec(r) };
    case 1:
      return { kind: "NoVariant", field: str3.dec(r), variant: str3.dec(r) };
    case 2:
      return { kind: "Missing", field: str3.dec(r) };
    case 3:
      return { kind: "NoPath" };
    case 4:
      return { kind: "Decode", why: str3.dec(r) };
    default:
      throw new DecodeError3(`unknown AdaptError variant ${i}`);
  }
}
function refusal3(body) {
  const r = new R3(body);
  const i = r.varint();
  switch (i) {
    case 0:
      return { ok: r.varbig() };
    case 1: {
      const ours = r.varbig(), theirs = r.varbig(), api = str3.dec(r);
      return new Refused3("Schema", `server has schema 0x${ours.toString(16)}, this client 0x${theirs.toString(16)} (api ${api})`, { ours, theirs, api });
    }
    case 4:
      return new Refused3("UnknownOp", r.varint());
    case 8: {
      const ours = r.varbig(), theirs = r.varbig(), api = str3.dec(r), update = str3.dec(r);
      return new Refused3("SchemaAt", `server has schema 0x${ours.toString(16)}, this client 0x${theirs.toString(16)} (api ${api}): ${update}`, { ours, theirs, api, update });
    }
    case 9: {
      const api = str3.dec(r), op = r.varint(), op_name = str3.dec(r), ours = r.varint(), theirs = r.varint();
      const why = adaptError3(r);
      return new Refused3("Adapt", `${api} op ${op_name} (#${op}) v${theirs} <-> v${ours}: ${JSON.stringify(why)}`, { api, op, op_name, ours, theirs, why });
    }
    case 10: {
      const api = str3.dec(r), op = r.varint(), op_name = str3.dec(r), ours = r.varbig(), theirs = r.varbig();
      return new Refused3("SchemaMismatch", `${api} op ${op_name} (#${op}): server shape 0x${ours.toString(16)}, this client 0x${theirs.toString(16)}`, { api, op, op_name, ours, theirs });
    }
    default: {
      const names = { 2: "Gate", 3: "Right", 5: "NoCell", 6: "Decode", 7: "Remote" };
      if (!(i in names))
        throw new DecodeError3(`unknown Refusal variant ${i}`);
      return new Refused3(names[i], str3.dec(r));
    }
  }
}
function refused3(body) {
  try {
    const r = refusal3(body);
    return r instanceof Refused3 ? r : new Refused3("Ok");
  } catch {
    return new Refused3("Remote", "bad error body");
  }
}
var HELLO_DOMAIN3 = "ce-wire-hello-v1";
var PKCS8_ED255193 = Uint8Array.from([48, 46, 2, 1, 0, 48, 5, 6, 3, 43, 101, 112, 4, 34, 4, 32]);
function b64u3(s) {
  const t = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(t, (c) => c.charCodeAt(0));
}
function grantFromLink3(href = location.href) {
  const u = new URL(href);
  const f = new URLSearchParams(u.hash.slice(1));
  const g = f.get("g");
  if (!g)
    return null;
  const [k, c] = g.split(".");
  const url = f.get("w") ?? `${u.protocol === "https:" ? "wss" : "ws"}://${u.host}/wire`;
  return { url, seed: b64u3(k), chain: b64u3(c) };
}
var WebKey3 = class _WebKey {
  nodeId;
  key;
  constructor(nodeId, key) {
    this.nodeId = nodeId;
    this.key = key;
  }
  static async fromSeed(seed) {
    const der = new Uint8Array(48);
    der.set(PKCS8_ED255193);
    der.set(seed, 16);
    const key = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, true, ["sign"]);
    const jwk = await crypto.subtle.exportKey("jwk", key);
    return new _WebKey(b64u3(jwk.x), key);
  }
  async sign(data) {
    return new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, this.key, data));
  }
};
async function webProof3(g, api = API_NAME3, schema = SCHEMA3) {
  const k = await WebKey3.fromSeed(g.seed);
  const unixMs = BigInt(Date.now());
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const s = new W3();
  str3.enc(s, HELLO_DOMAIN3);
  str3.enc(s, api);
  u643.enc(s, schema);
  u643.enc(s, unixMs);
  s.bytes(nonce);
  s.bytes(k.nodeId);
  bytes3.enc(s, g.chain);
  const sig = await k.sign(s.out());
  const p = new W3();
  p.bytes(k.nodeId);
  u643.enc(p, unixMs);
  p.bytes(nonce);
  bytes3.enc(p, g.chain);
  bytes3.enc(p, sig);
  return p.out();
}
var Subscription3 = class {
  q = [];
  waiter = null;
  done = false;
  c;
  id;
  op;
  codec;
  constructor(c, id, op, codec) {
    this.c = c;
    this.id = id;
    this.op = op;
    this.codec = codec;
  }
  /** @internal */
  push(m) {
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w(m);
    } else
      this.q.push(m);
  }
  /** Next item, or `undefined` when the server ended the stream normally. */
  async next(timeoutMs) {
    if (this.done)
      return void 0;
    const m = await new Promise((res5, rej) => {
      if (this.q.length)
        return res5(this.q.shift());
      let t;
      this.waiter = (x) => {
        if (t)
          clearTimeout(t);
        res5(x);
      };
      if (timeoutMs !== void 0)
        t = setTimeout(() => {
          this.waiter = null;
          rej(new Timeout3("no item"));
        }, timeoutMs);
    });
    if (m === null) {
      this.finish();
      throw new Closed3("connection closed");
    }
    const [kind, body] = m;
    if (kind === K_ITEM3)
      return decode3(this.codec, body);
    this.finish();
    if (kind === K_END3)
      return void 0;
    throw refused3(body);
  }
  finish() {
    this.done = true;
    this.c.subs.delete(this.id);
  }
  close() {
    if (this.done)
      return;
    this.finish();
    this.c.send(frame3(K_END3, this.id, this.op));
  }
  async *[Symbol.asyncIterator]() {
    try {
      for (; ; ) {
        const v = await this.next();
        if (v === void 0)
          return;
        yield v;
      }
    } finally {
      this.close();
    }
  }
};
var ConnBase3 = class _ConnBase {
  session = 0n;
  deadlineMs = CALL_DEADLINE_MS3;
  nextId = 1;
  buf = new Uint8Array(0);
  pending = /* @__PURE__ */ new Map();
  /** @internal */
  subs = /* @__PURE__ */ new Map();
  closed = false;
  first = null;
  ws;
  constructor(ws) {
    this.ws = ws;
    ws.binaryType = "arraybuffer";
    ws.onmessage = (e) => this.onData(new Uint8Array(e.data));
    ws.onclose = () => this.onClose();
  }
  onData(d) {
    if (this.buf.length) {
      const b = new Uint8Array(this.buf.length + d.length);
      b.set(this.buf);
      b.set(d, this.buf.length);
      this.buf = b;
    } else
      this.buf = d;
    for (; ; ) {
      if (this.buf.length < HEADER3)
        return;
      const v = new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.length);
      const len = v.getUint32(0, true);
      if (len > MAX_PAYLOAD3)
        return void this.ws.close();
      if (this.buf.length < HEADER3 + len)
        return;
      const kind = this.buf[4];
      const id = Number(v.getBigUint64(5, true));
      const body = this.buf.slice(HEADER3, HEADER3 + len);
      this.buf = this.buf.subarray(HEADER3 + len);
      if (this.first) {
        const f = this.first;
        this.first = null;
        f([kind, id, body]);
        continue;
      }
      const sub = kind === K_ITEM3 || kind === K_END3 || kind === K_ERR3 ? this.subs.get(id) : void 0;
      if (sub) {
        sub.push([kind, body]);
        if (kind !== K_ITEM3)
          this.subs.delete(id);
        continue;
      }
      const w = this.pending.get(id);
      if (w) {
        this.pending.delete(id);
        w([kind, body]);
      }
    }
  }
  onClose() {
    this.closed = true;
    if (this.first) {
      const f = this.first;
      this.first = null;
      f(null);
    }
    for (const w of this.pending.values())
      w(null);
    this.pending.clear();
    for (const s of this.subs.values())
      s.push(null);
    this.subs.clear();
  }
  /** @internal */
  send(b) {
    if (this.closed)
      throw new Closed3("connection closed");
    this.ws.send(b);
  }
  /** @internal Open `url`, say Hello as `api`, wait for the answer. */
  static async open(url, hello, waitMs) {
    const ws = new WebSocket(url);
    await new Promise((res5, rej) => {
      const t = setTimeout(() => {
        ws.close();
        rej(new Timeout3(`connect ${url}`));
      }, waitMs);
      ws.onopen = () => {
        clearTimeout(t);
        res5();
      };
      ws.onerror = () => {
        clearTimeout(t);
        rej(new WireError3(`connect ${url}: refused or unreachable`));
      };
    });
    const c = new _ConnBase(ws);
    const ans = new Promise((res5, rej) => {
      c.first = res5;
      setTimeout(() => {
        if (c.first === res5) {
          c.first = null;
          ws.close();
          rej(new Timeout3("no Hello answer"));
        }
      }, waitMs);
    });
    ws.send(frame3(K_HELLO3, 0, 0, hello));
    const m = await ans;
    if (m === null)
      throw new Closed3("connection closed");
    const r = refusal3(m[2]);
    if (m[0] !== K_HELLO3 || r instanceof Refused3) {
      ws.close();
      throw r instanceof Refused3 ? r : new Refused3("Ok");
    }
    c.session = r.ok;
    return c;
  }
  /** @internal */
  async call(op, qc, pc, req, waitMs = 0) {
    const deadlineMs = Math.max(this.deadlineMs, waitMs);
    const payload = encode3(qc, req);
    const id = this.nextId++;
    const got = await new Promise((res5, rej) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        rej(new Timeout3(`op ${op} took over ${deadlineMs} ms`));
      }, deadlineMs);
      this.pending.set(id, (m) => {
        clearTimeout(t);
        res5(m);
      });
      try {
        this.send(frame3(K_REQ3, id, op, payload));
      } catch (e) {
        clearTimeout(t);
        this.pending.delete(id);
        rej(e);
      }
    });
    if (got === null)
      throw new Closed3("connection closed");
    if (got[0] === K_RESP3)
      return decode3(pc, got[1]);
    throw refused3(got[1]);
  }
  /** @internal */
  subscribeOp(op, qc, ic, req) {
    const payload = encode3(qc, req);
    const id = this.nextId++;
    const sub = new Subscription3(this, id, op, ic);
    if (this.closed)
      throw new Closed3("connection closed");
    this.subs.set(id, sub);
    this.send(frame3(K_SUB3, id, op, payload));
    return sub;
  }
  close() {
    this.ws.close();
  }
};
async function connectWeb3(g, waitMs, instance = "") {
  const key = instance ? `${API_NAME3}#${instance}` : API_NAME3;
  const w = new W3();
  str3.enc(w, key);
  u323.enc(w, API_VERSION3);
  u643.enc(w, SCHEMA3);
  bytes3.enc(w, g.everyone !== void 0 ? new TextEncoder().encode("ceeveryn" + g.everyone) : await webProof3(g, key));
  bool3.enc(w, false);
  return ConnBase3.open(g.url, w.out(), waitMs);
}
TABLE3["Health"] = struct3([["ok", bool3], ["version", str3], ["uptime_s", u643]]);
TABLE3["Ref"] = struct3([["label", str3], ["kind", str3], ["to", str3]]);
TABLE3["Pong"] = struct3([["nonce", u643], ["node", str3], ["at_ms", u643]]);
TABLE3["Device"] = struct3([["node", str3], ["label", str3], ["ws_url", str3], ["lat", f643], ["lon", f643], ["refs", vec3(ref3("Ref"))]]);
TABLE3["Sample"] = struct3([["node", str3], ["rtt_ms", f643]]);
TABLE3["Samples"] = struct3([["samples", vec3(ref3("Sample"))]]);
TABLE3["Latest"] = struct3([["samples", vec3(ref3("Sample"))], ["age_ms", u643], ["refs", vec3(ref3("Ref"))]]);
TABLE3["RttError"] = enumOf3([["Invalid", [["f0", str3]]], ["Limited", [["f0", str3]]], ["Failed", [["f0", str3]]]]);
TABLE3["SpawnReq"] = struct3([["node", str3], ["n", u323]]);
TABLE3["SpawnResp"] = struct3([["ids", vec3(str3)]]);
TABLE3["InstancesReq"] = struct3([["node", str3]]);
TABLE3["InstancesResp"] = struct3([["ids", vec3(str3)]]);
TABLE3["StopIdReq"] = struct3([["id", str3]]);
TABLE3["StopIdResp"] = struct3([["stopped", bool3]]);
TABLE3["DeployReq"] = struct3([["node", str3], ["version", str3]]);
TABLE3["DeployResp"] = struct3([["ok", bool3], ["version", str3]]);
TABLE3["BenchReq"] = struct3([["op", str3], ["n", u323]]);
TABLE3["BenchResp"] = struct3([["p50_ms", f643], ["p95_ms", f643], ["errors", u323]]);
TABLE3["CellOpsError"] = enumOf3([["Invalid", [["f0", str3]]], ["Failed", [["f0", str3]]]]);
var NetRttClient = class _NetRttClient {
  conn;
  constructor(conn2) {
    this.conn = conn2;
  }
  /** Through the wire.ws-door in `g` (default: the grant in this page's link); `instance` names one instance of the api (Rust by_instance). */
  static async connect(g = grantFromLink3(), waitMs = 1e4, instance = "") {
    if (!g)
      throw new Refused3("Gate", "no grant in this link (#g=...)");
    return new _NetRttClient(await connectWeb3(g, waitMs, instance));
  }
  close() {
    this.conn.close();
  }
  /** op HealthOp (needs net.rtt:health). */
  healthOp() {
    return this.conn.call(1, unit3, ref3("Health"), null);
  }
  /** op Ping (needs net.rtt:ping). */
  ping(req) {
    return this.conn.call(2, u643, ref3("Pong"), req);
  }
  /** op Here (needs net.rtt:read). */
  here() {
    return this.conn.call(3, unit3, ref3("Device"), null);
  }
  /** op Devices (needs net.rtt:read). */
  devices() {
    return this.conn.call(4, unit3, res3(vec3(ref3("Device")), ref3("RttError")), null, 8e3);
  }
  /** op Report (needs net.rtt:report). */
  report(req) {
    return this.conn.call(5, ref3("Samples"), res3(u323, ref3("RttError")), req);
  }
  /** op LatestOf (needs net.rtt:read). */
  latestOf(req) {
    return this.conn.call(6, str3, ref3("Latest"), req);
  }
  /** op CellSpawn (needs net.rtt:spawn). */
  cellSpawn(req) {
    return this.conn.call(900, ref3("SpawnReq"), res3(ref3("SpawnResp"), ref3("CellOpsError")), req);
  }
  /** op CellInstances (needs net.rtt:instances). */
  cellInstances(req) {
    return this.conn.call(901, ref3("InstancesReq"), res3(ref3("InstancesResp"), ref3("CellOpsError")), req);
  }
  /** op CellStop (needs net.rtt:stop). */
  cellStop(req) {
    return this.conn.call(902, ref3("StopIdReq"), res3(ref3("StopIdResp"), ref3("CellOpsError")), req);
  }
  /** op CellDeploy (needs net.rtt:deploy). */
  cellDeploy(req) {
    return this.conn.call(903, ref3("DeployReq"), res3(ref3("DeployResp"), ref3("CellOpsError")), req);
  }
  /** op CellBench (needs net.rtt:bench). */
  cellBench(req) {
    return this.conn.call(904, ref3("BenchReq"), res3(ref3("BenchResp"), ref3("CellOpsError")), req);
  }
};

// gen/ClientGen.ts
var API_NAME4 = "client.gen";
var API_VERSION4 = 1;
var SCHEMA4 = 9648135775005696411n;
var CALL_DEADLINE_MS4 = 8e3;
var HEADER4 = 17;
var MAX_PAYLOAD4 = 16 << 20;
var K_HELLO4 = 0;
var K_REQ4 = 1;
var K_RESP4 = 2;
var K_ERR4 = 3;
var K_SUB4 = 5;
var K_ITEM4 = 6;
var K_END4 = 7;
var WireError4 = class extends Error {
};
var Timeout4 = class extends WireError4 {
};
var Closed4 = class extends WireError4 {
};
var DecodeError4 = class extends WireError4 {
};
var Refused4 = class extends WireError4 {
  kind;
  detail;
  extra;
  constructor(kind, detail, extra = {}) {
    super(detail === void 0 ? kind : `${kind}: ${String(detail)}`);
    this.kind = kind;
    this.detail = detail;
    this.extra = extra;
  }
};
var W4 = class {
  buf = new Uint8Array(64);
  len = 0;
  room(n) {
    if (this.len + n <= this.buf.length)
      return;
    const nb = new Uint8Array(Math.max(this.buf.length * 2, this.len + n));
    nb.set(this.buf.subarray(0, this.len));
    this.buf = nb;
  }
  byte(b) {
    this.room(1);
    this.buf[this.len++] = b;
  }
  bytes(b) {
    this.room(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }
  varint(v) {
    if (typeof v === "number") {
      while (v >= 128) {
        this.byte(v % 128 | 128);
        v = Math.floor(v / 128);
      }
      this.byte(v);
    } else {
      while (v >= 0x80n) {
        this.byte(Number(v & 0x7fn) | 128);
        v >>= 7n;
      }
      this.byte(Number(v));
    }
  }
  out() {
    return this.buf.slice(0, this.len);
  }
};
var R4 = class {
  i = 0;
  b;
  constructor(b) {
    this.b = b;
  }
  take(n) {
    if (n < 0 || this.i + n > this.b.length)
      throw new DecodeError4("unexpected end of data");
    const v = this.b.subarray(this.i, this.i + n);
    this.i += n;
    return v;
  }
  byte() {
    return this.take(1)[0];
  }
  varint() {
    let x = 0, mul = 1;
    for (let n = 0; n < 8; n++) {
      const c = this.byte();
      x += (c & 127) * mul;
      if (!(c & 128))
        return x;
      mul *= 128;
    }
    throw new DecodeError4("varint too long for a number");
  }
  varbig() {
    let x = 0n, sh = 0n;
    for (let n = 0; n < 20; n++) {
      const c = this.byte();
      x |= BigInt(c & 127) << sh;
      if (!(c & 128))
        return x;
      sh += 7n;
    }
    throw new DecodeError4("varint too long");
  }
  dv(n) {
    const s = this.take(n);
    return new DataView(s.buffer, s.byteOffset, n);
  }
};
var te4 = new TextEncoder();
var td4 = new TextDecoder("utf-8", { fatal: true });
function uint4(bits) {
  const mx = 2 ** bits - 1;
  return {
    enc(w, v) {
      if (!Number.isInteger(v) || v < 0 || v > mx)
        throw new RangeError(`u${bits} out of range: ${v}`);
      w.varint(v);
    },
    dec(r) {
      const v = r.varint();
      if (v > mx)
        throw new DecodeError4(`u${bits} overflow`);
      return v;
    }
  };
}
function sint4(bits) {
  const lo = -(2 ** (bits - 1)), hi = 2 ** (bits - 1) - 1;
  return {
    enc(w, v) {
      if (!Number.isInteger(v) || v < lo || v > hi)
        throw new RangeError(`i${bits} out of range: ${v}`);
      w.varint(v >= 0 ? v * 2 : -v * 2 - 1);
    },
    dec(r) {
      const z = r.varint();
      const v = z % 2 === 0 ? z / 2 : -(z + 1) / 2;
      if (v < lo || v > hi)
        throw new DecodeError4(`i${bits} overflow`);
      return v;
    }
  };
}
function ubig4(bits) {
  const mx = (1n << BigInt(bits)) - 1n;
  return {
    enc(w, v) {
      if (typeof v !== "bigint" || v < 0n || v > mx)
        throw new RangeError(`u${bits} out of range: ${v}`);
      w.varint(v);
    },
    dec(r) {
      const v = r.varbig();
      if (v > mx)
        throw new DecodeError4(`u${bits} overflow`);
      return v;
    }
  };
}
function sbig4(bits) {
  const b = BigInt(bits);
  const lo = -(1n << b - 1n), hi = (1n << b - 1n) - 1n;
  return {
    enc(w, v) {
      if (typeof v !== "bigint" || v < lo || v > hi)
        throw new RangeError(`i${bits} out of range: ${v}`);
      w.varint(v << 1n ^ v >> b - 1n);
    },
    dec(r) {
      const z = r.varbig();
      const v = z >> 1n ^ -(z & 1n);
      if (v < lo || v > hi)
        throw new DecodeError4(`i${bits} overflow`);
      return v;
    }
  };
}
var u164 = uint4(16);
var u324 = uint4(32);
var i164 = sint4(16);
var i324 = sint4(32);
var u644 = ubig4(64);
var u1284 = ubig4(128);
var i644 = sbig4(64);
var i1284 = sbig4(128);
var f644 = {
  enc(w, v) {
    const d = new DataView(new ArrayBuffer(8));
    d.setFloat64(0, v, true);
    w.bytes(new Uint8Array(d.buffer));
  },
  dec: (r) => r.dv(8).getFloat64(0, true)
};
var bool4 = {
  enc: (w, v) => w.byte(v ? 1 : 0),
  dec(r) {
    const c = r.byte();
    if (c > 1)
      throw new DecodeError4("bad bool");
    return c === 1;
  }
};
var str4 = {
  enc(w, v) {
    const d = te4.encode(v);
    w.varint(d.length);
    w.bytes(d);
  },
  dec(r) {
    try {
      return td4.decode(r.take(r.varint()));
    } catch (e) {
      if (e instanceof WireError4)
        throw e;
      throw new DecodeError4(String(e));
    }
  }
};
var unit4 = { enc() {
}, dec: () => null };
var bytes4 = {
  enc(w, v) {
    w.varint(v.length);
    w.bytes(v);
  },
  dec: (r) => r.take(r.varint()).slice()
};
function vec4(c) {
  return {
    enc(w, v) {
      w.varint(v.length);
      for (const x of v)
        c.enc(w, x);
    },
    dec(r) {
      const n = r.varint();
      if (n > MAX_PAYLOAD4)
        throw new DecodeError4("vec too long");
      const o = [];
      for (let i = 0; i < n; i++)
        o.push(c.dec(r));
      return o;
    }
  };
}
function res4(ok, err) {
  return {
    enc(w, v) {
      if ("ok" in v) {
        w.byte(0);
        ok.enc(w, v.ok);
      } else {
        w.byte(1);
        err.enc(w, v.err);
      }
    },
    dec(r) {
      const t = r.byte();
      if (t === 0)
        return { ok: ok.dec(r) };
      if (t === 1)
        return { err: err.dec(r) };
      throw new DecodeError4("bad result tag");
    }
  };
}
var TABLE4 = {};
function ref4(name) {
  return { enc: (w, v) => TABLE4[name].enc(w, v), dec: (r) => TABLE4[name].dec(r) };
}
function struct4(fields) {
  return {
    enc(w, v) {
      for (const [k, c] of fields)
        c.enc(w, v[k]);
    },
    dec(r) {
      const o = {};
      for (const [k, c] of fields)
        o[k] = c.dec(r);
      return o;
    }
  };
}
function enumOf4(variants) {
  return {
    enc(w, v) {
      const i = variants.findIndex(([n]) => n === v.tag);
      if (i < 0)
        throw new RangeError(`not a variant of this enum: ${JSON.stringify(v)}`);
      w.varint(i);
      for (const [k, c] of variants[i][1])
        c.enc(w, v[k]);
    },
    dec(r) {
      const i = r.varint();
      if (i >= variants.length)
        throw new DecodeError4(`enum variant ${i} out of range`);
      const o = { tag: variants[i][0] };
      for (const [k, c] of variants[i][1])
        o[k] = c.dec(r);
      return o;
    }
  };
}
function encode4(c, v) {
  const w = new W4();
  c.enc(w, v);
  return w.out();
}
function decode4(c, body) {
  const r = new R4(body);
  const v = c.dec(r);
  if (r.i !== body.length)
    throw new DecodeError4("trailing bytes");
  return v;
}
function frame4(kind, id, op, payload = new Uint8Array()) {
  const b = new Uint8Array(HEADER4 + payload.length);
  const d = new DataView(b.buffer);
  d.setUint32(0, payload.length, true);
  b[4] = kind;
  d.setBigUint64(5, BigInt(id), true);
  d.setUint32(13, op, true);
  b.set(payload, HEADER4);
  return b;
}
function adaptError4(r) {
  const i = r.varint();
  switch (i) {
    case 0:
      return { kind: "Narrow", field: str4.dec(r), value: str4.dec(r) };
    case 1:
      return { kind: "NoVariant", field: str4.dec(r), variant: str4.dec(r) };
    case 2:
      return { kind: "Missing", field: str4.dec(r) };
    case 3:
      return { kind: "NoPath" };
    case 4:
      return { kind: "Decode", why: str4.dec(r) };
    default:
      throw new DecodeError4(`unknown AdaptError variant ${i}`);
  }
}
function refusal4(body) {
  const r = new R4(body);
  const i = r.varint();
  switch (i) {
    case 0:
      return { ok: r.varbig() };
    case 1: {
      const ours = r.varbig(), theirs = r.varbig(), api = str4.dec(r);
      return new Refused4("Schema", `server has schema 0x${ours.toString(16)}, this client 0x${theirs.toString(16)} (api ${api})`, { ours, theirs, api });
    }
    case 4:
      return new Refused4("UnknownOp", r.varint());
    case 8: {
      const ours = r.varbig(), theirs = r.varbig(), api = str4.dec(r), update = str4.dec(r);
      return new Refused4("SchemaAt", `server has schema 0x${ours.toString(16)}, this client 0x${theirs.toString(16)} (api ${api}): ${update}`, { ours, theirs, api, update });
    }
    case 9: {
      const api = str4.dec(r), op = r.varint(), op_name = str4.dec(r), ours = r.varint(), theirs = r.varint();
      const why = adaptError4(r);
      return new Refused4("Adapt", `${api} op ${op_name} (#${op}) v${theirs} <-> v${ours}: ${JSON.stringify(why)}`, { api, op, op_name, ours, theirs, why });
    }
    case 10: {
      const api = str4.dec(r), op = r.varint(), op_name = str4.dec(r), ours = r.varbig(), theirs = r.varbig();
      return new Refused4("SchemaMismatch", `${api} op ${op_name} (#${op}): server shape 0x${ours.toString(16)}, this client 0x${theirs.toString(16)}`, { api, op, op_name, ours, theirs });
    }
    default: {
      const names = { 2: "Gate", 3: "Right", 5: "NoCell", 6: "Decode", 7: "Remote" };
      if (!(i in names))
        throw new DecodeError4(`unknown Refusal variant ${i}`);
      return new Refused4(names[i], str4.dec(r));
    }
  }
}
function refused4(body) {
  try {
    const r = refusal4(body);
    return r instanceof Refused4 ? r : new Refused4("Ok");
  } catch {
    return new Refused4("Remote", "bad error body");
  }
}
var HELLO_DOMAIN4 = "ce-wire-hello-v1";
var PKCS8_ED255194 = Uint8Array.from([48, 46, 2, 1, 0, 48, 5, 6, 3, 43, 101, 112, 4, 34, 4, 32]);
function b64u4(s) {
  const t = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(t, (c) => c.charCodeAt(0));
}
function grantFromLink4(href = location.href) {
  const u = new URL(href);
  const f = new URLSearchParams(u.hash.slice(1));
  const g = f.get("g");
  if (!g)
    return null;
  const [k, c] = g.split(".");
  const url = f.get("w") ?? `${u.protocol === "https:" ? "wss" : "ws"}://${u.host}/wire`;
  return { url, seed: b64u4(k), chain: b64u4(c) };
}
var WebKey4 = class _WebKey {
  nodeId;
  key;
  constructor(nodeId, key) {
    this.nodeId = nodeId;
    this.key = key;
  }
  static async fromSeed(seed) {
    const der = new Uint8Array(48);
    der.set(PKCS8_ED255194);
    der.set(seed, 16);
    const key = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, true, ["sign"]);
    const jwk = await crypto.subtle.exportKey("jwk", key);
    return new _WebKey(b64u4(jwk.x), key);
  }
  async sign(data) {
    return new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, this.key, data));
  }
};
async function webProof4(g, api = API_NAME4, schema = SCHEMA4) {
  const k = await WebKey4.fromSeed(g.seed);
  const unixMs = BigInt(Date.now());
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const s = new W4();
  str4.enc(s, HELLO_DOMAIN4);
  str4.enc(s, api);
  u644.enc(s, schema);
  u644.enc(s, unixMs);
  s.bytes(nonce);
  s.bytes(k.nodeId);
  bytes4.enc(s, g.chain);
  const sig = await k.sign(s.out());
  const p = new W4();
  p.bytes(k.nodeId);
  u644.enc(p, unixMs);
  p.bytes(nonce);
  bytes4.enc(p, g.chain);
  bytes4.enc(p, sig);
  return p.out();
}
var Subscription4 = class {
  q = [];
  waiter = null;
  done = false;
  c;
  id;
  op;
  codec;
  constructor(c, id, op, codec) {
    this.c = c;
    this.id = id;
    this.op = op;
    this.codec = codec;
  }
  /** @internal */
  push(m) {
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w(m);
    } else
      this.q.push(m);
  }
  /** Next item, or `undefined` when the server ended the stream normally. */
  async next(timeoutMs) {
    if (this.done)
      return void 0;
    const m = await new Promise((res5, rej) => {
      if (this.q.length)
        return res5(this.q.shift());
      let t;
      this.waiter = (x) => {
        if (t)
          clearTimeout(t);
        res5(x);
      };
      if (timeoutMs !== void 0)
        t = setTimeout(() => {
          this.waiter = null;
          rej(new Timeout4("no item"));
        }, timeoutMs);
    });
    if (m === null) {
      this.finish();
      throw new Closed4("connection closed");
    }
    const [kind, body] = m;
    if (kind === K_ITEM4)
      return decode4(this.codec, body);
    this.finish();
    if (kind === K_END4)
      return void 0;
    throw refused4(body);
  }
  finish() {
    this.done = true;
    this.c.subs.delete(this.id);
  }
  close() {
    if (this.done)
      return;
    this.finish();
    this.c.send(frame4(K_END4, this.id, this.op));
  }
  async *[Symbol.asyncIterator]() {
    try {
      for (; ; ) {
        const v = await this.next();
        if (v === void 0)
          return;
        yield v;
      }
    } finally {
      this.close();
    }
  }
};
var ConnBase4 = class _ConnBase {
  session = 0n;
  deadlineMs = CALL_DEADLINE_MS4;
  nextId = 1;
  buf = new Uint8Array(0);
  pending = /* @__PURE__ */ new Map();
  /** @internal */
  subs = /* @__PURE__ */ new Map();
  closed = false;
  first = null;
  ws;
  constructor(ws) {
    this.ws = ws;
    ws.binaryType = "arraybuffer";
    ws.onmessage = (e) => this.onData(new Uint8Array(e.data));
    ws.onclose = () => this.onClose();
  }
  onData(d) {
    if (this.buf.length) {
      const b = new Uint8Array(this.buf.length + d.length);
      b.set(this.buf);
      b.set(d, this.buf.length);
      this.buf = b;
    } else
      this.buf = d;
    for (; ; ) {
      if (this.buf.length < HEADER4)
        return;
      const v = new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.length);
      const len = v.getUint32(0, true);
      if (len > MAX_PAYLOAD4)
        return void this.ws.close();
      if (this.buf.length < HEADER4 + len)
        return;
      const kind = this.buf[4];
      const id = Number(v.getBigUint64(5, true));
      const body = this.buf.slice(HEADER4, HEADER4 + len);
      this.buf = this.buf.subarray(HEADER4 + len);
      if (this.first) {
        const f = this.first;
        this.first = null;
        f([kind, id, body]);
        continue;
      }
      const sub = kind === K_ITEM4 || kind === K_END4 || kind === K_ERR4 ? this.subs.get(id) : void 0;
      if (sub) {
        sub.push([kind, body]);
        if (kind !== K_ITEM4)
          this.subs.delete(id);
        continue;
      }
      const w = this.pending.get(id);
      if (w) {
        this.pending.delete(id);
        w([kind, body]);
      }
    }
  }
  onClose() {
    this.closed = true;
    if (this.first) {
      const f = this.first;
      this.first = null;
      f(null);
    }
    for (const w of this.pending.values())
      w(null);
    this.pending.clear();
    for (const s of this.subs.values())
      s.push(null);
    this.subs.clear();
  }
  /** @internal */
  send(b) {
    if (this.closed)
      throw new Closed4("connection closed");
    this.ws.send(b);
  }
  /** @internal Open `url`, say Hello as `api`, wait for the answer. */
  static async open(url, hello, waitMs) {
    const ws = new WebSocket(url);
    await new Promise((res5, rej) => {
      const t = setTimeout(() => {
        ws.close();
        rej(new Timeout4(`connect ${url}`));
      }, waitMs);
      ws.onopen = () => {
        clearTimeout(t);
        res5();
      };
      ws.onerror = () => {
        clearTimeout(t);
        rej(new WireError4(`connect ${url}: refused or unreachable`));
      };
    });
    const c = new _ConnBase(ws);
    const ans = new Promise((res5, rej) => {
      c.first = res5;
      setTimeout(() => {
        if (c.first === res5) {
          c.first = null;
          ws.close();
          rej(new Timeout4("no Hello answer"));
        }
      }, waitMs);
    });
    ws.send(frame4(K_HELLO4, 0, 0, hello));
    const m = await ans;
    if (m === null)
      throw new Closed4("connection closed");
    const r = refusal4(m[2]);
    if (m[0] !== K_HELLO4 || r instanceof Refused4) {
      ws.close();
      throw r instanceof Refused4 ? r : new Refused4("Ok");
    }
    c.session = r.ok;
    return c;
  }
  /** @internal */
  async call(op, qc, pc, req, waitMs = 0) {
    const deadlineMs = Math.max(this.deadlineMs, waitMs);
    const payload = encode4(qc, req);
    const id = this.nextId++;
    const got = await new Promise((res5, rej) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        rej(new Timeout4(`op ${op} took over ${deadlineMs} ms`));
      }, deadlineMs);
      this.pending.set(id, (m) => {
        clearTimeout(t);
        res5(m);
      });
      try {
        this.send(frame4(K_REQ4, id, op, payload));
      } catch (e) {
        clearTimeout(t);
        this.pending.delete(id);
        rej(e);
      }
    });
    if (got === null)
      throw new Closed4("connection closed");
    if (got[0] === K_RESP4)
      return decode4(pc, got[1]);
    throw refused4(got[1]);
  }
  /** @internal */
  subscribeOp(op, qc, ic, req) {
    const payload = encode4(qc, req);
    const id = this.nextId++;
    const sub = new Subscription4(this, id, op, ic);
    if (this.closed)
      throw new Closed4("connection closed");
    this.subs.set(id, sub);
    this.send(frame4(K_SUB4, id, op, payload));
    return sub;
  }
  close() {
    this.ws.close();
  }
};
async function connectWeb4(g, waitMs, instance = "") {
  const key = instance ? `${API_NAME4}#${instance}` : API_NAME4;
  const w = new W4();
  str4.enc(w, key);
  u324.enc(w, API_VERSION4);
  u644.enc(w, SCHEMA4);
  bytes4.enc(w, g.everyone !== void 0 ? new TextEncoder().encode("ceeveryn" + g.everyone) : await webProof4(g, key));
  bool4.enc(w, false);
  return ConnBase4.open(g.url, w.out(), waitMs);
}
TABLE4["Health"] = struct4([["ok", bool4], ["version", str4], ["uptime_s", u644]]);
TABLE4["GenReq"] = struct4([["api", str4], ["lang", str4]]);
TABLE4["Source"] = struct4([["api", str4], ["lang", str4], ["file", str4], ["text", str4], ["from", str4]]);
TABLE4["SnippetReq"] = struct4([["api", str4], ["op", str4], ["lang", str4]]);
TABLE4["Snippet"] = struct4([["api", str4], ["op", str4], ["lang", str4], ["lines", vec4(str4)], ["right", str4], ["stream", bool4], ["from", str4]]);
TABLE4["GenError"] = enumOf4([["Invalid", [["f0", str4]]], ["NotFound", [["f0", str4]]], ["Failed", [["f0", str4]]]]);
TABLE4["SpawnReq"] = struct4([["node", str4], ["n", u324]]);
TABLE4["SpawnResp"] = struct4([["ids", vec4(str4)]]);
TABLE4["InstancesReq"] = struct4([["node", str4]]);
TABLE4["InstancesResp"] = struct4([["ids", vec4(str4)]]);
TABLE4["StopIdReq"] = struct4([["id", str4]]);
TABLE4["StopIdResp"] = struct4([["stopped", bool4]]);
TABLE4["DeployReq"] = struct4([["node", str4], ["version", str4]]);
TABLE4["DeployResp"] = struct4([["ok", bool4], ["version", str4]]);
TABLE4["BenchReq"] = struct4([["op", str4], ["n", u324]]);
TABLE4["BenchResp"] = struct4([["p50_ms", f644], ["p95_ms", f644], ["errors", u324]]);
TABLE4["CellOpsError"] = enumOf4([["Invalid", [["f0", str4]]], ["Failed", [["f0", str4]]]]);
var ClientGenClient = class _ClientGenClient {
  conn;
  constructor(conn2) {
    this.conn = conn2;
  }
  /** Through the wire.ws-door in `g` (default: the grant in this page's link); `instance` names one instance of the api (Rust by_instance). */
  static async connect(g = grantFromLink4(), waitMs = 1e4, instance = "") {
    if (!g)
      throw new Refused4("Gate", "no grant in this link (#g=...)");
    return new _ClientGenClient(await connectWeb4(g, waitMs, instance));
  }
  close() {
    this.conn.close();
  }
  /** op HealthOp (needs client.gen:health). */
  healthOp() {
    return this.conn.call(1, unit4, ref4("Health"), null);
  }
  /** op Gen (needs client.gen:gen). */
  gen(req) {
    return this.conn.call(2, ref4("GenReq"), res4(ref4("Source"), ref4("GenError")), req, 3e5);
  }
  /** op SnippetOp (needs client.gen:read). */
  snippetOp(req) {
    return this.conn.call(3, ref4("SnippetReq"), res4(ref4("Snippet"), ref4("GenError")), req, 3e5);
  }
  /** op CellSpawn (needs client.gen:spawn). */
  cellSpawn(req) {
    return this.conn.call(900, ref4("SpawnReq"), res4(ref4("SpawnResp"), ref4("CellOpsError")), req);
  }
  /** op CellInstances (needs client.gen:instances). */
  cellInstances(req) {
    return this.conn.call(901, ref4("InstancesReq"), res4(ref4("InstancesResp"), ref4("CellOpsError")), req);
  }
  /** op CellStop (needs client.gen:stop). */
  cellStop(req) {
    return this.conn.call(902, ref4("StopIdReq"), res4(ref4("StopIdResp"), ref4("CellOpsError")), req);
  }
  /** op CellDeploy (needs client.gen:deploy). */
  cellDeploy(req) {
    return this.conn.call(903, ref4("DeployReq"), res4(ref4("DeployResp"), ref4("CellOpsError")), req);
  }
  /** op CellBench (needs client.gen:bench). */
  cellBench(req) {
    return this.conn.call(904, ref4("BenchReq"), res4(ref4("BenchResp"), ref4("CellOpsError")), req);
  }
};

// app.ts
var API = "infer.generate";
var $ = (s) => document.querySelector(s);
var esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
var frag = new URLSearchParams(location.hash.slice(1));
var auto = frag.get("auto") === "1";
var cfg = {};
var wireBase = frag.get("w") ?? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/wire`;
var grant = grantFromLink();
async function pageGrant() {
  if (grant)
    return grant;
  const http = wireBase.replace(/^ws/, "http").replace(/\/wire.*$/, "");
  const r = await fetch(`${frag.get("grant") ?? cfg.grant ?? http + "/grant"}?page=${encodeURIComponent(frag.get("page") ?? "inference")}`, { cache: "no-store" });
  if (!r.ok)
    throw new Error(`grant: ${r.status} ${(await r.text()).slice(0, 120)}`);
  const j = await r.json();
  const [k, c] = String(j.g).split(".");
  const b = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (x) => x.charCodeAt(0));
  grant = { url: wireBase, seed: b(k), chain: b(c) };
  return grant;
}
function at(g, node) {
  if (!node || node === doorNode)
    return { ...g, url: wireBase };
  return { ...g, url: `${wireBase}${wireBase.includes("?") ? "&" : "?"}at=${encodeURIComponent(node)}` };
}
var conns = /* @__PURE__ */ new Map();
function conn(key, make) {
  let p = conns.get(key);
  if (!p) {
    p = make();
    p.catch(() => conns.delete(key));
    conns.set(key, p);
  }
  return p;
}
var drop = (key) => conns.delete(key);
var infer = async (node) => conn(`ig:${node}`, async () => InferGenerateClient.connect(at(await pageGrant(), node), 6e3));
var rtt = async (node) => conn(`rt:${node}`, async () => NetRttClient.connect(at(await pageGrant(), node), 6e3));
var place = async () => conn("pn", async () => PlaceNearClient.connect(at(await pageGrant(), ""), 6e3));
var gen = async () => conn("cg", async () => ClientGenClient.connect(at(await pageGrant(), ""), 6e3));
var doorNode = "";
var short = (n) => n.slice(0, 16);
var info = /* @__PURE__ */ new Map();
var out = /* @__PURE__ */ new Map();
var ranked = [];
var answering = "";
var COLORS = ["var(--acc)", "#4fd1c5", "#b794f4", "#f687b3", "#90cdf4"];
var colorOf = /* @__PURE__ */ new Map();
var color = (cls) => {
  if (!colorOf.has(cls))
    colorOf.set(cls, COLORS[colorOf.size % COLORS.length]);
  return colorOf.get(cls);
};
var classOf = (node) => info.get(short(node))?.device_class ?? "device " + short(node).slice(0, 6);
async function ping(node) {
  try {
    const c = await rtt(node);
    const v = [];
    for (let i = 0; i < 3; i++) {
      const t = performance.now();
      await c.ping(BigInt(Date.now()));
      v.push(performance.now() - t);
    }
    return v.sort((a, b) => a - b)[1];
  } catch {
    drop(`rt:${node}`);
    return null;
  }
}
async function holderInfo(node) {
  try {
    const h = await (await infer(node)).holder();
    info.set(short(node), h);
    return h;
  } catch {
    drop(`ig:${node}`);
    return null;
  }
}
var refreshing = false;
async function refresh() {
  if (refreshing)
    return;
  refreshing = true;
  try {
    const p = await place();
    const nodes = new Set(ranked.map((r2) => r2.node));
    if (!nodes.size) {
      const first = await p.rankRoom({ api: API, major: 1, samples: [], pool: [], room: [] });
      if ("ok" in first)
        first.ok.forEach((r2) => nodes.add(r2.node));
    }
    const samples = [];
    const room = [];
    await Promise.all([...nodes].map(async (n) => {
      const [ms, h] = await Promise.all([ping(n), holderInfo(n)]);
      if (ms != null)
        samples.push({ node: n, rtt_ms: ms });
      if (h)
        room.push({ node: n, free_mem_mb: h.mem_free_mb, load1: h.load1, cores: h.cores, busy: h.busy, slots: h.slots });
    }));
    try {
      await (await rtt("")).report({ samples });
    } catch {
      drop("rt:");
    }
    const r = await p.rankRoom({ api: API, major: 1, samples, pool: [], room });
    if ("ok" in r) {
      const now = Date.now();
      const kept = ranked.filter((x) => !r.ok.some((y) => y.node === x.node) && (out.get(x.node) ?? 0) > now);
      ranked = [...r.ok, ...kept.map((x) => ({ ...x, why: "left the registry (withdrawn)", score: 0 }))];
      for (const x of r.ok)
        if ((out.get(x.node) ?? 0) > now && !info.get(x.node)?.withdrawn && x.why.indexOf("not reported") < 0)
          out.delete(x.node);
      $("#ranksrc").textContent = "place.near RankRoom, inputs: net.rtt (this browser), mesh.bench, each holder's Holder op; refreshed " + (/* @__PURE__ */ new Date()).toLocaleTimeString();
    } else {
      $("#ranksrc").textContent = "place.near: " + JSON.stringify(r.err);
    }
    renderRank();
  } catch (e) {
    drop("pn");
    $("#ranksrc").textContent = "place.near unreachable: " + String(e).slice(0, 120);
  } finally {
    refreshing = false;
  }
}
function renderRank() {
  const now = Date.now();
  $("#rank").innerHTML = ranked.map((r) => {
    const h = info.get(r.node);
    const gone = (out.get(r.node) ?? 0) > now || h?.withdrawn;
    const cls = classOf(r.node);
    const cost = r.why.match(/= (\d+)$/)?.[1];
    return `<tr><td><div class="dev"><span class="sw" style="--dc:${color(cls)}"></span><span class="${gone ? "gone" : ""}">${esc(cls)}</span>${r.node === answering ? '<span class="now">answering</span>' : ""}
      <button class="btn quiet take" data-node="${r.node}" ${gone ? "disabled" : ""}>Take it away</button></div>
      <div class="why">${esc(r.why.replace(/ = \d+$/, ""))}</div><div class="sub">node ${r.node}${h ? ` \xB7 ${esc(h.model)} \xB7 ${h.tok_s ? h.tok_s.toFixed(1) + " tok/s last" : "idle"}` : ""}</div></td>
      <td class="n">${gone ? "out" : cost ? cost + " ms" : "-"}</td></tr>`;
  }).join("") || `<tr><td colspan="2">no device holds ${API} right now</td></tr>`;
}
var keys = /* @__PURE__ */ new Map();
var hexb = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));
async function verify(t) {
  try {
    if (!keys.has(t.node))
      keys.set(t.node, crypto.subtle.importKey("raw", hexb(t.node), { name: "Ed25519" }, false, ["verify"]));
    const msg = new TextEncoder().encode(`infer.generate/1
${t.req_id}
${t.idx}
${t.node}
${t.device_class}
${t.t_ms}
${t.text}`);
    return await crypto.subtle.verify("Ed25519", await keys.get(t.node), hexb(t.sig), msg);
  } catch {
    return false;
  }
}
var stats = { tokens: 0, verified: 0, bad: 0, by: {}, switches: [] };
var busy = false;
function best() {
  const now = Date.now();
  const r = ranked.find((x) => (out.get(x.node) ?? 0) <= now && !info.get(x.node)?.withdrawn && x.score > 0);
  return r ? r.node : null;
}
function logSwitch(html) {
  const li = document.createElement("li");
  li.innerHTML = `${(/* @__PURE__ */ new Date()).toLocaleTimeString()} ${html}`;
  const log = $("#log");
  log.querySelector(".empty")?.remove();
  log.prepend(li);
}
async function ask(prompt) {
  if (busy)
    return;
  busy = true;
  $("#send").disabled = true;
  stats = { tokens: 0, verified: 0, bad: 0, by: {}, switches: [] };
  const ans = $("#answer");
  ans.innerHTML = "";
  const req_id = crypto.randomUUID().slice(0, 18);
  let text = "";
  let idx = 0;
  let lastTok = 0;
  let movedAt = 0;
  let from = "";
  const t0 = performance.now();
  let first = 0;
  let idxWarm = false;
  let busyWaits = 0;
  try {
    for (let hop = 0; hop < 6; hop++) {
      if (!ranked.length)
        await refresh();
      const node = best();
      if (!node) {
        $("#status").textContent = "no device can answer right now";
        break;
      }
      answering = node;
      renderRank();
      $("#status").textContent = `asking ${classOf(node)}${idx ? `, continuing from token ${idx}` : ""}...`;
      let c;
      try {
        c = await infer(node);
      } catch {
        drop(`ig:${node}`);
        out.set(node, Date.now() + 25e3);
        continue;
      }
      const sub = c.generate({ model: "", messages: [{ role: "user", content: prompt }], max_tokens: 200, temp: 0.3, prefix: text, start_idx: idx, req_id });
      let end = "stop";
      let firstHere = true;
      try {
        for (; ; ) {
          const it = await sub.next(6e4);
          if (!it) {
            end = "moved";
            break;
          }
          if (it.tag === "Token") {
            const t = it.f0;
            const now = performance.now();
            if (!first)
              first = now;
            if (firstHere && from && from !== node) {
              const s = { at_idx: t.idx, from: classOf(from), to: classOf(node), gap_ms: Math.round(now - lastTok), moved_to_first_ms: Math.round(now - movedAt) };
              stats.switches.push(s);
              logSwitch(`<b>switch</b> at token ${s.at_idx}: ${esc(s.from)} &rarr; ${esc(s.to)}, ${s.gap_ms} ms from the last token to the next (${s.moved_to_first_ms} ms after "moved")`);
              const cut = document.createElement("span");
              cut.className = "cut";
              cut.textContent = `\u2192 ${s.to}`;
              ans.append(cut);
            }
            if (firstHere && !idxWarm) {
              idxWarm = true;
              warm(node, prompt, req_id);
            }
            firstHere = false;
            lastTok = now;
            text += t.text;
            idx = t.idx + 1;
            stats.tokens++;
            stats.by[t.device_class] = (stats.by[t.device_class] ?? 0) + 1;
            const sp = document.createElement("span");
            sp.className = "tk";
            sp.style.setProperty("--dc", color(t.device_class));
            sp.textContent = t.text;
            sp.title = `${t.device_class}
node ${t.node}
token ${t.idx}
sig ${t.sig.slice(0, 32)}... (checking)`;
            ans.append(sp);
            verify(t).then((ok) => {
              ok ? stats.verified++ : stats.bad++;
              sp.title = sp.title.replace("(checking)", ok ? "(signature verified)" : "(SIGNATURE DOES NOT VERIFY)");
              if (!ok)
                sp.classList.add("bad");
              meter();
            });
            meter();
            if (auto && autoTake && stats.tokens === autoTake) {
              autoTake = 0;
              takeAway(node);
            }
          } else if (it.tag === "Done") {
            end = "done";
            $("#status").textContent = `done: ${it.f0.reason}, ${it.f0.spent} tokens here at ${it.f0.tok_s.toFixed(1)} tok/s; budget left on this device: ${it.f0.budget_left < 0n ? "none set" : String(it.f0.budget_left)}`;
            break;
          } else if (it.tag === "Moved") {
            end = "moved";
            break;
          } else {
            const e = it.f0;
            if (e.tag === "NotHere") {
              end = "moved";
              break;
            }
            if (e.tag === "Busy") {
              end = "busy";
              break;
            }
            $("#status").textContent = `${e.tag}: ${e.f0}`;
            break;
          }
        }
      } catch (e) {
        end = "moved";
        drop(`ig:${node}`);
      }
      if (end === "busy") {
        $("#status").textContent = `${classOf(node)} is busy; asking again...`;
        await new Promise((r) => setTimeout(r, 400));
        hop--;
        if (++busyWaits > 60)
          break;
        continue;
      }
      if (end !== "moved")
        break;
      movedAt = performance.now();
      from = node;
      out.set(node, Date.now() + 25e3);
      logSwitch(`${esc(classOf(node))} left after ${idx} tokens; asking the next device`);
      refresh();
    }
  } finally {
    answering = "";
    renderRank();
    busy = false;
    $("#send").disabled = false;
    window.__proof = { ...stats, first_token_ms: first ? Math.round(first - t0) : null, text };
    $("#proof") && ($("#proof").textContent = JSON.stringify(window.__proof));
    if (auto)
      document.title = "DONE " + document.title;
  }
}
async function warm(current, prompt, req_id) {
  const next = ranked.find((x) => x.node !== current && x.score > 0 && !info.get(x.node)?.withdrawn);
  if (!next)
    return;
  try {
    const s = (await infer(next.node)).generate({ model: "", messages: [{ role: "user", content: prompt }], max_tokens: 1, temp: 0.3, prefix: "", start_idx: 0, req_id: req_id + "-w" });
    while (await s.next(6e4)) {
    }
  } catch {
  }
}
function meter() {
  const parts = Object.entries(stats.by).map(([k, v]) => `${k}: ${v}`);
  $("#meter").textContent = `${stats.tokens} tokens (${parts.join(", ")}); signatures verified ${stats.verified}${stats.bad ? `, FAILED ${stats.bad}` : ""}`;
  $("#legend").innerHTML = Object.keys(stats.by).map((k) => `<span><span class="sw" style="--dc:${color(k)}"></span>${esc(k)}</span>`).join("");
}
async function takeAway(node) {
  const cls = classOf(node);
  try {
    const r = await (await infer(node)).withdraw({ for_s: 20 });
    if ("ok" in r) {
      out.set(node, Date.now() + 21e3);
      logSwitch(`<b>took away</b> ${esc(cls)}: unregistered for 20 s, ${r.ok.streams_moved} answer(s) told to move`);
    } else {
      logSwitch(`${esc(cls)} refused: ${esc(r.err.tag)} ${esc(String(r.err.f0))}`);
    }
  } catch (e) {
    logSwitch(`take away ${esc(cls)}: ${esc(String(e).slice(0, 100))}`);
  }
  refresh();
}
async function code(lang) {
  document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.l === lang)));
  try {
    const r = await (await gen()).snippetOp({ api: API, op: "Generate", lang });
    if ("ok" in r) {
      $("#code").textContent = r.ok.lines.join("\n");
      $("#codesrc").textContent = `client.gen SnippetOp, from ${r.ok.from}; needs ${r.ok.right}`;
    } else {
      $("#code").textContent = JSON.stringify(r.err);
    }
  } catch (e) {
    drop("cg");
    $("#code").textContent = "client.gen unreachable: " + String(e).slice(0, 120);
  }
}
var autoTake = Number(frag.get("take") ?? "12");
async function start() {
  $("#tabs").innerHTML = ["ts-web", "py", "swift"].map((l) => `<button class="btn quiet" data-l="${l}">${l}</button>`).join("");
  $("#tabs").addEventListener("click", (e) => {
    const l = e.target.dataset.l;
    if (l)
      code(l);
  });
  $("#rank").addEventListener("click", (e) => {
    const n = e.target.dataset.node;
    if (n)
      takeAway(n);
  });
  $("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    ask($("#q").value.trim() || "Hello");
  });
  $("#theme").addEventListener("click", () => {
    const r = document.documentElement;
    r.dataset.theme = r.dataset.theme === "light" ? "dark" : "light";
  });
  try {
    if (!frag.get("w")) {
      try {
        cfg = await (await fetch("config.json", { cache: "no-store" })).json();
      } catch {
      }
      if (cfg.wire)
        wireBase = cfg.wire;
    }
    await pageGrant();
    const here = await (await rtt("")).here();
    doorNode = short(here.node);
    $("#status").textContent = "connected. Ranking devices...";
  } catch (e) {
    $("#status").textContent = "The live devices are not reachable from here right now. Below: a recorded run (2026-11-15), the same page against two devices.";
    $("#answer").innerHTML = '<img src="runs/2026-11-15.png" alt="Recorded run: 12 tokens from the ARM server, then the x86 VM continues the answer after the ARM server was taken away; 98 of 98 signatures verified" style="width:100%;height:auto;border:1px solid var(--line)">';
    $("#meter").textContent = "Recorded: 98 tokens (ARM server 12, x86 VM 86), 98 signatures verified; switch at token 12 in 3.3 s.";
    return;
  }
  code("ts-web");
  await refresh();
  $("#status").textContent = ranked.length ? `${ranked.length} devices hold ${API}. Type a prompt.` : `no device holds ${API} right now`;
  setInterval(refresh, 3e3);
  if (auto)
    setTimeout(() => ask($("#q").value), 1500);
}
start();
