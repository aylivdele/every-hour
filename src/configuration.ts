import dotenv from "dotenv";

interface Config {
  tdDatabaseDir?: string;
  tdFilesDir?: string;
  tgApiId: number;
  tgApiHash: string;
  tgPhoneNumber: string;
  tgPhoneCode?: string;
  logDir?: string;
  tgPassword?: string;
}

export let config: Config;

export function reloadConfig() {
  dotenv.config({override: true});
  const tgApiId = process.env.TG_API_ID;
  const tgApiHash = process.env.TG_API_HASH;
  const tgPhoneNumber = process.env.TG_PHONE_NUMBER;

  const tdDatabaseDir = process.env.TD_DATABASE_DIR;
  const tdFilesDir = process.env.TD_FILES_DIR;
  const tgPhoneCode = process.env.TG_PHONE_CODE;
  const tgPassword = process.env.TG_PASSWORD;
  const logDir = process.env.LOG_DIR;

  if (!tgApiId || !tgApiHash) {
    throw new Error("Api parameters not found");
  }

  if (!tgPhoneNumber) {
    throw new Error("Phone number not found");
  }
  
  config = {
    tdDatabaseDir,
    tdFilesDir,
    tgApiId: Number.parseInt(tgApiId),
    tgApiHash,
    tgPhoneNumber,
    tgPhoneCode,
    tgPassword,
    logDir
  }
}

reloadConfig();