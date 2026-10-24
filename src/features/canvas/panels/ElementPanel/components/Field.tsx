import type { MutableRefObject } from "react";
import { CommitField } from "../shell/CommitField";

interface FieldProps {
  label: string;
  value: string;
  /** Called on blur or Enter, not per keystroke. */
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
  inputRef?: MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}

/** A labelled text field that commits once per edit; see `CommitField`. */
const Field = ({ label, value, onChange, multiline, placeholder, hint, inputRef }: FieldProps) => (
  <CommitField
    label={label}
    value={value}
    onCommit={onChange}
    multiline={multiline}
    placeholder={placeholder}
    hint={hint}
    inputRef={inputRef}
  />
);

export default Field;
