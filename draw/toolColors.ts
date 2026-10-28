import { DEFAULT_STYLE, type CanvasElement, type ElementStyleProps, type Tool } from './types';

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

/** Cards are stored as text elements but keep their own creation preferences. */
export function colorToolForElement(element: CanvasElement): ColorTool | undefined {
  if(element.type==='text')return element.isCodeCard?'code':element.isDocCard?'doc':'text';
  return isColorTool(element.type as Tool)?element.type as ColorTool:undefined;
}
/** Remember only explicitly changed color fields, never a selected object's other colors. */
export function rememberToolColors(preferences: ToolColorPreferences, tools: readonly ColorTool[], style: Partial<ElementStyleProps>): ToolColorPreferences {
  const patch: Partial<ToolColors> = {};
  for(const key of ['stroke','fill','fillStyle','fillOpacity'] as const)if(style[key]!==undefined)Object.assign(patch,{[key]:style[key]});
  if(!Object.keys(patch).length||!tools.length)return preferences;
  const next={...preferences};
  for(const tool of new Set(tools))next[tool]={...next[tool],...patch};
  return next;
}
