'use client';

interface SupabaseWordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SupabaseWordmark({ className = '', size = 'md' }: SupabaseWordmarkProps) {
  const sizeClasses = {
    sm: 'h-4 w-16',
    md: 'h-6 w-24',
    lg: 'h-10 w-full'
  };

  return (
    <svg
      className={`${sizeClasses[size]} ${className}`}
      viewBox="0 0 160 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d="M0 2.5C0 1.11929 1.11929 0 2.5 0H17.5C18.8807 0 20 1.11929 20 2.5V17.5C20 18.8807 18.8807 20 17.5 20H2.5C1.11929 20 0 18.8807 0 17.5V2.5Z"
        fill="#3ECF8E"
      />
      <path
        d="M5 5H15V7H5V5Z"
        fill="white"
      />
      <path
        d="M5 9H15V11H5V9Z"
        fill="white"
      />
      <path
        d="M5 13H12V15H5V13Z"
        fill="white"
      />
      <text
        x="30"
        y="20"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="18"
        fontWeight="600"
        fill="white"
      >
        Supabase
      </text>
    </svg>
  );
}
