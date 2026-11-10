'use client';
import {createContext} from 'react';
import type {Theme} from '@/draw/types';
export const NotesThemeContext=createContext<{mode:Theme;onModeChange:(mode:Theme)=>boolean}|null>(null);
