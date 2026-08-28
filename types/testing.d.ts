/**
 * jest-dom's matchers are registered at runtime by `setupFilesAfterEach` in
 * jest.config.js, but TypeScript needs this import to know about them —
 * without it every `toBeInTheDocument` in the test suite is a type error.
 */
import '@testing-library/jest-dom';
