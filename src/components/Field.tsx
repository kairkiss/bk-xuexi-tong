import { ReactNode } from 'react'

interface FieldProps {
  label: string
  children: ReactNode
}

export function Field({ label, children }: FieldProps): JSX.Element {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}
