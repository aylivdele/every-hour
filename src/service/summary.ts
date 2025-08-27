import { logger } from "../utils/logger";
import { client } from "..";
import { config } from "../configuration";
import { askAI, tts } from "../ai";
import fs from "fs";
import path from "path";
import { message, textEntity$Input } from "tdlib-types";
import { CheckRequest } from "../ai/prompts";
import {
  getDateIntervalString,
  getNumberString,
  toMskOffset,
} from "../utils/date";
import {
  loadClusterHistory,
  mapMessageToPost,
  Post,
  PostCluster,
  saveClusterHistory,
  SheduledPost,
} from "../utils/post";
import { parseJsonAnswer } from "../utils/json";
import { clusterPrompt } from "../ai/prompts/cluster";
import { dedublicationPrompt } from "../ai/prompts/deduplication";
import { summaryPrompt } from "../ai/prompts/summary";
import { ClusterName, ClusterSummary, Summary } from "../ai/prompts/allInOne";

import {
  archiveStatistics,
  logStatistics,
  updateClusterStatistics,
} from "../statistics";
import { isEmpty } from "../utils/isEmpty";
import { instructionsNews } from "../ai/prompts/tts";
import { clearVoiceDir, writeVoiceFile } from "../utils/voice";
import { timeout } from "../utils/timeout";
import { clearPhotoDir } from "../canvas/canvas";

export interface Group {
  id: number;
  title: string;
}

export const managedGroups: Array<Group> = [];

