"use client";

import Select, { type SelectOption } from "./Select";

export type UserRoleValue = "ADMIN" | "USER" | "SALESMAN";

export const USER_ROLE_OPTIONS: SelectOption[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "USER", label: "Store user" },
  { value: "SALESMAN", label: "Sales" },
];

export function userRoleLabel(role: string): string {
  const m = USER_ROLE_OPTIONS.find((r) => r.value === role);
  return m?.label ?? role;
}

type Props = {
  value: UserRoleValue;
  onChange: (value: UserRoleValue) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  /** Show the "Role" label above the control (default true) */
  showLabel?: boolean;
  className?: string;
};

/**
 * Reusable role picker for admin user forms — uses the shared {@link Select}
 * (light panel, same as status and other admin dropdowns).
 */
export default function UserRoleSelect({
  value,
  onChange,
  disabled,
  id,
  name,
  showLabel = true,
  className = "",
}: Props) {
  return (
    <Select
      label={showLabel ? "Role" : undefined}
      labelClassName={
        showLabel ? "mb-1 block text-xs font-medium text-slate-600" : undefined
      }
      options={USER_ROLE_OPTIONS}
      value={value}
      onChange={(v) => onChange(v as UserRoleValue)}
      disabled={disabled}
      id={id}
      name={name}
      size="md"
      dropdownPosition="below"
      className={className}
    />
  );
}
