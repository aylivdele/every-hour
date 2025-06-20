import dotenv from "dotenv";
import path from "path";

interface Config {
  tdDatabaseDir?: string;
  tdFilesDir?: string;
  tgApiId: number;
  tgApiHash: string;
  tgPhoneNumber: string;
  tgPhoneCode?: string;
  logDir?: string;
  tgPassword?: string;
  networkToken: string;
  postInterval: number;
  postCount: number;
  postDebug: boolean;
}

export let config: Config;

export function reloadConfig() {
  const filePath = path.resolve(process.env.CONFIG_DIR ?? process.cwd(), '.env');
  dotenv.config({override: true, path: filePath});

  const tgApiId = process.env.TG_API_ID;
  const tgApiHash = process.env.TG_API_HASH;
  const tgPhoneNumber = process.env.TG_PHONE_NUMBER;
  const networkToken = process.env.AI_TOKEN;

  const tdDatabaseDir = process.env.TD_DATABASE_DIR;
  const tdFilesDir = process.env.TD_FILES_DIR;
  const tgPhoneCode = process.env.TG_PHONE_CODE;
  const tgPassword = process.env.TG_PASSWORD;
  const logDir = process.env.LOG_DIR;
  const postInterval = process.env.POST_INTERVAL;
  const postCount = process.env.POST_COUNT;
  const postDebug = process.env.POST_DEBUG;

  let postIntervalNumber: number = 3600000;
  let postCountNumber: number = 3;
  let postDebugBoolean: boolean = false;

  if (!tgApiId || !tgApiHash) {
    throw new Error("Api parameters not found");
  }

  if (!tgPhoneNumber) {
    throw new Error("Phone number not found");
  }

  if (!networkToken) {
    throw new Error("NN configuration not found");
  }

  if (postInterval) {
    postIntervalNumber = Number.parseInt(postInterval);
    if (Number.isNaN(postIntervalNumber)) {
      throw new Error("Post interval is NaN");
    }
  }

  if (postCount) {
    postCountNumber = Number.parseInt(postCount);
    if (Number.isNaN(postCountNumber)) {
      throw new Error("Post count is NaN");
    }
  }

  if (postDebug?.toLowerCase() === 'true') {
    postDebugBoolean = true;
  }
  
  config = {
    tdDatabaseDir,
    tdFilesDir,
    tgApiId: Number.parseInt(tgApiId),
    tgApiHash,
    tgPhoneNumber,
    tgPhoneCode,
    tgPassword,
    logDir,
    networkToken,
    postInterval: postIntervalNumber,
    postCount: postCountNumber,
    postDebug: postDebugBoolean
  }
}

reloadConfig();