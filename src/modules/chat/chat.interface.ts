import type { Model, Types } from 'mongoose';

export type MessageType = 'text' | 'image' | 'file';

export interface IConversation {
  _id?: Types.ObjectId | string;
  participants: Types.ObjectId[];
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ConversationModel = Model<IConversation>;

export interface IMessage {
  _id?: Types.ObjectId | string;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  message: string;
  type: MessageType;
  attachments?: string[];
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type MessageModel = Model<IMessage>;
