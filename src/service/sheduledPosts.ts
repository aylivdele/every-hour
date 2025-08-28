import { client } from "..";
import { tts } from "../ai";
import { ClusterName, ClusterSummary } from "../ai/prompts/allInOne";
import {
  renderPostImage,
  Cluster,
  writePhotoFile,
  clearPhotoDir,
} from "../canvas/canvas";
import { config } from "../configuration";
import { addDot } from "../utils/addDot";
import {
  getDateTitleIntervalString,
  getLocaleTimeIntervalString,
  toMskOffset,
} from "../utils/date";
import { logger } from "../utils/logger";
import { mapCluster } from "../utils/mappers";
import { appendClusterPostSuffix, Post, SheduledPost } from "../utils/post";
import {
  InputMessageContent$Input,
  message,
  textEntity$Input,
} from "tdlib-types";
import { clearVoiceDir, writeVoiceFile } from "../utils/voice";

function sendPhoto(post: SheduledPost): Promise<any> {
  if (!post.photoFile) {
    return Promise.resolve();
  }
  return client.invoke({
    _: "sendMessage",
    chat_id: post.targetChatId,
    input_message_content: {
      _: "inputMessagePhoto",
      caption: post.voiceFile
        ? undefined
        : {
            _: "formattedText",
            text: post.text,
            entities: post.entities || undefined,
          },
      photo: {
        _: "inputFileLocal",
        path: post.photoFile,
      },
    },
  });
}

function sendVoice(post: SheduledPost): Promise<any> {
  if (!post.voiceFile) {
    return Promise.resolve();
  }
  return client.invoke({
    _: "sendMessage",
    chat_id: post.targetChatId,
    input_message_content: {
      _: "inputMessageVoiceNote",
      caption: {
        _: "formattedText",
        text: post.text,
        entities: post.entities || undefined,
      },
      voice_note: {
        _: "inputFileLocal",
        path: post.voiceFile,
      },
    },
  });
}

function sendText(post: SheduledPost): Promise<any> {
  if (post.voiceFile || post.photoFile) {
    return Promise.resolve();
  }
  return client.invoke({
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
}

export function shedulePost(post: SheduledPost) {
  setTimeout(async () => {
    try {
      logger.info(
        "Sending sheduled message for %s to %d",
        post.cluster,
        post.targetChatId
      );
      await sendPhoto(post)
        .then(() => sendVoice(post))
        .then(() => sendText(post));
    } catch (reason) {
      logger.error(
        "Could not post sheduled message for %s",
        post.cluster,
        reason
      );
    }
  }, post.date - Date.now());
}

export async function prepareAndShedule({
  summaryClusters,
  fromDateSeconds,
  messages,
  currentDate,
  publishDate,
}: {
  summaryClusters: ClusterSummary;
  fromDateSeconds: number;
  messages: Post[];
  currentDate: Date;
  publishDate: Date;
}) {
  clearVoiceDir();
  clearPhotoDir();
  const keys = Object.keys(summaryClusters) as ClusterName[];
  for (let k = 0; k < keys.length; k++) {
    const key: ClusterName = keys[k];
    try {
      const targetChatId = config.targetChats[key];
      if (targetChatId === undefined) {
        logger.warn('Target chat for "%s" not specified', key);
        continue;
      }
      const summaryArr = summaryClusters[key];
      if (!summaryArr || summaryArr.length === 0) {
        continue;
      }

      let fromDate = toMskOffset(
        new Date(fromDateSeconds * 1000 + 1000 * 60 * 5)
      );

      let text = summaryArr
        .map(
          (summary) =>
            `${summary.emoji} ${addDot(summary.summary_short)}\n${addDot(
              summary.summary_detailed
            )}`
        )
        .join("\n\n");

      const entities: Array<textEntity$Input> = summaryArr.flatMap(({ id }) => {
        const post = messages.find((message) => message.id === id);
        return (
          post?.entities?.reduce((acc: Array<textEntity$Input>, entity) => {
            let index;
            let offset = 0;
            while ((index = text.indexOf(entity.text, offset)) > -1) {
              acc.push({
                _: "textEntity",
                offset: index,
                length: entity.text.length,
                type: entity.type,
              });
              offset = index + entity.text.length;
            }
            return acc;
          }, []) ?? []
        );
      });

      text = appendClusterPostSuffix(key, text, entities);

      entities.push(
        ...summaryArr
          .map((summary) => {
            const start = text.indexOf(summary.summary_short);
            if (start < 0) {
              return undefined;
            }
            return {
              _: "textEntity",
              offset: start,
              length: summary.summary_short.length,
              type: { _: "textEntityTypeBold" },
            } as textEntity$Input;
          })
          .filter((entity) => entity !== undefined)
      );

      let voiceFile: string | undefined = undefined;
      let photoFile: string | undefined = undefined;
      if (summaryArr.length) {
        const ttsText =
          `Главное в ${mapCluster(key)} за ${getDateTitleIntervalString(
            fromDate,
            currentDate
          )} ${getLocaleTimeIntervalString(
            fromDate,
            currentDate
          )}\nsil<[800]>` +
          summaryArr
            .map((summary) => addDot(summary.summary_tts))
            .join("\n\nsil<[1000]> Далее: ");
        const voice = await tts(ttsText);
        const fileName = `${Date.now()}.ogg`;
        logger.info(`${key} => ${fileName}`);
        voiceFile = writeVoiceFile(voice, fileName);

        const photo = await renderPostImage({
          cluster: Cluster[key as keyof typeof Cluster],
          summary: summaryArr,
          fromDate,
          toDate: currentDate,
        });
        const photoName = `${Date.now()}.png`;
        logger.info(`${key} => ${photoName}`);
        photoFile = writePhotoFile(photo, photoName);
      }

      shedulePost({
        cluster: key,
        targetChatId,
        text,
        entities,
        voiceFile,
        photoFile,
        date: publishDate.getTime(),
      });
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
              text: `Ошибка оформления поста для ${key}: ${error}`,
            },
          },
        });
      }
    }
  }
}