export const postSummary = async (
  force?: boolean,
  fromDate?: number,
  toDate?: number
) => {
  try {
    logger.info("Managed groups state: %s", JSON.stringify(managedGroups));

    const fiveMinutes = 1000 * 60 * 5;
    const startDate = new Date(force ? toDate ?? Date.now() : Date.now());
    const currentDate = toMskOffset(startDate);
    currentDate.setTime(currentDate.getTime() + fiveMinutes);

    const publishDate = new Date(startDate);
    publishDate.setHours(publishDate.getHours() + 1, 0, 1, 1);

    let postInterval = config.postInterval;
    let maxCountOfNews = 5;
    let isLastForToday = false;

    if (!force) {
      if (currentDate.getHours() > 22 || currentDate.getHours() < 8) {
        logger.info("Skipping posting for a night");
        return;
      } else if (currentDate.getHours() === 8) {
        postInterval = 60 * 60 * 1000 * 9;
        maxCountOfNews = 8;
      } else if (currentDate.getHours() === 22) {
        isLastForToday = true;
      }
    }
    const from = startDate.getTime() - postInterval;
    let fromDateSeconds = Math.floor((force ? fromDate ?? from : from) / 1000);

    logger.info(
      "From date: %d, to date: %d",
      fromDateSeconds * 1000,
      startDate.getTime()
    );

    const messages = await Promise.all(
      managedGroups.flatMap(async (group) => {
        if (!group.title.startsWith(config.parseFolderPrefix)) {
          return [];
        }
        const unreadMessages = await gatherUnreadMessages(
          fromDateSeconds,
          group.id,
          config.postCount,
          toDate ? Math.floor(toDate / 1000) : undefined
        );
        if (process.env.TEST) {
          fs.writeFileSync(
            path.resolve(process.cwd(), `posts_${group.id}.json`),
            JSON.stringify(unreadMessages)
          );
        }

        return unreadMessages;
      })
    ).then((result) => result.flat());

    let aiAnswer = await askAI(
      clusterPrompt,
      JSON.stringify(
        messages.map((message) => ({ id: message.id, text: message.text }))
      ),
      !force
    );

    logger.info("Clusterization AI answer: %s", aiAnswer);
    if (!aiAnswer) {
      throw new Error("Empty answer from ai for clusterization");
    }
    let clusters: PostCluster = parseJsonAnswer(aiAnswer);
    const clustersWithText: CheckRequest = Object.fromEntries(
      Object.entries(clusters).map((entry) => {
        const posts = entry[1]
          .map((id) => messages.find((message) => message.id === id))
          .filter((message) => !!message);
        return [entry[0], posts];
      })
    );
    const clusterHistory = loadClusterHistory();

    const deduplicationAnswerRaw = await askAI(
      dedublicationPrompt,
      JSON.stringify({
        posts: clustersWithText,
        previous_posts: clusterHistory,
      }),
      !force
    );

    logger.info("Deduplication AI answer: %s", deduplicationAnswerRaw);
    if (!deduplicationAnswerRaw) {
      throw new Error("Empty answer from ai for dedublication");
    }
    const deduplicatedClusters: PostCluster = parseJsonAnswer(
      deduplicationAnswerRaw
    );

    const sheduledPosts: Array<SheduledPost> = [];

    fromDateSeconds = fromDateSeconds * 1000 + fiveMinutes;
    const clusterSummary: ClusterSummary = {};

    for (const key of (Object.keys(deduplicatedClusters)) as ClusterName[]) {
      try {
        const targetChatId = config.targetChats[key];
        if (targetChatId === undefined) {
          logger.warn('Target chat for "%s" not specified', key);
          continue;
        }
        // removeFromArray(clusters[key], checkResult!.notNews);
        // for (const dublicate of checkResult!.dublicates) {
        //   if (dublicate.length > 1) {
        //     removeFromArray(clusters[key], dublicate.slice(1))
        //   }
        // }
        const posts = messages
          .filter((msg) => deduplicatedClusters[key].includes(msg.id))
          .map((message) => ({ id: message.id, text: message.text }));
        let summaryRaw = null;
        let success = false;
        let retries = 0;

        if (posts.length === 0) {
          continue;
        }

        while (!success && retries < 5) {
          if (retries > 0) {
            logger.info("Retrying summary request in 1 minute");
            await timeout(60 * 1000);
          }
          const { newSuccess, newSummaryRaw } = await askAI(
            summaryPrompt(maxCountOfNews),
            JSON.stringify(posts),
            !force
          )
            .then((answer) => ({ newSummaryRaw: answer, newSuccess: true }))
            .catch(async (reason) => {
              logger.error("Error on summary ai request", reason);
              return { newSummaryRaw: null, newSuccess: false };
            })
            .finally(() => retries++);
          success = newSuccess;
          summaryRaw = newSummaryRaw;
          logger.info("Summary AI answer: %s", summaryRaw);
        }

        if (!summaryRaw) {
          throw new Error("Empty answer from ai for summary");
        }
        const summaryArr: Array<Summary> = parseJsonAnswer(summaryRaw).filter(
          (sum: Summary) =>
            !isEmpty(sum.summary_detailed) && !isEmpty(sum.summary_short)
        );

        if (!summaryArr.length) {
          throw new Error("Empty summary array for cluster " + key);
        }
        clusterSummary[key] = summaryArr;
      } catch (error) {
        logger.error(`Error for ${key} cluster`, error);
        if (config.debugChatId) {
          await client.invoke({
            _: "sendMessage",
            chat_id: config.debugChatId,
            message_thread_id: config.debugThreadId,
            input_message_content: {
              _: "inputMessageText",
              text: {
                _: "formattedText",
                text: `Ошибка создания выжимки для ${key}: ${error}`,
              },
            },
          });
        }
      }
    }
      clearVoiceDir();
      clearPhotoDir();

      saveClusterHistory(clusterSummary);

    setTimeout(
      async () => {
        for (const post of sheduledPosts) {
          try {
            logger.info("Sending sheduled post to " + post.targetChatId);
            await client.invoke({
              _: "sendMessage",
              chat_id: post.targetChatId,
              input_message_content: {
                _: "inputMessageText",
                text: {
                  _: "formattedText",
                  text: post.text,
                  entities: post.entities || undefined,
                },
              },
            });
          } catch (reason) {
            logger.error(
              "Could not post sheduled message for %s",
              post.cluster,
              reason
            );
          }
        }
      },
      force ? 0 : publishDate.getTime() - Date.now()
    );

    if (config.debugChatId && !force) {
      await client.invoke({
        _: "sendMessage",
        chat_id: config.debugChatId,
        message_thread_id: config.debugThreadId,
        input_message_content: {
          _: "inputMessageText",
          text: {
            _: "formattedText",
            text: `Собрано ${messages.length} постов;

Результат кластеризации: ${Object.entries(clusters)
              .map(([cluster, posts]) => `${cluster}: ${posts.length}`)
              .join(", ")};

Результат дедупликации: ${Object.entries(deduplicatedClusters)
              .map(([cluster, posts]) => `${cluster}: ${posts.length}`)
              .join(", ")};

Результат выжимки(кол-во новостей): ${Object.entries(clusterSummary)
              .map(([cluster, posts]) => `${cluster}: ${posts}`)
              .join(", ")};

Запланирована отправка выжимки для ${sheduledPosts.length} каналов через ${
              (publishDate.getTime() - Date.now()) / 1000
            } секунд.`,
          },
        },
      });
    }
    if (!force) {
      const statistics = updateClusterStatistics(clusterSummary, 1);
      if (isLastForToday) {
        await logStatistics(statistics);
        archiveStatistics();
      }
    }
  } catch (error) {
    logger.error("PostSummary error: ", error);
    if (config.debugChatId) {
      await client.invoke({
        _: "sendMessage",
        chat_id: config.debugChatId,
        message_thread_id: config.debugThreadId,
        input_message_content: {
          _: "inputMessageText",
          text: {
            _: "formattedText",
            text: `Критическая ошибка: ${error}`,
          },
        },
      });
    }
    throw error;
  }
};

