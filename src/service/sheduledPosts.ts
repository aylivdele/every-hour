import { client } from "..";
import { logger } from "../utils/logger";
import { SheduledPost } from "../utils/post";
import { InputMessageContent$Input } from "tdlib-types";

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
