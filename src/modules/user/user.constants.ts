export const USER_ROLE = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  TUTOR: 'tutor',
  STUDENT: 'student',
  GUARDIAN: 'guardian',
  COACHING: 'coaching',
} as const;

export const USER_ROLES = [
  'super_admin',
  'admin',
  'moderator',
  'tutor',
  'student',
  'guardian',
  'coaching',
] as const;

export const USER_STATUS = {
  ACTIVE: 'active',
  BLOCKED: 'blocked',
  PENDING: 'pending',
} as const;

export const USER_STATUSES = ['active', 'blocked', 'pending'] as const;
