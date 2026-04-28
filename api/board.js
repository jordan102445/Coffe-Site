import { Redis } from "@upstash/redis";

const BOARD_KEY = "coffee-daily-board";

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  return Redis.fromEnv();
}

async function readBoard(redis) {
  return (await redis.get(BOARD_KEY)) ?? {};
}

export default async function handler(request, response) {
  const redis = getRedis();

  if (!redis) {
    response.status(503).json({ error: "Redis is not configured" });
    return;
  }

  if (request.method === "GET") {
    const board = await readBoard(redis);
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

  const board = await readBoard(redis);
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

  await redis.set(BOARD_KEY, board);
  response.status(200).json(board);
}
