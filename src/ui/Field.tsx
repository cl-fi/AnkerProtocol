// Pure presentational primitive — universal (no 'use client').
// Reuses the existing `.di-field` + `.di-input-wrap` styling (Card pattern).
import type { InputHTMLAttributes, ReactNode } from 'react';

export interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Optional field label (wraps the input in a labelled `.di-field`). */
  label?: ReactNode;
  /** Optional trailing unit/hint shown inside the input frame (the `<i>`). */
  suffix?: ReactNode;
}

/** A bordered numeric/text input with an optional label and trailing unit. */
export function InputField({ label, suffix, className, ...inputProps }: InputFieldProps) {
  const control = (
    <div className="di-input-wrap">
      <input className={className} {...inputProps} />
      {suffix != null ? <i>{suffix}</i> : null}
    </div>
  );

  if (label == null) return control;

  return (
    <label className="di-field">
      <span>{label}</span>
      {control}
    </label>
  );
}
