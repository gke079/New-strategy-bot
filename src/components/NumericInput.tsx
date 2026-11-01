import React, { useState, useEffect } from 'react';

interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number | string;
  fallbackValue?: number;
  className?: string;
}

/**
 * Robust numeric input that allows users to freely select all digits,
 * clear completely with Backspace/Delete without immediate snap-back,
 * and gracefully commits valid values or clamps to limits on blur.
 */
export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  min,
  max,
  step,
  fallbackValue,
  className,
  onBlur,
  onFocus,
  ...rest
}) => {
  const formatVal = (v: number | undefined): string => {
    if (v === undefined || Number.isNaN(v)) return '';
    return String(v);
  };

  const [localVal, setLocalVal] = useState<string>(() => formatVal(value));
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // Sync external changes when input is not actively being edited by the user
  useEffect(() => {
    if (!isFocused) {
      setLocalVal(formatVal(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalVal(raw);

    // Allow user to clear all digits, or type "-" / decimal points without premature snapping
    if (raw === '' || raw === '-' || raw.endsWith('.')) {
      return;
    }

    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed)) {
      let clamped = parsed;
      if (max !== undefined && clamped > max) {
        clamped = max;
      }
      onChange(clamped);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    let parsed = parseFloat(localVal);
    const defaultFallback =
      fallbackValue !== undefined ? fallbackValue : min !== undefined ? min : 0;

    if (Number.isNaN(parsed) || localVal.trim() === '') {
      parsed = defaultFallback;
    } else {
      if (min !== undefined && parsed < min) parsed = min;
      if (max !== undefined && parsed > max) parsed = max;
    }

    const finalVal = Number(parsed.toFixed(4));
    setLocalVal(String(finalVal));
    onChange(finalVal);

    if (onBlur) {
      onBlur(e);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Auto-select text on focus so user can immediately type a new number or clear
    e.target.select();
    if (onFocus) {
      onFocus(e);
    }
  };

  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      className={className}
      {...rest}
    />
  );
};
