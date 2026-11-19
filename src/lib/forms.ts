import type { FormEvent } from 'react'

/**
 * The browser's own «please fill in» bubbles speak the browser's language: these say it in Arabic.
 * Spread onto an <input>: `{...arabicCheck('اكتب الاسم.', 'الاسم غير صالح.')}`.
 */
export const arabicCheck = <E extends HTMLInputElement | HTMLTextAreaElement = HTMLInputElement>(missing: string, wrong = missing) => ({
  onInvalid: (e: FormEvent<E>) => {
    const el = e.currentTarget
    el.setCustomValidity(el.validity.valueMissing ? missing : wrong)
  },
  onInput: (e: FormEvent<E>) => e.currentTarget.setCustomValidity(''),
})
