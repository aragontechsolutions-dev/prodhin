type Variant = 'green' | 'red' | 'yellow' | 'gray' | 'blue';

interface Props {
  variant?: Variant;
  children: React.ReactNode;
}

const variants: Record<Variant, string> = {
  green:  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  red:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  gray:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
};

export default function Badge({ variant = 'gray', children }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}
