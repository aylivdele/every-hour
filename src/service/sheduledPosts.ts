import { client } from "..";
import { subscribeToFileUpdate } from "../handlers/file";
import { logger } from "../utils/logger";
import { SheduledPost } from "../utils/post";

export function shedulePost(post: SheduledPost) {
    setTimeout(async () => {
        try {
            if (post.mp3) {

                logger.info('Sending voice file for sheduled post to ' + post.targetChatId);

                await client.invoke({
                    _: 'preliminaryUploadFile',
                    file_type: {
                        _: 'fileTypeVoiceNote',
                    },
                    priority: 1,
                    file: {
                        _: 'inputFileLocal',
                        path: post.mp3,
                    }
                });

                subscribeToFileUpdate((path, id) => {
                    if (path !== post.mp3) {
                        return false;
                    }

                    logger.info('Sending sheduled post with voice to ' + post.targetChatId);

                    client.invoke({
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
                                _: 'inputFileId',
                                id,
                            }
                        }
                    });
                    return true;
                });
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