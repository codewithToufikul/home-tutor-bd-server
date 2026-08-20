import type { Model, Types } from 'mongoose';
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  WITHDRAWAL_STATUSES,
} from './payment.constants.js';

export type TTransactionType = (typeof TRANSACTION_TYPES)[number];
export type TTransactionStatus = (typeof TRANSACTION_STATUSES)[number];
export type TPaymentMethod = (typeof PAYMENT_METHODS)[number];
export type TPaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type TWithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export interface IWallet {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  balance: number;
  creditBalance: number;
  withdrawableBalance: number;
  createdAt?: Date;
  updatedAt?: Date;
}
export type WalletModel = Model<IWallet>;

export interface ITransaction {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  type: TTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reference?: string;
  status: TTransactionStatus;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}
export type TransactionModel = Model<ITransaction>;

export interface IPayment {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  paymentMethod: TPaymentMethod;
  transactionId: string;
  status: TPaymentStatus;
  createdAt?: Date;
  updatedAt?: Date;
}
export type PaymentModel = Model<IPayment>;

export interface IWithdrawal {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  paymentMethod: TPaymentMethod;
  accountNumber: string;
  status: TWithdrawalStatus;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
export type WithdrawalModel = Model<IWithdrawal>;
