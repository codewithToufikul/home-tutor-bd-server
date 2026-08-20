export const GENDER_PREFERENCE = {
  MALE: 'Male',
  FEMALE: 'Female',
  ANY: 'Any',
} as const;

export const GENDER_PREFERENCES = ['Male', 'Female', 'Any'] as const;

export const TUITION_JOB_STATUS = {
  OPEN: 'Open',
  MATCHED: 'Matched',
  CLOSED: 'Closed',
} as const;

export const TUITION_JOB_STATUSES = ['Open', 'Matched', 'Closed'] as const;

export const APPROVAL_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
} as const;

export const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;
