import { createContext } from 'react';

export const ThemeContext = createContext<{ theme: 'dark' }>({ theme: 'dark' });
