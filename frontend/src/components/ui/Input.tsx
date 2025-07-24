'use client';

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={label ? "field-row-stacked" : "field-row"}>
      {label && (
        <label htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={className}
        {...props}
      />
      {error && (
        <span className="input-error">
          {error}
        </span>
      )}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  className = '',
  id,
  ...props
}) => {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={label ? "field-row-stacked" : "field-row"}>
      {label && (
        <label htmlFor={selectId}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={className}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="input-error">
          {error}
        </span>
      )}
    </div>
  );
};

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  className = '',
  ...props
}) => {
  return (
    <label className={`win98-checkbox ${className}`}>
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
};

interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Radio: React.FC<RadioProps> = ({
  label,
  className = '',
  ...props
}) => {
  return (
    <label className={`win98-radio ${className}`}>
      <input type="radio" {...props} />
      <span>{label}</span>
    </label>
  );
};

export default Input;
