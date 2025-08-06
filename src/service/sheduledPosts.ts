import { error } from "console";
import { client } from "..";
import { subscribeToFileUpdate } from "../handlers/file";
import { logger } from "../utils/logger";
import { SheduledPost } from "../utils/post";
import { InputMessageContent$Input } from "tdlib-types";

export function shedulePost(post: SheduledPost) {
    setTimeout(async () => {
        try {
            let messageContent: InputMessageContent$Input;
            if (post.photoFile) {
                messageContent = {
                _: "inputMessagePhoto",
                caption: {
                  _: "formattedText",
                  text: post.text,
                  entities: post.entities || undefined,
                },
                photo: {
                  _: "inputFileLocal",
                  path: post.photoFile,
                },
              };
            } else {
                messageContent = {
                  _: "inputMessageText",
                  text: {
                    _: "formattedText",
                    text: post.text,
                    entities: post.entities || undefined,
                  },
                };
            }
            await client.invoke({
              _: "sendMessage",
              chat_id: post.targetChatId,
              input_message_content: messageContent,
            });

            if (post.voiceFile) {
                logger.info('Sending sheduled voice to ' + post.targetChatId);

                await client.invoke({
                    _: 'sendMessage',
                    chat_id: post.targetChatId,
                    input_message_content: {
                        _: 'inputMessageVoiceNote',
                        voice_note: {
                            _: 'inputFileLocal',
                            path: post.voiceFile,
                        }
                    }
                });
            }
        } catch (reason) {
            logger.error('Could not post sheduled message for %s', post.cluster, reason);
        }
    }, post.date - Date.now())
}