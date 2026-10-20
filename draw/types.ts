export type Tool =
  | "select"
  | "hand"
  | "rectangle"
  | "diamond"
  | "circle"
  | "arrow"
  | "line"
  | "pencil"
  | "text"
  | "code"
  | "doc"
  | "sticky"
  | "frame"
  | "eraser"
  | "fill"
  | "eyedropper";

export type BulletVariant =
  | "disc"
  | "circle"
  | "square"
  | "diamond"
  | "dash"
  | "arrow"
  | "number"
  | "todo";

export type StrokeStyle = "solid" | "dashed" | "dotted" | "rough";
export type FillStyle = "solid" | "semi" | "none" | "hachure" | "crosshatch" | "dots";
export type Roundness = "sharp" | "rounded";
export type FontFamily = "hand" | "sans" | "mono" | "serif" | "rounded" | "condensed" | "print";
export type TextAlign = "left" | "center" | "right";
export type ViewMode = "canvas" | "split" | "notes";
export type GridType = "dot" | "grid" | "none";
export type Theme = "dark";

/** What the in-place text editor is editing. */
export type InlineTextKind = "new-text" | "text" | "sticky" | "label" | "frame-title";

export interface TextFormatting {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

export interface InlineTextState extends TextFormatting {
  containerId?: string;
  containerOffset?: Point;
  caret?: number;
  replaceLabelId?: string;
  kind: InlineTextKind;
  elementId?: string;
  /** Canvas-space position used when creating a new text element. */
  canvasX: number;
  canvasY: number;
  /** Position of the editor inside the canvas container, in CSS pixels. */
  screenX: number;
  screenY: number;
  /** Optional editor size in CSS pixels (zoom applied). */
  screenWidth?: number;
  screenHeight?: number;
  text: string;
  fontSize: number;
  fontFamily: FontFamily;
  color: string;
  align: TextAlign;
}

export interface Point {
  x: number;
  y: number;
}

export interface BaseElement {
  localOnly?: boolean;
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  fill: string;
  fillStyle: FillStyle;
  fillOpacity?: number;
  roundness: Roundness;
  opacity: number;
  zIndex: number;
  /** Centered label drawn inside shapes and used for arrow / icon captions. */
  label?: string;
  isLocked?: boolean;
}

export interface RectangleElement extends BaseElement {
  type: "rectangle";
}

export interface DiamondElement extends BaseElement {
  type: "diamond";
}

export interface CircleElement extends BaseElement {
  type: "circle";
}

export type ArrowRouting = "straight" | "elbow" | "curved";
export type ArrowHead = "none" | "arrow" | "dot" | "diamond" | "bar";
export type AnchorPosition = "top" | "bottom" | "left" | "right";

export interface ElementBinding {
  elementId: string;
  anchor: AnchorPosition;
}

export interface ArrowElement extends BaseElement {
  type: "arrow";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  routing?: ArrowRouting;
  /** Legacy alias of `routing`, still read so older saved boards keep their shape. */
  elbow?: ArrowRouting;
  arrowHeadStart?: ArrowHead | boolean;
  arrowHeadEnd?: ArrowHead | boolean;
  animated?: boolean;
  startBinding?: ElementBinding;
  endBinding?: ElementBinding;
  bendOffset?: number;
}

export interface LineElement extends BaseElement {
  type: "line";
  /** Signed quadratic control-point offset; zero keeps the line straight. */
  bendOffset?: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface PencilElement extends BaseElement {
  type: "pencil";
  points: Point[];
}

export interface AttachmentData { name: string; mimeType: string; size: number; source: string }

export interface TextElement extends BaseElement, TextFormatting {
  attachment?: AttachmentData;
  containerId?: string;
  containerOffset?: Point;
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: FontFamily;
  textAlign: TextAlign;
  isDocCard?: boolean;
  isCodeCard?: boolean;
  codeLanguage?: string;
  title?: string;
}

export interface StickyElement extends BaseElement, TextFormatting {
  fontFamily?: FontFamily;
  textAlign?: TextAlign;
  type: "sticky";
  text: string;
  color: string;
  fontSize: number;
}

export interface IconElement extends BaseElement {
  type: "icon";
  iconId: string;
  iconName: string;
  category: string;
  iconColor?: string;
  badgeBg?: string;
  /** Inline SVG for icons imported from the internet, so they render offline. */
  svgMarkup?: string;
  viewBox?: string;
}

export interface FrameElement extends BaseElement {
  type: "frame";
  title: string;
}

export interface ImageElement extends BaseElement {
  type: "image";
  source: string;
  imageName: string;
}

export type CanvasElement =
  | RectangleElement
  | DiamondElement
  | CircleElement
  | ArrowElement
  | LineElement
  | PencilElement
  | TextElement
  | StickyElement
  | IconElement
  | FrameElement
  | ImageElement;

export interface Workspace { id: string; name: string; createdAt: number }

export interface BackgroundSettings { fill: string; fillStyle: FillStyle; fillOpacity: number }

export interface Board {
  background?: BackgroundSettings;
  roomExpiresAt?: number;
  workspaceId?: string;
  id: string;
  title: string;
  elements: CanvasElement[];
  markdownNotes: string;
  createdAt: number;
  updatedAt: number;
  theme: Theme;
  viewMode: ViewMode;
  gridType: GridType;
  snapToGrid: boolean;
  zoom: number;
  panOffset: Point;
}

export interface BoardSummary {
  workspaceId?: string;
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  elementCount: number;
}

export interface ElementStyleProps extends TextFormatting {
  stroke: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  fill: string;
  fillStyle: FillStyle;
  fillOpacity?: number;
  roundness: Roundness;
  opacity: number;
  fontSize: number;
  fontFamily: FontFamily;
  textAlign: TextAlign;
  arrowRouting?: ArrowRouting;
  arrowHeadStart?: ArrowHead;
  arrowHeadEnd?: ArrowHead;
  arrowAnimated?: boolean;
}

/** Default style applied to new elements and shown when nothing is selected. */
export const DEFAULT_STYLE: ElementStyleProps = {
  stroke: "#FFFFFF",
  strokeWidth: 2,
  strokeStyle: "solid",
  fill: "transparent",
  fillStyle: "none",
  fillOpacity: 1,
  roundness: "rounded",
  opacity: 1,
  fontSize: 16,
  fontFamily: "sans",
  textAlign: "left",
  arrowRouting: "elbow",
  arrowHeadStart: "none",
  arrowHeadEnd: "arrow",
  arrowAnimated: false,
};
