import { Redis } from "@upstash/redis";
import { createClient } from "redis";

const BOARD_KEY = "coffee-daily-board";
let redisUrlClient;

async function getStore() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = Redis.fromEnv();
    return {
      get: (key) => redis.get(key),
      set: (key, value) => redis.set(key, value)
    };
  }

  if (process.env.REDIS_URL) {
    if (!redisUrlClient) {
      redisUrlClient = createClient({ url: process.env.REDIS_URL });
      redisUrlClient.on("error", (error) => console.error("Redis error", error));
      await redisUrlClient.connect();
    } else if (!redisUrlClient.isOpen) {
      await redisUrlClient.connect();
    }

    return {
      get: async (key) => {
        const value = await redisUrlClient.get(key);
        return value ? JSON.parse(value) : null;
      },
      set: (key, value) => redisUrlClient.set(key, JSON.stringify(value))
    };
  }

  return null;
}

async function readBoard(store) {
  return (await store.get(BOARD_KEY)) ?? {};
}

export default async function handler(request, response) {
  const store = await getStore();

  if (!store) {
    response.status(503).json({ error: "Redis is not configured" });
    return;
  }

  if (request.method === "GET") {
    const board = await readBoard(store);
    response.status(200).json(board);
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { selectedKey, person, response: personResponse, result } = request.body ?? {};

  if (!selectedKey || (!person && !result)) {
    response.status(400).json({ error: "Missing selectedKey or payload" });
    return;
  }

  const board = await readBoard(store);
  const currentDay = board[selectedKey] ?? {};

  if (person) {
    const currentResponse = currentDay.responses?.[person];

    if (currentResponse?.saved) {
      response.status(409).json({ error: "Response is already saved" });
      return;
    }

    board[selectedKey] = {
      ...currentDay,
      responses: {
        ...currentDay.responses,
        [person]: {
          ...personResponse,
          saved: true
        }
      }
    };
  }

  if (result) {
    board[selectedKey] = {
      ...currentDay,
      ...board[selectedKey],
      result
    };
  }

  await store.set(BOARD_KEY, board);
  response.status(200).json(board);
}
