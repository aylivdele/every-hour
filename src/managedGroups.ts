export interface Chat {
  title?: string;
  id: number;
  unreadCount?: number;
}

export interface Folder {
  id: number;
  title: string;
}

export interface Group {
  folder: Folder;
  targetChat?: Chat;
  sourceChats: Array<Chat>;
}

export const managedGroups: Array<Group> = [];

