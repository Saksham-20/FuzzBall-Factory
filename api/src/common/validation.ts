import { ValidationPipe, type ValidationError } from '@nestjs/common';
import { validationFailed, type FieldErrors } from './errors.js';

/** Flatten class-validator's nested errors into `{ "address.postalCode": "message" }` (first message per field). */
export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldErrors {
  const out: FieldErrors = {};
  for (const e of errors) {
    const path = parent ? `${parent}.${e.property}` : e.property;
    if (e.constraints) out[path] = humanise(Object.values(e.constraints)[0] ?? 'Invalid value', e.property);
    if (e.children?.length) Object.assign(out, flattenValidationErrors(e.children, path));
  }
  return out;
}

/** class-validator messages start with the property name ("email must be an email"): keep them readable. */
function humanise(message: string, property: string): string {
  if (/should not exist/.test(message)) return 'Not allowed';
  const stripped = message.startsWith(`${property} `) ? message.slice(property.length + 1) : message;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

/** The global pipe: strips unknown props, rejects unexpected ones, transforms to DTO classes. Used by main.ts and tests. */
export const createValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors) => validationFailed(flattenValidationErrors(errors)),
  });
