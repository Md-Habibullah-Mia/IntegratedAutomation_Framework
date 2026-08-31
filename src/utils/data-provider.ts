export const testUsers = {
  valid: { email: 'valid.user@example.com', password: 'Str0ngP@ss!' },
  invalid: { email: 'invalid.user@example.com', password: 'wrongpass' },
  edgeCases: {
    emptyEmail: { email: '', password: 'Str0ngP@ss!' },
    emptyPassword: { email: 'valid.user@example.com', password: '' },
    malformedEmail: { email: 'not-an-email', password: 'Str0ngP@ss!' },
    sqlInjectionAttempt: { email: "' OR '1'='1", password: "' OR '1'='1" },
  },
};
