import { message, textEntity$Input, textEntityTypeBankCardNumber, textEntityTypeBotCommand, textEntityTypeCashtag, textEntityTypeCustomEmoji, textEntityTypeEmailAddress, textEntityTypeHashtag, textEntityTypeMediaTimestamp, textEntityTypeMention, textEntityTypeMentionName, textEntityTypePhoneNumber, textEntityTypeTextUrl, textEntityTypeUrl } from "tdlib-types";

export type Post = {
    id: number;
    text: string;
    entities?: Array<Entity>;
}

export type SheduledPost = {
    cluster: string;
    targetChatId: number;
    text: string;
    entities?: Array<textEntity$Input>;
    voiceFile?: string;
    date: number;
}

export type PostCluster = {
    [key: string]: Array<number>;
}

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
    'textEntityTypeMention',
    'textEntityTypeHashtag',
    'textEntityTypeCashtag',
    'textEntityTypeBotCommand',
    'textEntityTypeUrl',
    'textEntityTypeEmailAddress',
    'textEntityTypePhoneNumber',
    'textEntityTypeBankCardNumber',
    'textEntityTypeTextUrl',
    'textEntityTypeMentionName',
    'textEntityTypeCustomEmoji'
];

export type Entity = {
    text: string;
    type: ManagableEntities;
}

export function mapMessageToPost(message: message): Post | undefined {
    let text: string | undefined = undefined;
    let entities: Array<Entity> | undefined = undefined;
    if (message.content._ === 'messageText') {
        text = message.content.text.text;
        entities = message.content.text.entities.filter(entity => managableEntities.includes(entity.type._)).map(entity => ({
            type: entity.type,
            text: text!.substring(entity.offset, entity.offset + entity.length)
        } as Entity));
    }
    if (message.content._ === 'messagePhoto' || message.content._ === 'messageVideo') {
        text = message.content.caption.text;
        entities = message.content.caption.entities.filter(entity => managableEntities.includes(entity.type._)).map(entity => ({
            type: entity.type,
            text: text!.substring(entity.offset, entity.offset + entity.length)
        } as Entity));
    }
    if (text !== undefined) {
        return {
            id: message.id,
            text,
            entities: entities?.filter(entity => !entities.some(e => e.text === entity.text && e.type._ === entity.type._))
        };
    }
    return undefined;
}