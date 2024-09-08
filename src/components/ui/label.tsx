import React from 'react';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  className?: string;
}

export const Label: React.FC<LabelProps> = ({ children, className, ...props }) => {
  return (
    <label className={`block text-sm font-medium ${className}`} {...props}>
      {children}
    </label>
  );
};