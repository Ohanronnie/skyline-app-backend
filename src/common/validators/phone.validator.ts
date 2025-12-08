import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { validateAndNormalizeGhanaPhone } from '../utils/phone.util';

/**
 * Custom validator decorator for Ghana phone numbers
 * Validates and normalizes the phone number, adding country code 233 if missing
 *
 * Usage:
 * @IsGhanaPhone()
 * phoneNumber: string;
 */
export function IsGhanaPhone(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isGhanaPhone',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          // Allow undefined/null for optional fields
          if (value === undefined || value === null) {
            return true;
          }
          if (typeof value !== 'string') {
            return false;
          }
          try {
            // Normalize the phone number (this will also validate it)
            const normalized = validateAndNormalizeGhanaPhone(value);
            // Update the value in the object with the normalized version
            (args.object as any)[propertyName] = normalized;
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid Ghana phone number `;
        },
      },
    });
  };
}
