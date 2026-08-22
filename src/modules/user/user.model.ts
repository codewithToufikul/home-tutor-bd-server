import bcryptjs from 'bcryptjs';
import { Schema, model } from 'mongoose';
import { USER_ROLES, USER_STATUSES } from './user.constants.js';
import type { IUser, UserModel } from './user.interface.js';

const userSchema = new Schema<IUser, UserModel>(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true, default: '' },
    password: { type: String, required: [true, 'Password is required'], select: 0 },
    role: {
      type: String,
      enum: { values: USER_ROLES, message: '{VALUE} is not a valid role' },
      default: 'student',
    },
    avatar: { type: String, default: '' },
    fcmTokens: { type: [String], default: [] },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: false },
    status: {
      type: String,
      enum: { values: USER_STATUSES, message: '{VALUE} is not a valid status' },
      default: 'active',
    },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret) {
        delete (ret as Record<string, unknown>).password;
        return ret;
      },
    },
  },
);

userSchema.index({ phone: 1 }, { sparse: true });
userSchema.index({ role: 1, status: 1 });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  if (this.password) {
    this.password = await bcryptjs.hash(this.password, 10);
  }
});

userSchema.statics.isUserExistsByEmail = async function (email: string) {
  return await this.findOne({ email: email.trim().toLowerCase() }).select('+password');
};

userSchema.statics.isPasswordMatched = async function (
  givenPassword: string,
  savedPassword: string,
) {
  return await bcryptjs.compare(givenPassword, savedPassword);
};

export const User = model<IUser, UserModel>('User', userSchema);
