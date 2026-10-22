"use client";
import type { SelectHTMLAttributes } from "react";
import {
  FONT_GROUPS,
  FONT_OPTIONS,
  fontCssStack,
} from "@/draw/fonts";
/** Platform-owned popup shared by canvas and note typography controls. */
export function FontSelect({
  defaultLabel,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  defaultLabel?: string;
}) {
  return (
    <select
      {...props}
      style={{
        ...props.style,
        fontFamily: fontCssStack("sans"),
      }}
    >
      {defaultLabel && <option value="">{defaultLabel}</option>}
      {FONT_GROUPS.map((group) => (
        <optgroup key={group} label={group}>
          {FONT_OPTIONS.filter((font) => font.group === group).map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
