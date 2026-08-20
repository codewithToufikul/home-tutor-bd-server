export const TRANSACTION_TYPE = {
  CREDIT_PURCHASE: 'Credit_Purchase',
  COMMISSION_FEE: 'Commission_Fee',
  WITHDRAWAL: 'Withdrawal',
  REFUND: 'Refund',
  BONUS: 'Bonus',
} as const;

export const TRANSACTION_TYPES = [
  'Credit_Purchase',
  'Commission_Fee',
  'Withdrawal',
  'Refund',
  'Bonus',
] as const;

export const TRANSACTION_STATUS = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
} as const;

export const TRANSACTION_STATUSES = ['Pending', 'Completed', 'Failed', 'Cancelled'] as const;

export const PAYMENT_METHOD = {
  BKASH: 'Bkash',
  NAGAD: 'Nagad',
  ROCKET: 'Rocket',
  BANK: 'Bank',
  SSLCOMMERZ: 'SSLCommerz',
} as const;

export const PAYMENT_METHODS = ['Bkash', 'Nagad', 'Rocket', 'Bank', 'SSLCommerz'] as const;

export const PAYMENT_STATUS = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
} as const;

export const PAYMENT_STATUSES = ['Pending', 'Completed', 'Failed', 'Cancelled'] as const;

export const WITHDRAWAL_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
} as const;

export const WITHDRAWAL_STATUSES = [
  'Pending',
  'Approved',
  'Rejected',
  'Completed',
  'Cancelled',
] as const;
