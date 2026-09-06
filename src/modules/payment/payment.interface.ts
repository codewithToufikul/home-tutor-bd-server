import type { Model, Types } from 'mongoose';

export type TPaymentMethod = 'bkash' | 'nagad' | 'rocket' | 'bank';
export type TPaymentStatus = 'pending' | 'approved' | 'rejected';
export type TPaymentType = 'tuition_fee' | 'verification_fee' | 'wallet_recharge';

export interface IPayment {
  _id?: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  tuitionJobId?: Types.ObjectId | string;
  applicationId?: Types.ObjectId | string;
  paymentType: TPaymentType;
  amount: number;
  payableAmount: number;
  paymentMethod: TPaymentMethod;
  senderNumber: string;
  transactionId: string;
  receiptUrl?: string;
  receiptPublicId?: string;
  status: TPaymentStatus;
  rejectionReason?: string;
  approvedBy?: Types.ObjectId | string;
  approvedAt?: Date;
  invoiceNumber?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PaymentModel = Model<IPayment>;
