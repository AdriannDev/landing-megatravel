'use client'

import { FieldError, SelectInput, useField } from '@payloadcms/ui'
import type { StaticLabel } from 'payload'

export function FeaturedDepartureSelect({ path, label, options, readOnly }: {
  path: string
  label?: StaticLabel
  options: { value: string; label: string }[]
  readOnly?: boolean
}) {
  const { value, setValue, errorMessage, showError, disabled, formProcessing } = useField<number | null>({ path })
  return (
    <SelectInput
      name={path}
      path={path}
      label={label}
      options={options}
      value={value == null ? '' : String(value)}
      readOnly={readOnly || disabled || formProcessing}
      isClearable
      placeholder="Sin salida destacada"
      description="Busca por programa, fecha (AAAA-MM-DD), MTPE u origen. Solo se muestran en el catálogo las salidas publicadas y vigentes."
      showError={showError}
      Error={<FieldError path={path} showError={showError} message={errorMessage} />}
      onChange={option => setValue(option && !Array.isArray(option) ? Number(option.value) : null)}
    />
  )
}