async function loadChatHistory(
  chatId: number,
  fromDate: number,
  limitPerChat: number = 10,
  toDate?: number
) {
  // await client.invoke({
  //   _: 'openChat',
  //   chat_id: chatId
  // });

  const arr: Array<message> = [];
  let offset = 0;
  let reachedDate = false;
  let lastMessage: message | undefined;

  while (arr.length < limitPerChat) {
    const messages = await client
      .invoke({
        _: "getChatHistory",
        chat_id: chatId,
        from_message_id: lastMessage?.id ?? 0,
        limit: limitPerChat - arr.length,
        offset: 0,
      })
      .then((messages) => {
        return messages.messages.filter((msg) => !!msg?.id);
      });

    for (const msg of messages) {
      if (!!msg?.id) {
        if (msg.date > fromDate && (!toDate || toDate > msg.date)) {
          if (!arr.some((am) => am.id === msg.id)) {
            arr.push(msg);
          }
        } else {
          if (msg.date <= fromDate) {
            reachedDate = true;
          }
        }
      }
      if (
        !lastMessage ||
        msg!.date < (lastMessage?.date || Number.MAX_SAFE_INTEGER) ||
        msg!.id < lastMessage?.id
      ) {
        lastMessage = msg!;
      }
    }
    if (reachedDate) {
      break;
    }
  }

  const posts: Array<Post> = arr
    .map(mapMessageToPost)
    .filter((post) => post !== undefined);

  await client.invoke({
    _: "viewMessages",
    chat_id: chatId,
    message_ids: arr.map((msg) => msg?.id).filter((id) => id != undefined),
    source: {
      _: "messageSourceChatHistory",
    },
    force_read: true,
  });

  return posts;
}

export async function gatherUnreadMessages(
  fromDate: number,
  folderId: number,
  limitPerChat?: number,
  toDate?: number
): Promise<Post[]> {
  const chats = await client
    .invoke({
      _: "getChats",
      chat_list: {
        _: "chatListFolder",
        chat_folder_id: folderId,
      },
      limit: 50,
    })
    .then((chats) => chats.chat_ids);

  if (!chats) {
    return Promise.reject(`Folder with id=${folderId} not found`);
  }

  const result: Array<Post> = [];

  for (const chat of chats) {
    result.push(
      ...(await loadChatHistory(chat, fromDate, limitPerChat, toDate))
    );
  }
  return result;
}
