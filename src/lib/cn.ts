type ClassValue = string | false | null | undefined | 0

/** Tiny className joiner. */
export const cn = (...classes: ClassValue[]): string => classes.filter(Boolean).join(' ')
