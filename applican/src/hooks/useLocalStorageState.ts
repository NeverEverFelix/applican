import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

type UseLocalStorageStateOptions<T> = {
  validate?: (value: unknown) => value is T;
};

function readFromLocalStorage<T>(
  key: string,
  defaultValue: T,
  validate?: (value: unknown) => value is T,
) {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  const raw = window.localStorage.getItem(key);
  if (raw === null) {
    return defaultValue;
  }

  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Backward compatibility for previously stored plain strings.
    parsed = raw;
  }

  if (validate) {
    return validate(parsed) ? parsed : defaultValue;
  }

  return parsed as T;
}

export function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
  options?: UseLocalStorageStateOptions<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readFromLocalStorage(key, defaultValue, options?.validate));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
