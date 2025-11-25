// Jest setup file to fix Node.js streams compatibility issues
import 'reflect-metadata';

// Mock problematic stream properties that cause Jest issues
const originalDefineProperty = Object.defineProperty;

Object.defineProperty = function (
  obj: any,
  prop: string,
  descriptor: PropertyDescriptor,
) {
  // Skip problematic stream properties that cause readonly property errors
  if (
    prop === 'closed' &&
    (obj.constructor?.name?.includes('ReadableStream') ||
      obj.constructor?.name?.includes('WritableStream'))
  ) {
    return obj;
  }

  if (prop === 'ready' && obj.constructor?.name?.includes('WritableStream')) {
    return obj;
  }

  return originalDefineProperty.call(this, obj, prop, descriptor);
};

// Set test environment variables
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/container_backend_test';
