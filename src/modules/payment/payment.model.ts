import { Schema, model } from 'mongoose';
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  WITHDRAWAL_STATUSES,
} from './payment.constants.js';
import type {
  IPayment,
  ITransaction,
  IWallet,
  IWithdrawal,
  PaymentModel,
  TransactionModel,
  WalletModel,
  WithdrawalModel,
} from './payment.interface.js';

// 1. Wallet Schema
const walletSchema = new Schema<IWallet, WalletModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Balance cannot be negative'],
    },
    creditBalance: {
      type: Number,
      default: 0,
      min: [0, 'Credit balance cannot be negative'],
    },
    withdrawableBalance: {
      type: Number,
      default: 0,
      min: [0, 'Withdrawable balance cannot be negative'],
    },
  },
  {
    timestamps: true,
  },
);

export const Wallet = model<IWallet, WalletModel>('Wallet', walletSchema);

// 2. Transaction Audit Ledger Schema
const transactionSchema = new Schema<ITransaction, TransactionModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    type: {
      type: String,
      enum: {
        values: TRANSACTION_TYPES,
        message: '{VALUE} is not a valid transaction type',
      },
      required: [true, 'Transaction type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
    },
    balanceBefore: {
      type: Number,
      required: [true, 'Balance before transaction is required'],
    },
    balanceAfter: {
      type: Number,
      required: [true, 'Balance after transaction is required'],
    },
    reference: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: TRANSACTION_STATUSES,
        message: '{VALUE} is not a valid transaction status',
      },
      default: 'Completed',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

export const Transaction = model<ITransaction, TransactionModel>('Transaction', transactionSchema);

// 3. Payment Gateway Deposit Schema
const paymentSchema = new Schema<IPayment, PaymentModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be greater than 0'],
    },
    paymentMethod: {
      type: String,
      enum: {
        values: PAYMENT_METHODS,
        message: '{VALUE} is not a valid payment method',
      },
      required: [true, 'Payment method is required'],
    },
    transactionId: {
      type: String,
      required: [true, 'Transaction ID is required'],
      unique: true,
    },
    status: {
      type: String,
      enum: {
        values: PAYMENT_STATUSES,
        message: '{VALUE} is not a valid payment status',
      },
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  },
);

export const Payment = model<IPayment, PaymentModel>('Payment', paymentSchema);

// 4. Cashout Withdrawal Request Schema
const withdrawalSchema = new Schema<IWithdrawal, WithdrawalModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be greater than 0'],
    },
    paymentMethod: {
      type: String,
      enum: {
        values: PAYMENT_METHODS,
        message: '{VALUE} is not a valid payment method',
      },
      required: [true, 'Payment method is required'],
    },
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: WITHDRAWAL_STATUSES,
        message: '{VALUE} is not a valid withdrawal status',
      },
      default: 'Pending',
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const Withdrawal = model<IWithdrawal, WithdrawalModel>('Withdrawal', withdrawalSchema);
