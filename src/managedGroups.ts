import { group } from "console";
import { logger } from "./logger";
import { client } from ".";

export interface Group {
  folderId: number;
  targetChatId?: number;
  sourceChatIds: Array<number>;
}

export const managedGroups: Array<Group> = [];

const interval = setInterval(() => {
  logger.info('Managed groups state: %s', JSON.stringify(managedGroups));
  managedGroups.forEach(async group => await gatherUnreadMessages(group.folderId, 3));
}, 10000);

export async function gatherUnreadMessages(folderId: number, limitPerChat?: number) {
  logger.info('gatherUnreadMessages start');
  const group = managedGroups.find(g => g.folderId === folderId);
  if (!group) {
    logger.info('gatherUnreadMessages error');

    return Promise.reject(`Folder with id=${folderId} not found`);
  }

  if (!group.targetChatId) {
    return Promise.resolve();
  }
  logger.info('gatherUnreadMessages %s', JSON.stringify(group.sourceChatIds));

  try {
    return await Promise.all([
      ...group.sourceChatIds.map(chatId => client.invoke({
        _: 'getChat',
        chat_id: chatId,
      }).then(chat => {
        logger.info('Chat id: %s, lastRead: %s', chat.id, chat.last_read_inbox_message_id)
        return client.invoke({
          _: 'getChatHistory',
          chat_id: chat.id,
          from_message_id: chat.last_read_inbox_message_id,
          offset: -(limitPerChat ?? 2),
          limit: limitPerChat ?? 2,
        }).then(messages => {
          const arr = messages.messages.filter(msg => !!msg?.id && msg.id !== chat.last_read_inbox_message_id);

          const text = arr.reduce((result, msg) => {
            if (msg?.content._ === 'messageText') {
              return `${result}\n[id:${msg.id} text:${msg.content.text.text.substring(0, 20)}...]`;
            }
            if (msg?.content._ === 'messagePhoto' || msg?.content._ === 'messageVideo') {
              return `${result}\n[id:${msg.id} text:${msg.content.caption.text.substring(0, 20)}...]`;
            }
            return `${result}\n[id:${msg?.id} content:${msg?.content._}]`;

          }, `Loaded messages for chat=${chat.title}(${chat.id}): `);
          logger.info(text);
          
          return client.invoke({
            _: 'viewMessages',
            chat_id: chat.id,
            message_ids: arr.map(msg => msg?.id).filter(id => id != undefined),
            force_read: true,
          });
        })
      })
      )
    ]);
  } finally {
    return logger.info('gatherUnreadMessages end');
  }
}