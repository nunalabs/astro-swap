import { forwardRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface CardProps {
  children?: ReactNode;
  className?: string;
  variant?: 'default' | 'gradient' | 'glass';
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, variant = 'default', hover = false, padding = 'md', onClick }, ref) => {
    const baseStyles = 'rounded-xl border border-neutral-800 shadow-card';

    const variants = {
      default: 'bg-card',
      gradient: 'bg-gradient-card',
      glass: 'glass',
    };

    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    if (hover) {
      return (
        <motion.div
          ref={ref}
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
          className={cn(baseStyles, variants[variant], paddings[padding], 'cursor-pointer', className)}
          onClick={onClick}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variants[variant], paddings[padding], className)}
        onClick={onClick}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
