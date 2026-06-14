import { type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:   'bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white',
  secondary: 'bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 border border-gray-300',
  danger:    'bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white',
  ghost:     'bg-transparent hover:bg-gray-100 disabled:opacity-50 text-gray-600',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading,
  children,
  className = '',
  disabled,
  ...props
}: Props) {
  return (
    <button
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-lg
        transition focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2
        disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {isLoading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
