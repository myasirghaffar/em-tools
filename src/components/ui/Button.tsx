import { Loader2 } from 'lucide-react';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  loadingText?: string;
}

export function ButtonSpinner({ className = '' }: { className?: string }) {
  return (
    <Loader2
      className={`h-4 w-4 shrink-0 animate-spin ${className}`}
      aria-hidden
    />
  );
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      children,
      disabled,
      loading = false,
      loadingText,
      ...props
    },
    ref,
  ) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'bg-[#FF7A00] text-white hover:bg-[#FF7A00]/90 focus:ring-[#FF7A00]',
      secondary: 'bg-[#0B2A4A] text-white hover:bg-[#0B2A4A]/90 focus:ring-[#0B2A4A]',
      outline: 'border-2 border-[#FF7A00] text-[#FF7A00] hover:bg-[#FF7A00] hover:text-white focus:ring-[#FF7A00]',
      ghost: 'text-[#0B2A4A] hover:bg-gray-100 focus:ring-gray-400'
    };
    
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg'
    };
    
    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <ButtonSpinner /> : null}
        {loading && loadingText ? loadingText : children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
