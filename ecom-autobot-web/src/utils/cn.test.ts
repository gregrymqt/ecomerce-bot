import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn utility function', () => {
  it('should merge basic class names correctly', () => {
    const result = cn('flex', 'items-center', 'justify-between');
    expect(result).toBe('flex items-center justify-between');
  });

  it('should evaluate conditional class expressions', () => {
    const isActive = true;
    const isDisabled = false;

    const result = cn(
      'btn',
      isActive && 'btn-active',
      isDisabled && 'btn-disabled',
      undefined,
      null
    );

    expect(result).toBe('btn btn-active');
  });

  it('should merge conflicting Tailwind CSS classes correctly (tailwind-merge)', () => {
    // px-4 deve se sobrepor a px-2
    const paddingResult = cn('px-2 py-1', 'px-4');
    expect(paddingResult).toBe('py-1 px-4');

    // bg-blue-500 deve se sobrepor a bg-red-500
    const colorResult = cn('bg-red-500 text-white', 'bg-blue-500');
    expect(colorResult).toBe('text-white bg-blue-500');
  });

  it('should handle arrays and object notation', () => {
    const result = cn(['flex', 'gap-2'], {
      'opacity-50': true,
      'cursor-not-allowed': false,
    });

    expect(result).toBe('flex gap-2 opacity-50');
  });

  it('should return empty string when no valid classes are provided', () => {
    const result = cn('', false, null, undefined);
    expect(result).toBe('');
  });
});
