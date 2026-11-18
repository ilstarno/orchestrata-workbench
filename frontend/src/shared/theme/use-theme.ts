import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'
const storageKey = 'orchestrata.theme'
let current: Theme | undefined
const listeners = new Set<() => void>()

function readTheme(): Theme {
  if (current) return current
  try {
    current = localStorage.getItem(storageKey) === 'light' ? 'light' : 'dark'
  } catch {
    current = 'dark'
  }
  return current
}

function notify() {
  for (const listener of listeners) listener()
}

function onStorage(event: StorageEvent) {
  if (event.key !== storageKey && event.key !== null) return
  current = undefined
  notify()
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored === 'light' || stored === 'dark') current = stored
    } catch {
      // Preserve the in-memory choice if storage is unavailable.
    }
    window.addEventListener('storage', onStorage)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

function toggleTheme() {
  current = readTheme() === 'dark' ? 'light' : 'dark'
  try {
    localStorage.setItem(storageKey, current)
  } catch {
    // Theme remains shared across views when storage is unavailable.
  }
  notify()
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'dark' as const)
  return { theme, toggleTheme }
}
