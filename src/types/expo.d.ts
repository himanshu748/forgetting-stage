declare module 'expo' {
  export function registerRootComponent(component: unknown): void;
}

declare module 'expo-status-bar' {
  import type { ComponentType } from 'react';

  export const StatusBar: ComponentType<{ style?: 'auto' | 'inverted' | 'light' | 'dark' }>;
}
