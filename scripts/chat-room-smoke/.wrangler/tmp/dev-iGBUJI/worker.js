var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../lib/rally-errors.ts
var AppError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
  static {
    __name(this, "AppError");
  }
};

// ../../lib/chat.ts
var CHAT_LIMITS = { body: 2e3, imageBytes: 8 * 1024 * 1024, videoBytes: 50 * 1024 * 1024, perMinute: 20, page: 40 };
async function chatAccess(db, player, clubId) {
  const row = await db.prepare("SELECT m.role,EXISTS(SELECT 1 FROM chat_mutes x WHERE x.club_id=m.club_id AND x.player_id=m.player_id) muted FROM memberships m JOIN clubs c ON c.id=m.club_id JOIN profiles p ON p.id=m.player_id WHERE m.club_id=? AND m.player_id=? AND m.status='active' AND m.role!='guest' AND c.approval_status='approved' AND p.deleted_at IS NULL AND p.auth_id IS NOT NULL").bind(clubId, player).first();
  if (!row) throw new AppError(403, "Chat is for active club members.");
  return { admin: ["owner", "admin", "board"].includes(row.role), muted: !!row.muted };
}
__name(chatAccess, "chatAccess");

// ../../lib/chat-media.ts
function sniffMedia(b) {
  const at = /* @__PURE__ */ __name((i, s) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0)), "at");
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return { kind: "image", contentType: "image/jpeg" };
  if (b[0] === 137 && at(1, "PNG")) return { kind: "image", contentType: "image/png" };
  if (at(0, "GIF8")) return { kind: "image", contentType: "image/gif" };
  if (at(0, "RIFF") && at(8, "WEBP")) return { kind: "image", contentType: "image/webp" };
  if (at(4, "ftyp")) return { kind: "video", contentType: at(8, "qt  ") ? "video/quicktime" : "video/mp4" };
  if (b[0] === 26 && b[1] === 69 && b[2] === 223 && b[3] === 163) return { kind: "video", contentType: "video/webm" };
  return null;
}
__name(sniffMedia, "sniffMedia");
async function uploadChatMedia(env, viewer, clubId, request, now = (/* @__PURE__ */ new Date()).toISOString()) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(clubId)) throw new AppError(400, "Invalid club.");
  const { muted } = await chatAccess(env.DB, viewer, clubId);
  if (muted) throw new AppError(403, "You are muted in this chat.");
  const length = Number(request.headers.get("content-length")), body = request.body;
  if (!body || !Number.isSafeInteger(length) || length <= 0) throw new AppError(411, "Choose a photo or video to upload.");
  if (length > CHAT_LIMITS.videoBytes) throw new AppError(413, "Files can be up to 50 MB. Photos up to 8 MB, videos about 30 seconds.");
  const pending = (await env.DB.prepare("SELECT count(*) n FROM chat_media WHERE uploader_id=? AND attached_at IS NULL AND created_at>?").bind(viewer, new Date(Date.parse(now) - 36e5).toISOString()).first())?.n ?? 0;
  if (pending >= 10) throw new AppError(429, "Send or remove your earlier attachments before adding more.");
  const reader = body.getReader(), head = [];
  let got = 0;
  while (got < 16) {
    const { value, done } = await reader.read();
    if (done) break;
    head.push(value);
    got += value.length;
  }
  const first = new Uint8Array(got);
  let off = 0;
  for (const c of head) {
    first.set(c, off);
    off += c.length;
  }
  const found = sniffMedia(first);
  if (!found) throw new AppError(415, "Upload a JPEG, PNG, GIF, WebP photo or an MP4, MOV or WebM video.");
  if (found.kind === "image" && length > CHAT_LIMITS.imageBytes) throw new AppError(413, "Photos can be up to 8 MB.");
  const mediaId = crypto.randomUUID(), key = `chat/${clubId}/${mediaId}`, fixed = new FixedLengthStream(length), writer = fixed.writable.getWriter();
  const pump = (async () => {
    try {
      for (const c of head) await writer.write(c);
      for (; ; ) {
        const { value, done } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
      await writer.close();
    } catch (e) {
      await writer.abort(e).catch(() => {
      });
      throw e;
    }
  })();
  try {
    await Promise.all([env.CHAT_MEDIA.put(key, fixed.readable, { httpMetadata: { contentType: found.contentType } }), pump]);
  } catch {
    await env.CHAT_MEDIA.delete(key).catch(() => {
    });
    throw new AppError(400, "The upload did not finish. Please try again.");
  }
  try {
    await env.DB.prepare("INSERT INTO chat_media(id,club_id,uploader_id,kind,content_type,bytes,r2_key,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(mediaId, clubId, viewer, found.kind, found.contentType, length, key, now).run();
  } catch (e) {
    await env.CHAT_MEDIA.delete(key).catch(() => {
    });
    throw e;
  }
  return { id: mediaId, kind: found.kind, contentType: found.contentType, bytes: length };
}
__name(uploadChatMedia, "uploadChatMedia");
function parseRange(header, size) {
  const m = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || !m[1] && !m[2]) return null;
  let start, end;
  if (!m[1]) {
    const n = Number(m[2]);
    if (!n) return "invalid";
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  if (start >= size || start > end) return "invalid";
  return { offset: start, length: end - start + 1 };
}
__name(parseRange, "parseRange");
async function serveChatMedia(env, viewer, mediaId, rangeHeader) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(mediaId)) throw new AppError(404, "Not found.");
  const m = await env.DB.prepare("SELECT cm.club_id,cm.r2_key,cm.content_type,cm.bytes,cm.attached_at,cm.uploader_id,msg.deleted_at FROM chat_media cm LEFT JOIN chat_messages msg ON msg.media_id=cm.id WHERE cm.id=?").bind(mediaId).first();
  if (!m || m.deleted_at || !m.attached_at && m.uploader_id !== viewer) throw new AppError(404, "Not found.");
  await chatAccess(env.DB, viewer, m.club_id);
  const range = parseRange(rangeHeader, m.bytes);
  if (range === "invalid") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${m.bytes}` } });
  const object = await env.CHAT_MEDIA.get(m.r2_key, range ? { range } : void 0);
  if (!object) throw new AppError(404, "Not found.");
  const headers = new Headers({ "Content-Type": m.content_type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'", ETag: object.httpEtag, "Content-Length": String(range ? range.length : m.bytes) });
  if (range) {
    headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${m.bytes}`);
    return new Response(object.body, { status: 206, headers });
  }
  return new Response(object.body, { headers });
}
__name(serveChatMedia, "serveChatMedia");

