export const APPLICATION_STATUS = {
  PENDING: 'Pending',
  DEMO_CONFIRMED: 'Demo_Confirmed',
  DEMO_COMPLETED: 'Demo_Completed',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
} as const;

export const APPLICATION_STATUSES = [
  'Pending',
  'Demo_Confirmed',
  'Demo_Completed',
  'Accepted',
  'Rejected',
  'Withdrawn',
] as const;
