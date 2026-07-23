import React, { forwardRef, useId } from 'react';
import { Label } from './Label';
import { Input, type InputProps } from './Input';
import { ErrorMessage } from './ErrorMessage';
import { HelperText } from './HelperText';
import { cn } from '@/lib/utils';

export interface FormFieldProps extends Omit<InputProps, 'error' | 'children'> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  children?: React.ReactNode;
  containerClassName?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  (
    {
      label,
      error,
      helperText,
      required,
      id,
      children,
      className,
      containerClassName,
      iconLeft,
      iconRight,
      ...inputProps
    },
    ref
  ) => {
    const generatedId = useId();
    const fieldId = id || generatedId;
    const errorId = `${fieldId}-error`;
    const helperId = `${fieldId}-helper`;

    const describedBy = [
      error ? errorId : null,
      helperText && !error ? helperId : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className={cn('flex flex-col w-full', containerClassName)}>
        {label && (
          <Label htmlFor={fieldId} required={required} className="mb-1.5">
            {label}
          </Label>
        )}

        {children ? (
          React.isValidElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; error?: boolean }>(children) ? (
            React.cloneElement(children, {
              id: children.props.id || fieldId,
              'aria-describedby': children.props['aria-describedby'] || describedBy,
              'aria-invalid': children.props['aria-invalid'] ?? !!error,
              error: children.props.error ?? !!error,
            })
          ) : (
            children
          )
        ) : (
          <Input
            ref={ref}
            id={fieldId}
            error={!!error}
            required={required}
            iconLeft={iconLeft}
            iconRight={iconRight}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            className={className}
            {...inputProps}
          />
        )}

        {error && <ErrorMessage id={errorId}>{error}</ErrorMessage>}
        {!error && helperText && <HelperText id={helperId}>{helperText}</HelperText>}
      </div>
    );
  }
);

FormField.displayName = 'FormField';
