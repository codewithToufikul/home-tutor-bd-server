export const USER_ROLE = {
  ADMIN: 'admin',
  TUTOR: 'tutor',
  STUDENT: 'student',
  GUARDIAN: 'guardian',
  COACHING: 'coaching',
} as const;

export const USER_ROLES = ['admin', 'tutor', 'student', 'guardian', 'coaching'] as const;

export const USER_STATUS = {
  ACTIVE: 'active',
  BLOCKED: 'blocked',
  PENDING: 'pending',
} as const;

export const USER_STATUSES = ['active', 'blocked', 'pending'] as const;
