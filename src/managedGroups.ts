import { logger } from "./logger";
import { client } from ".";
import { config } from "./configuration";
import { askAI } from "./ai";
import { systemPrompt } from "./ai/prompts";

export interface Group {
  folderId: number;
  targetChatId?: number;
  sourceChatIds: Array<number>;
}

interface Post {
  text: string;
  video?: boolean;
  photo?: boolean;
}

interface GroupWithNews {
  title: string;
  posts: Array<Post>;
}

export const managedGroups: Array<Group> = [];

const interval = setInterval(() => {
  logger.info('Managed groups state: %s', JSON.stringify(managedGroups));
  managedGroups.forEach(async group => {
    if (!group.targetChatId) {
      logger.info("Target chat no specified for group %d", group.folderId);
      return;
    }

    const unreadMessages = await gatherUnreadMessages(group.folderId, config.postCount);

    if (unreadMessages.flatMap(gr => gr.posts).length === 0) {
      logger.info('No new messages for group %s', group.folderId);
      return;
    }

    const aiAnswer = await askAI(systemPrompt, JSON.stringify(unreadMessages));

    if (!aiAnswer) {
      logger.error('Empty answer from ai for group %d', group.folderId);
      return;
    }
    if (config.postDebug) {
      logger.info('Ai answer for group %d: %s', group.folderId, aiAnswer);
    } else {
      await client.invoke({
        _: 'sendMessage',
        chat_id: group.targetChatId,
        input_message_content: {
          _: 'inputMessageText',
          text: {
            _: 'formattedText',
            text: aiAnswer,
          }
        }
      });
    }
    
  });
}, config.postInterval);

export async function gatherUnreadMessages(folderId: number, limitPerChat?: number): Promise<Array<GroupWithNews>> {
  const group = managedGroups.find(g => g.folderId === folderId);
  if (!group) {
    return Promise.reject(`Folder with id=${folderId} not found`);
  }

  return await Promise.all([
    ...group.sourceChatIds.map(chatId => client.invoke({
      _: 'getChat',
      chat_id: chatId,
    }).then(chat => {
      return client.invoke({
        _: 'getChatHistory',
        chat_id: chat.id,
        from_message_id: chat.last_read_inbox_message_id,
        offset: -(limitPerChat ?? 2),
        limit: limitPerChat ?? 2,
      }).then(messages => {
        const arr = messages.messages.filter(msg => !!msg?.id && msg.id !== chat.last_read_inbox_message_id);

        const posts = arr.map((msg) => {
          if (msg?.content._ === 'messageText') {
            return {text: msg.content.text.text};
          }
          if (msg?.content._ === 'messagePhoto') {
            return {text: msg.content.caption.text, photo: true};
          }
          if (msg?.content._ === 'messageVideo') {
            return {text: msg.content.caption.text, video: true};
          }
          return undefined;

        }).filter(post => post !== undefined);
        
        return client.invoke({
          _: 'viewMessages',
          chat_id: chat.id,
          message_ids: arr.map(msg => msg?.id).filter(id => id != undefined),
          force_read: true,
        }).then(() => ({title: chat.title, posts}));
      })
    })
    )
  ]);
  
}