import { error } from "console";
import { client } from "..";
import { subscribeToFileUpdate } from "../handlers/file";
import { logger } from "../utils/logger";
import { SheduledPost } from "../utils/post";

export function shedulePost(post: SheduledPost) {
    setTimeout(async () => {
        try {
            if (post.voiceFile) {

                logger.info('Sending sheduled post with voice to ' + post.targetChatId);

                await client.invoke({
                    _: 'sendMessage',
                    chat_id: post.targetChatId,
                    input_message_content: {
                        _: 'inputMessageVoiceNote',
                        caption: {
                            _: 'formattedText',
                            text: post.text,
                            entities: post.entities || undefined
                        },
                        voice_note: {
                            _: 'inputFileLocal',
                            path: post.voiceFile,
                        }
                    }
                })
            } else {
                logger.info('Sending sheduled post to ' + post.targetChatId);
                await client.invoke({
                    _: 'sendMessage',
                    chat_id: post.targetChatId,
                    input_message_content: {
                    _: 'inputMessageText',
                    text: {
                        _: 'formattedText',
                        text: post.text,
                        entities: post.entities || undefined
                    }
                    }
                });
            }
        } catch (reason) {
            logger.error('Could not post sheduled message for %s', post.cluster, reason);
        }
    }, post.date - Date.now())
}