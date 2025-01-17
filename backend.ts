import {Hono} from "https://deno.land/x/hono@v3.9.2/hono.ts";
import {uuid} from "./utils/uuid.ts";
import {UUID} from "./types/brand";

const rooms:{[key:UUID]:{
  playlist: string[],
  handlers: (val:unknown)=>void[],
  owner: UUID;
}} = {};

const broadcastPlaylistUpdate = (roomId: UUID) => {
  const room = rooms[roomId];
  if (room === undefined) return;
  room.handlers.forEach((h) => h(room.playlist));
}

const setupBackend = (app: Hono) => {
  app.get("/api/v1/api/room/:id/ws", (c) => {
    const roomId = c.req.param("id");
    if (rooms[roomId] === undefined) {
      return c.text("Room not found", 404);
    }
    const { response, socket } = Deno.upgradeWebSocket(c.req);
    
    socket.addEventListener("message", (e) => console.log(e));
    const handler = (val) => socket.send(JSON.stringify(val));
    rooms[roomId].handlers.push(handler);
    socket.onclose = () => {
      rooms[roomId].handlers = rooms[roomId].handlers.filter((s) => s !== handler);
    }
    return response;
  });
  app.post("/api/v1/api/create",(c)=>{
    const session = c.get('session');
    const roomId = uuid();
    session.id ??= uuid();
    rooms[roomId] = {
      handlers: [],
      owner: session.id
    };
    return c.json({
      roomId
    });
  });
  app.post("/api/v1/room/:id/add",async(c)=>{
    const body = await c.req.json<{url: string}>()
    const roomId = c.req.param("id");
    const room = rooms[roomId];
    const session = c.get('session');
    session.id ??= uuid();
    if (room === undefined) {
      return c.text("Room not found", 404);
    }
    room.playlist.push(body.url);
    broadcastPlaylistUpdate(roomId);
    return c.text("OK");
  })
}

export {setupBackend}