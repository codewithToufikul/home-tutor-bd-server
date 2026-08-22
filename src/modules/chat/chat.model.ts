import { Schema, model } from 'mongoose';
import { MESSAGE_TYPES } from './chat.constants.js';
import type { ConversationModel, IConversation, IMessage, MessageModel } from './chat.interface.js';

// ─── Conversation Schema ──────────────────────────────────────────────────
const conversationSchema = new Schema<IConversation, ConversationModel>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

conversationSchema.index({ participants: 1 });

export const Conversation = model<IConversation, ConversationModel>('Conversation', conversationSchema);

// ─── Message Schema ───────────────────────────────────────────────────────
const messageSchema = new Schema<IMessage, MessageModel>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation ID is required'],
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiver ID is required'],
    },
    message: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: MESSAGE_TYPES,
      default: 'text',
    },
    attachments: {
      type: [String],
      default: [],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, receiverId: 1 });

export const Message = model<IMessage, MessageModel>('Message', messageSchema);
