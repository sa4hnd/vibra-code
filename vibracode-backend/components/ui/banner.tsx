'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const bannerVariants = cva(
	'relative overflow-hidden rounded-md border shadow-lg text-sm',
	{
		variants: {
			variant: {
				default: 'bg-muted/40 border-muted/80',
				success:
					'bg-green-50 border-green-200 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100',
				warning:
					'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-100',
				info: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100',
				premium:
					'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 text-purple-900 dark:from-purple-900/20 dark:to-pink-900/20 dark:border-purple-800 dark:text-purple-100',
				gradient:
					'bg-black/20 border-white/10 text-white backdrop-blur-sm',
			},
			size: {
				default: 'py-1.5 px-2.5',
				sm: 'text-xs py-1 px-2',
				lg: 'text-lg py-4 px-6',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);

type BannerProps = React.ComponentProps<'div'> &
	VariantProps<typeof bannerVariants> & {
		// Content
		title: string;
		description?: string;

		// Icons and visuals
		icon?: React.ReactNode;
		showShade?: boolean;

		// Actions
		show?: boolean;
		onHide?: () => void;
		action?: React.ReactNode;
		closable?: boolean;

		// Behavior
		autoHide?: number; // milliseconds
	};

export function Banner({
	variant = 'default',
	size = 'default',
	title,
	description,
	icon,
	showShade = false,
	show,
	onHide,
	action,
	closable = false,
	className,
	autoHide,
	...props
}: BannerProps) {
	React.useEffect(() => {
		if (autoHide) {
			const timer = setTimeout(() => {
				onHide?.();
			}, autoHide);
			return () => clearTimeout(timer);
		}
	}, [autoHide, onHide]);

	if (!show) return null;

	return (
		<div
			className={cn(bannerVariants({ variant, size }), className)}
			role={variant === 'warning' || variant === 'default' ? 'alert' : 'status'}
			{...props}
		>
			{/* Shimmer effect */}
			{showShade && (
				<div className="absolute inset-0 -z-10 -skew-x-12 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
			)}

			<div className="flex items-center justify-between gap-4">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					{icon && <div className="flex-shrink-0">{icon}</div>}

					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center">
							<p className="truncate font-semibold">{title}</p>
						</div>
						{description && <p className="text-xs opacity-80">{description}</p>}
					</div>
				</div>

				<div className="flex flex-shrink-0 items-center gap-2">
					{action && action}

					{closable && (
						<button 
							onClick={onHide} 
							className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-all duration-200"
						>
							<X className="h-3 w-3" />
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
