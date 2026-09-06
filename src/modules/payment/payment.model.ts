import { Schema, model } from 'mongoose';
import type { IPayment, PaymentModel } from './payment.interface.js';

const paymentSchema = new Schema<IPayment, PaymentModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    tuitionJobId: {
      type: Schema.Types.ObjectId,
      ref: 'TuitionJob',
      default: null,
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      default: null,
    },
    paymentType: {
      type: String,
      enum: ['tuition_fee', 'verification_fee', 'wallet_recharge'],
      default: 'tuition_fee',
    },
    amount: {
      type: Number,
      required: [true, 'Paid amount is required'],
      min: [1, 'Amount must be greater than 0'],
    },
    payableAmount: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['bkash', 'nagad', 'rocket', 'bank'],
      required: [true, 'Payment method is required'],
    },
    senderNumber: {
      type: String,
      required: [true, 'Sender phone number is required'],
      trim: true,
    },
    transactionId: {
      type: String,
      required: [true, 'Transaction ID (TrxID) is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    receiptUrl: {
      type: String,
      default: null,
    },
    receiptPublicId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    invoiceNumber: {
      type: String,
      default: function () {
        const rand = Math.floor(10000 + Math.random() * 90000);
        return `INV-${new Date().getFullYear()}-${rand}`;
      },
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ tuitionJobId: 1 });
paymentSchema.index({ status: 1 });

export const Payment = model<IPayment, PaymentModel>('Payment', paymentSchema);

// Withdrawal Schema (for admin stats / wallet balance)
const withdrawalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, default: 'bkash' },
    accountNumber: { type: String, default: '' },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Completed'], default: 'Pending' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Withdrawal = model('Withdrawal', withdrawalSchema);
