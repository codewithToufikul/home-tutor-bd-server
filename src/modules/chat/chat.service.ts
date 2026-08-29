import { AppError } from '../../errors/AppError.js';
import { User } from '../user/user.model.js';
import type { IMessage, MessageType } from './chat.interface.js';
import { Conversation, Message } from './chat.model.js';

const getOrCreateConversation = async (currentUserId: string, targetUserId: string) => {
  if (currentUserId === targetUserId) {
    throw new AppError(400, 'Cannot start a conversation with yourself!');
  }

  let conversation = await Conversation.findOne({
    participants: { $all: [currentUserId, targetUserId] },
  }).populate('participants', 'name email avatar role');

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [currentUserId, targetUserId],
    });
    conversation = await conversation.populate('participants', 'name email avatar role');
  }

  return conversation;
};

const getUserConversations = async (userId: string) => {
  const conversations = await Conversation.find({
    participants: userId,
  })
    .populate('participants', 'name email avatar role status')
    .sort({ lastMessageAt: -1 });

  return conversations;
};

const getConversationMessages = async (
  conversationId: string,
  userId: string,
  page: number = 1,
  limit: number = 50,
) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new AppError(404, 'Conversation not found!');
  }

  const isParticipant = conversation.participants.some(
    (p) => String(p) === userId,
  );
  if (!isParticipant) {
    throw new AppError(403, 'You are not a participant in this conversation!');
  }

  const skip = (page - 1) * limit;

  const messages = await Message.find({ conversationId })
    .populate('senderId', 'name avatar role phone location')
    .populate('receiverId', 'name avatar role phone location')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Message.countDocuments({ conversationId });

  return {
    messages: messages.reverse(),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const createMessage = async (payload: {
  conversationId: string;
  senderId: string;
  receiverId: string;
  message: string;
  type?: MessageType;
  attachments?: string[];
}) => {
  const message = await Message.create({
    conversationId: payload.conversationId,
    senderId: payload.senderId,
    receiverId: payload.receiverId,
    message: payload.message,
    type: payload.type || 'text',
    attachments: payload.attachments || [],
    isRead: false,
  });

  await Conversation.findByIdAndUpdate(payload.conversationId, {
    lastMessage: payload.message,
    lastMessageAt: new Date(),
  });

  return await message.populate([
    { path: 'senderId', select: 'name avatar role phone location' },
    { path: 'receiverId', select: 'name avatar role phone location' },
  ]);
};

const markMessagesAsRead = async (conversationId: string, userId: string) => {
  await Message.updateMany(
    {
      conversationId,
      receiverId: userId,
      isRead: false,
    },
    {
      $set: { isRead: true },
    },
  );

  return { success: true };
};

const getAvailableContacts = async (currentUserId: string, currentUserRole: string) => {
  if (currentUserRole === 'student' || currentUserRole === 'guardian' || currentUserRole === 'tutor') {
    // Return staff users (super_admin, admin, moderator) for quick support contact
    const staff = await User.find({ role: { $in: ['super_admin', 'admin', 'moderator'] }, status: 'active' })
      .select('name email phone avatar role status')
      .lean();
    return staff;
  } else {
    // For admin / moderator: return recent active students, guardians, tutors
    const recentUsers = await User.find({
      role: { $in: ['student', 'guardian', 'tutor', 'coaching'] },
      status: 'active',
    })
      .select('name email phone avatar role status location')
      .sort({ updatedAt: -1 })
      .limit(40)
      .lean();
    return recentUsers;
  }
};

const searchUsersForChat = async (query: string, currentUserId: string) => {
  const q = (query || '').trim();
  if (!q) return [];
  const filter: any = {
    _id: { $ne: currentUserId },
    status: 'active',
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
    ],
  };
  const users = await User.find(filter)
    .select('name email phone avatar role status location')
    .limit(20)
    .lean();
  return users;
};

export const ChatService = {
  getOrCreateConversation,
  getUserConversations,
  getConversationMessages,
  createMessage,
  markMessagesAsRead,
  getAvailableContacts,
  searchUsersForChat,
};
