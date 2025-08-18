import {
  message,
  textEntity$Input,
  textEntityTypeBankCardNumber,
  textEntityTypeBotCommand,
  textEntityTypeCashtag,
  textEntityTypeCustomEmoji,
  textEntityTypeEmailAddress,
  textEntityTypeHashtag,
  textEntityTypeMediaTimestamp,
  textEntityTypeMention,
  textEntityTypeMentionName,
  textEntityTypePhoneNumber,
  textEntityTypeTextUrl,
  textEntityTypeUrl,
} from "tdlib-types";
import { ClusterName, ClusterSummary } from "../ai/prompts/allInOne";
import path from "path";
import fs from "fs";
import { logger } from "./logger";

export type Post = {
  id: number;
  text: string;
  entities?: Array<Entity>;
};

export type SheduledPost = {
  cluster: string;
  targetChatId: number;
  text: string;
  entities?: Array<textEntity$Input>;
  voiceFile?: string;
  photoFile?: string;
  date: number;
};

export type PostCluster = {
  [key: string]: Array<number>;
};

export type ManagableEntities =
  | textEntityTypeMention
  | textEntityTypeHashtag
  | textEntityTypeCashtag
  | textEntityTypeBotCommand
  | textEntityTypeUrl
  | textEntityTypeEmailAddress
  | textEntityTypePhoneNumber
  | textEntityTypeBankCardNumber
  | textEntityTypeTextUrl
  | textEntityTypeMentionName
  | textEntityTypeCustomEmoji;

const managableEntities = [
  "textEntityTypeMention",
  "textEntityTypeHashtag",
  "textEntityTypeCashtag",
  "textEntityTypeBotCommand",
  "textEntityTypeUrl",
  "textEntityTypeEmailAddress",
  "textEntityTypePhoneNumber",
  "textEntityTypeBankCardNumber",
  "textEntityTypeTextUrl",
  "textEntityTypeMentionName",
  "textEntityTypeCustomEmoji",
];

export type Entity = {
  text: string;
  type: ManagableEntities;
};

export function mapMessageToPost(message: message): Post | undefined {
  let text: string | undefined = undefined;
  let entities: Array<Entity> | undefined = undefined;
  if (message.content._ === "messageText") {
    text = message.content.text.text;
    entities = message.content.text.entities
      .filter((entity) => managableEntities.includes(entity.type._))
      .map(
        (entity) =>
          ({
            type: entity.type,
            text: text!.substring(entity.offset, entity.offset + entity.length),
          } as Entity)
      );
  }
  if (
    message.content._ === "messagePhoto" ||
    message.content._ === "messageVideo"
  ) {
    text = message.content.caption.text;
    entities = message.content.caption.entities
      .filter((entity) => managableEntities.includes(entity.type._))
      .map(
        (entity) =>
          ({
            type: entity.type,
            text: text!.substring(entity.offset, entity.offset + entity.length),
          } as Entity)
      );
  }
  if (text !== undefined) {
    return {
      id: message.id,
      text,
      entities: entities?.filter(
        (entity) =>
          !entities.some(
            (e) => e.text === entity.text && e.type._ === entity.type._
          )
      ),
    };
  }
  return undefined;
}

enum ClusterLinks {
  "Политика" = "https://t.me/hour_politics",
  "Экономика" = "https://t.me/hour_economy",
  "Крипта" = "https://t.me/hour_cryptocurrency",
  "Технологии" = "https://t.me/hour_tech",
  "Отношения и психология" = "https://t.me/hour_psychology",
  "Наука и космос" = "https://t.me/hour_science",
  "AI и нейросети" = "https://t.me/hour_ai",
}

enum ClusterSuffix {
  "Политика" = "о политике",
  "Экономика" = "об экономике",
  "Крипта" = "о крипте",
  "Технологии" = "о технологиях",
  "Отношения и психология" = "об отношениях и психологии",
  "Наука и космос" = "о науке и космосе",
  "AI и нейросети" = "об ИИ и нейросетях",
}

export function appendClusterPostSuffix(
  cluster: ClusterName,
  text: string,
  entities: Array<textEntity$Input>
) {
  const link = ClusterLinks[cluster];
  if (!link) {
    return text;
  }
  const suffix = `📢 Каждый час ${ClusterSuffix[cluster]}`;
  text = `${text}\n\n${suffix}`;
  entities.push({
    _: "textEntity",
    offset: text.indexOf(suffix),
    length: suffix.length,
    type: {
      _: "textEntityTypeTextUrl",
      url: link,
    },
  });
  return text;
}

const historyDir = path.join(
  path.dirname(require.main?.filename ?? __filename),
  "../db"
);
const historyFile = path.join(historyDir, "history.json");

export type ClusterHistory = {
  topic: ClusterName;
  news: Array<string>;
};

export function saveClusterHistory(summaryClusters: ClusterSummary) {
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }
  const history: Array<ClusterHistory> = Object.entries(summaryClusters).map(([cluster, summary]) => ({
    topic: cluster as ClusterName,
    news: summary.map((s) => s.summary_detailed),
  }));
  fs.writeFileSync(historyFile, JSON.stringify(history));
}

export function loadClusterHistory(): Array<ClusterHistory> {
  try {
    const file = fs.readFileSync(historyFile);
    if (file.length) {
      return JSON.parse(file.toString());
    }
  } catch (error) {
    logger.error("Could not load history file", error);
  }
  return [];
}
