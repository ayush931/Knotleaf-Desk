import { DEFAULT_STYLE, type ElementStyleProps, type Tool } from './types';

export const COLOR_TOOLS = ['rectangle', 'diamond', 'circle', 'arrow', 'line', 'pencil', 'text', 'code', 'doc', 'sticky', 'frame'] as const;
export type ColorTool = typeof COLOR_TOOLS[number];
export type ToolColors = Pick<ElementStyleProps, 'stroke' | 'fill' | 'fillStyle' | 'fillOpacity'>;
export type ToolColorPreferences = Record<ColorTool, ToolColors>;
export const isColorTool = (tool: Tool): tool is ColorTool => (COLOR_TOOLS as readonly string[]).includes(tool);
export function pickToolColors(style: ElementStyleProps): ToolColors {
  return { stroke: style.stroke, fill: style.fill, fillStyle: style.fillStyle, fillOpacity: style.fillOpacity };
}
export function normalizeToolColors(value: unknown, legacyStyle = DEFAULT_STYLE): ToolColorPreferences {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const validColor = (color: unknown): color is string => typeof color === 'string' && (color === 'transparent' || /^#[\da-f]{6}$/i.test(color));
  return Object.fromEntries(COLOR_TOOLS.map(tool => {
    const raw = source[tool];
    const colors = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const next = pickToolColors(legacyStyle);
    for (const key of ['stroke', 'fill'] as const) if (validColor(colors[key])) next[key] = colors[key];
    if (['none', 'solid', 'semi', 'hachure', 'crosshatch', 'dots'].includes(String(colors.fillStyle))) next.fillStyle = colors.fillStyle as ToolColors['fillStyle'];
    if (typeof colors.fillOpacity === 'number' && Number.isFinite(colors.fillOpacity) && colors.fillOpacity >= 0 && colors.fillOpacity <= 1) next.fillOpacity = colors.fillOpacity;
    return [tool, next];
  })) as ToolColorPreferences;
}
