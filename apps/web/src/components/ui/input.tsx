'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Select as RadixSelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const EMPTY_VALUE_SENTINEL = '__sfcc_empty__';

type SelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

function parseSelectOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child) || child.type !== 'option') return;
    const props = child.props as { value?: string | number; disabled?: boolean; children?: React.ReactNode };
    options.push({
      value: props.value === undefined || props.value === null ? '' : String(props.value),
      label: props.children ?? props.value,
      disabled: props.disabled,
    });
  });
  return options;
}

function toRadixValue(value: string | number | readonly string[] | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const str = Array.isArray(value) ? value[0] : String(value);
  if (str === '') return EMPTY_VALUE_SENTINEL;
  return str;
}

function fromRadixValue(value: string): string {
  return value === EMPTY_VALUE_SENTINEL ? '' : value;
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium leading-none', className)} {...props} />;
}

export function Select({
  className,
  children,
  value,
  onChange,
  disabled,
  id,
  name,
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const options = React.useMemo(() => parseSelectOptions(children), [children]);
  const placeholderOption = options.find((o) => o.value === '');
  const selectableOptions = options.filter((o) => o.value !== '');
  const placeholder =
    placeholderOption?.label != null && placeholderOption.label !== ''
      ? String(placeholderOption.label)
      : 'Select…';

  const radixValue = toRadixValue(value);

  return (
    <>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={value === undefined || value === null ? '' : String(value)}
          readOnly
          tabIndex={-1}
          aria-hidden
        />
      ) : null}
      <RadixSelectRoot
        value={radixValue}
        onValueChange={(next) => {
          onChange?.({
            target: { value: fromRadixValue(next), name },
          } as React.ChangeEvent<HTMLSelectElement>);
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id} className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" className="z-[100]">
          {placeholderOption ? (
            <SelectItem value={EMPTY_VALUE_SENTINEL} disabled={placeholderOption.disabled}>
              {placeholderOption.label}
            </SelectItem>
          ) : null}
          {selectableOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </RadixSelectRoot>
    </>
  );
}

export { Input };
export { Textarea } from '@/components/ui/textarea';