// ../../lib/chat-room.ts
import { DurableObject } from "cloudflare:workers";
var LIFETIME_MS = 15 * 60 * 1e3;
var ChatRoom = class extends DurableObject {
  static {
    __name(this, "ChatRoom");
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/publish" && request.method === "POST") {
      const event = await request.text(), now = Date.now(), online = /* @__PURE__ */ new Set();
      for (const ws of this.ctx.getWebSockets()) {
        const meta = ws.deserializeAttachment();
        if (!meta || meta.expires < now) {
          try {
            ws.close(4e3, "Reconnect");
          } catch {
          }
          continue;
        }
        try {
          ws.send(event);
          online.add(meta.playerId);
        } catch {
        }
      }
      return Response.json({ online: [...online] });
    }
    if (url.pathname === "/connect" && request.headers.get("Upgrade") === "websocket") {
      const player = request.headers.get("x-chat-player");
      if (!player) return new Response("Forbidden", { status: 403 });
      const pair = new WebSocketPair(), [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ playerId: player, expires: Date.now() + LIFETIME_MS });
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("Not found", { status: 404 });
  }
  webSocketMessage(ws, message) {
    if (message === "ping") ws.send("pong");
  }
  webSocketClose(ws, code) {
    try {
      ws.close(code === 1005 ? 1e3 : code);
    } catch {
    }
  }
};

// worker.ts
var media = /* @__PURE__ */ new Map();
var fakeDb = { prepare(sql) {
  let args = [];
  const stmt = {
    bind(...a) {
      args = a;
      return stmt;
    },
    async first() {
      if (sql.includes("FROM memberships")) return { role: "member", muted: 0 };
      if (sql.includes("count(*)")) return { n: 0 };
      if (sql.includes("FROM chat_media cm")) return media.get(String(args[0])) ?? null;
      return null;
    },
    async run() {
      if (sql.startsWith("INSERT INTO chat_media")) {
        const [id, club, uploader, kind, type, bytes, key, at] = args;
        media.set(String(id), { club_id: club, r2_key: key, content_type: type, bytes, attached_at: at, uploader_id: uploader, deleted_at: null });
      }
      return { success: true };
    }
  };
  return stmt;
} };
var worker_default = { async fetch(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/upload") try {
    return Response.json(await uploadChatMedia({ DB: fakeDb, CHAT_MEDIA: env.CHAT_MEDIA }, "p1", "club1", request));
  } catch (e) {
    return Response.json({ error: e.message, status: e.status }, { status: e.status ?? 500 });
  }
  if (url.pathname.startsWith("/media/")) try {
    return await serveChatMedia({ DB: fakeDb, CHAT_MEDIA: env.CHAT_MEDIA }, "p1", url.pathname.slice(7), request.headers.get("range"));
  } catch (e) {
    return new Response(e.message, { status: e.status ?? 500 });
  }
  const room = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(url.searchParams.get("club") ?? "a"));
  const h = new Headers(request.headers), p = url.searchParams.get("player");
  if (p) h.set("x-chat-player", p);
  return room.fetch(new Request("https://room" + url.pathname, { method: request.method, headers: h, body: request.method === "POST" ? request.body : void 0 }));
} };

// ../../node_modules/.pnpm/wrangler@4.92.0_@cloudflare_63341bf59f3b888ceb88c3c39f548cc1/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../node_modules/.pnpm/wrangler@4.92.0_@cloudflare_63341bf59f3b888ceb88c3c39f548cc1/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-HRlQbD/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../node_modules/.pnpm/wrangler@4.92.0_@cloudflare_63341bf59f3b888ceb88c3c39f548cc1/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-HRlQbD/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  ChatRoom,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
