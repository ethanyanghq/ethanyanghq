// types

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };
type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

type LayoutFrame = {
  viewport: Size;
  scale: number;
};

type TypeRole = {
  ratio: number;
  min: number;
  max: number;
  weight: number | string;
  lineHeight: number;
};

type SpacingToken = {
  ratio: number;
  min: number;
  max: number;
};

type CompositionSpec = {
  reference: Size;
  layout: {
    scale: number;
    rightGutterRatio: number;
    minRightGutter: number;
    maxRightGutter: number;
  };
  ratios: {
    headerWidth: number;
    headerHeight: number;
    branchStartX: number;
    diamondCenterX: number;
    diamondCenterY: number;
    diamondHalfDiag: number;
    circleRadius: number;
    panelOffsetXFromCircleLeft: number;
    panelOffsetYFromCircleBottom: number;
    panelWidth: number;
    panelHeight: number;
    titleX: number;
    titleY: number;
  };
  text: {
    title: string;
    work: string;
    talk: string;
    thinking: string;
    cursor: string;
    titleSize: number;
    headerTextOffsetY: number;
    thinkingSize: number;
    cursorSize: number;
    thinkingOffsetXFromCircleCenter: number;
    thinkingOffsetYFromCircleCenter: number;
    cursorOffsetXFromPanelLeft: number;
    cursorOffsetYFromPanelTop: number;
  };
  typography: {
    hero: TypeRole;
    pageHeading: TypeRole;
    itemTitle: TypeRole;
    body: TypeRole;
    detail: TypeRole;
  };
  spacing: {
    afterHero: number;
    afterPageHeading: SpacingToken;
    titleToDetail: SpacingToken;
    sectionGap: SpacingToken;
    afterBodyToLinks: SpacingToken;
    dividerWidthRatio: number;
  };
  colors: {
    background: string;
    line: string;
    title: string;
    headerLabel: string;
    cursor: string;
    diamond: string;
    circle: string;
    thinking: string;
    panel: string;
  };
};

type DerivedGeometry = {
  header: Rect;
  junction: Point;
  leftHit: Point;
  branchStart: Point;
  branchEnd: Point;
  diamondCenter: Point;
  diamondHalfDiag: number;
  circleCenter: Point;
  circleRadius: number;
  panel: Rect;
  titlePos: Point;
  thinkingPos: Point;
  cursorPos: Point;
};

type PageKey = "home" | "work" | "talk";
type HeaderBoxKey = "name" | "work" | "talk";
type ContactFeedback = {
  tone: "success" | "error";
  message: string;
} | null;
type AppState = {
  page: PageKey;
  emailFeedback: ContactFeedback;
  workSection: "built" | "published";
};

type HeaderBoxRefs = {
  key: HeaderBoxKey;
  box: Rect;
  fill: SVGRectElement;
  clipRect: SVGRectElement;
  border: SVGRectElement;
  hit: SVGRectElement;
};

type DiamondRefs = {
  group: SVGGElement;
  hit: SVGRectElement;
};

type BoatRefs = {
  line: SVGLineElement;
  hit: SVGLineElement;
  start: Point;
  end: Point;
  center: Point;
};

type SignalRefs = {
  hit: SVGRectElement;
  halo: SVGCircleElement;
  thinkingSoft: SVGTextElement;
  thinkingCrisp: SVGTextElement;
  baseRadius: number;
};

type TerminalRefs = {
  hit: SVGRectElement;
  panel: SVGRectElement;
  cursor: SVGTextElement;
};

type InteractionRefs = {
  headerBoxes: HeaderBoxRefs[];
  boat: BoatRefs;
  diamond: DiamondRefs;
  signal: SignalRefs;
  terminal: TerminalRefs;
};

type AnimationOptions = {
  duration: number;
  from: number;
  to: number;
  easing?: (t: number) => number;
  onUpdate: (value: number, progress: number) => void;
  onComplete?: () => void;
};

type InfoLayout = {
  x: number;
  y: number;
  width: number;
  availableWidth: number;
  diamondCenterY: number;
  mobile: boolean;
};

type ResolvedType = {
  size: number;
  weight: number | string;
  lineHeight: number;
};

type ContentTypography = {
  hero: ResolvedType;
  pageHeading: ResolvedType;
  itemTitle: ResolvedType;
  body: ResolvedType;
  detail: ResolvedType;
  colors: { body: string; detail: string; divider: string };
  gap: {
    afterHero: number;
    afterPageHeading: number;
    titleToDetail: number;
    sectionGap: number;
    afterBodyToLinks: number;
  };
  dividerWidth: number;
};

type TextStyle = {
  fill: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  letterSpacing?: number;
  opacity?: number;
  dominantBaseline?: string;
  textAnchor?: string;
  fontStyle?: string;
};

// spec and constants

const SPEC: CompositionSpec = {
  reference: {
    width: 1600,
    height: 1000,
  },
  layout: {
    scale: 1.0,
    rightGutterRatio: 0.14,
    minRightGutter: 24,
    maxRightGutter: 220,
  },
  ratios: {
    headerWidth: 0.334375,
    headerHeight: 0.136,
    branchStartX: 0.105625,
    diamondCenterX: 0.19125,
    diamondCenterY: 0.427,
    diamondHalfDiag: 0.0858,
    circleRadius: 0.0375,
    panelOffsetXFromCircleLeft: 0.05125,
    panelOffsetYFromCircleBottom: 0.073,
    panelWidth: 0.15625,
    panelHeight: 0.136,
    titleX: 0.040625,
    titleY: 0.043,
  },
  text: {
    title: "ETHAN YANG",
    work: "WORK",
    talk: "MORE",
    thinking: "thinking?",
    cursor: "...|",
    titleSize: 70,
    headerTextOffsetY: 6,
    thinkingSize: 39,
    cursorSize: 35,
    thinkingOffsetXFromCircleCenter: -20,
    thinkingOffsetYFromCircleCenter: 50,
    cursorOffsetXFromPanelLeft: 15,
    cursorOffsetYFromPanelTop: 18,
  },
  typography: {
    hero: { ratio: 0.08, min: 30, max: 40, weight: 700, lineHeight: 1.04 },
    pageHeading: { ratio: 0.066, min: 25, max: 33, weight: 400, lineHeight: 1.02 },
    itemTitle: { ratio: 0.062, min: 24, max: 28, weight: 700, lineHeight: 1.02 },
    body: { ratio: 0.05, min: 20, max: 22, weight: 400, lineHeight: 1.34 },
    detail: { ratio: 0.041, min: 16.5, max: 18.5, weight: 400, lineHeight: 1.3 },
  },
  spacing: {
    afterHero: 22,
    afterPageHeading: { ratio: 1.1, min: 22, max: 28 },
    titleToDetail: { ratio: 0.58, min: 10, max: 12 },
    sectionGap: { ratio: 1.2, min: 18, max: 22 },
    afterBodyToLinks: { ratio: 1.05, min: 18, max: 24 },
    dividerWidthRatio: 0.35,
  },
  colors: {
    background: "#FAF7F3",
    line: "#C6C3BE",
    title: "#3A3530",
    headerLabel: "#B8B8B8",
    cursor: "#8F8A84",
    diamond: "#CFA39C",
    circle: "#8A99B7",
    thinking: "#B8B8B8",
    panel: "#EEEEEE",
  },
};

const svgNs = "http://www.w3.org/2000/svg";
const SANS_FONT = "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif";
const INITIAL_STATE: AppState = {
  page: "home",
  emailFeedback: null,
  workSection: "built",
};

// utilities

function toPx(value: number): number {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Composition constraint failed: ${message}`);
  }
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number): number {
  if (t < 0.5) {
    return 4 * t ** 3;
  }

  return 1 - (-2 * t + 2) ** 3 / 2;
}

function parseHexColor(color: string): [number, number, number] {
  const normalized = color.trim().replace("#", "");
  assert(normalized.length === 6, `Expected 6-digit hex color, received "${color}"`);

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return [red, green, blue];
}

function interpolateColor(from: string, to: string, t: number): string {
  const [fromR, fromG, fromB] = parseHexColor(from);
  const [toR, toG, toB] = parseHexColor(to);
  const mix = clamp01(t);
  const red = Math.round(fromR + (toR - fromR) * mix);
  const green = Math.round(fromG + (toG - fromG) * mix);
  const blue = Math.round(fromB + (toB - fromB) * mix);

  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function mixColor(base: string, accent: string, amount: number): string {
  return interpolateColor(base, accent, amount);
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.58;
}

function rotatePoint(point: Point, center: Point, angleDeg: number): Point {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

// animation helpers

function animate(options: AnimationOptions): () => void {
  const {
    duration,
    from,
    to,
    easing = (value: number) => value,
    onUpdate,
    onComplete,
  } = options;

  if (duration <= 0) {
    onUpdate(to, 1);
    onComplete?.();
    return () => undefined;
  }

  const host = globalThis;
  const start = host.performance.now();
  let frameId = 0;
  let active = true;

  const tick = (now: number): void => {
    if (!active) {
      return;
    }

    const progress = clamp01((now - start) / duration);
    const eased = easing(progress);
    const value = from + (to - from) * eased;
    onUpdate(value, progress);

    if (progress >= 1) {
      active = false;
      onComplete?.();
      return;
    }

    frameId = host.requestAnimationFrame(tick);
  };

  frameId = host.requestAnimationFrame(tick);

  return () => {
    active = false;
    host.cancelAnimationFrame(frameId);
  };
}

function runStepSequence<T>(
  frames: readonly T[],
  stepMs: number,
  apply: (frame: T) => void,
  onComplete?: () => void,
): () => void {
  if (frames.length === 0) {
    onComplete?.();
    return () => undefined;
  }

  const host = globalThis;
  let timeoutId: number | null = null;
  let index = 0;
  let active = true;

  const advance = (): void => {
    if (!active) {
      return;
    }

    apply(frames[index]);

    if (index === frames.length - 1) {
      onComplete?.();
      return;
    }

    index += 1;
    timeoutId = host.setTimeout(advance, stepMs);
  };

  advance();

  return () => {
    active = false;

    if (timeoutId !== null) {
      host.clearTimeout(timeoutId);
    }
  };
}

// layout and geometry

function deriveGeometry(spec: CompositionSpec): DerivedGeometry {
  const { width, height } = spec.reference;

  const header: Rect = {
    x: 0,
    y: 0,
    width: toPx(width * spec.ratios.headerWidth),
    height: toPx(height * spec.ratios.headerHeight),
  };

  const junction: Point = { x: header.width, y: header.height };

  const diagonalConst = junction.x + junction.y;
  const leftHit: Point = { x: 0, y: diagonalConst };

  const branchStartX = toPx(width * spec.ratios.branchStartX);
  const branchStart: Point = { x: branchStartX, y: diagonalConst - branchStartX };

  const branchIntercept = branchStart.y - branchStart.x;
  const branchEnd: Point = { x: height - branchIntercept, y: height };

  const diamondCenter: Point = {
    x: toPx(width * spec.ratios.diamondCenterX),
    y: toPx(height * spec.ratios.diamondCenterY),
  };
  const diamondHalfDiag = toPx(width * spec.ratios.diamondHalfDiag);

  const circleRadius = toPx(width * spec.ratios.circleRadius);
  const circleCenter: Point = {
    x: branchStart.x,
    y: leftHit.y + circleRadius,
  };

  const panel: Rect = {
    x:
      circleCenter.x -
      circleRadius +
      toPx(width * spec.ratios.panelOffsetXFromCircleLeft),
    y:
      circleCenter.y +
      circleRadius +
      toPx(height * spec.ratios.panelOffsetYFromCircleBottom),
    width: toPx(width * spec.ratios.panelWidth),
    height: toPx(height * spec.ratios.panelHeight),
  };

  const titlePos: Point = {
    x: toPx(width * spec.ratios.titleX),
    y: toPx(height * spec.ratios.titleY),
  };

  const thinkingPos: Point = {
    x: circleCenter.x + spec.text.thinkingOffsetXFromCircleCenter,
    y: circleCenter.y + spec.text.thinkingOffsetYFromCircleCenter,
  };

  const cursorPos: Point = {
    x: panel.x + spec.text.cursorOffsetXFromPanelLeft,
    y: panel.y + spec.text.cursorOffsetYFromPanelTop,
  };

  return {
    header,
    junction,
    leftHit,
    branchStart,
    branchEnd,
    diamondCenter,
    diamondHalfDiag,
    circleCenter,
    circleRadius,
    panel,
    titlePos,
    thinkingPos,
    cursorPos,
  };
}

function deriveContentBounds(g: DerivedGeometry): Bounds {
  const maxX = Math.max(
    g.header.width,
    g.branchEnd.x,
    g.diamondCenter.x + g.diamondHalfDiag,
    g.circleCenter.x + g.circleRadius,
    g.panel.x + g.panel.width,
  );
  const maxY = Math.max(
    g.branchEnd.y,
    g.circleCenter.y + g.circleRadius,
    g.panel.y + g.panel.height,
  );

  return {
    minX: 0,
    minY: 0,
    maxX,
    maxY,
    width: maxX,
    height: maxY,
  };
}

function deriveLayoutFrame(
  spec: CompositionSpec,
  viewport: Size,
  bounds: Bounds,
  geometry: DerivedGeometry,
): LayoutFrame {
  const rightGutter = clamp(
    viewport.width * spec.layout.rightGutterRatio,
    spec.layout.minRightGutter,
    spec.layout.maxRightGutter,
  );
  const fitScaleX = Math.max(1, viewport.width - rightGutter) / bounds.width;
  const endpointScaleY = viewport.height / geometry.branchEnd.y;
  const scale = Math.min(fitScaleX, endpointScaleY) * spec.layout.scale;

  return {
    viewport,
    scale,
  };
}

function validateConstraints(
  spec: CompositionSpec,
  g: DerivedGeometry,
  bounds: Bounds,
): void {
  const { width, height } = spec.reference;
  const panelBottom = g.panel.y + g.panel.height;

  assert(g.junction.x === g.header.width, "junction.x must equal header.width");
  assert(g.junction.y === g.header.height, "junction.y must equal header.height");

  const mainDiagConst = g.junction.x + g.junction.y;
  assert(g.leftHit.y === mainDiagConst, "main diagonal must hit left edge at x+y constant");
  assert(
    g.branchStart.x + g.branchStart.y === mainDiagConst,
    "branch start must lie on main diagonal",
  );

  assert(
    g.leftHit.y - g.junction.y === g.junction.x - g.leftHit.x,
    "main diagonal must be 45 degrees down-left",
  );

  assert(g.branchEnd.y === height, "branch must end on reference bottom edge");
  assert(
    g.branchEnd.y - g.branchStart.y === g.branchEnd.x - g.branchStart.x,
    "branch diagonal must be 45 degrees down-right",
  );

  assert(g.circleCenter.x === g.branchStart.x, "circle center x aligns with branch start x");
  assert(
    g.circleCenter.y - g.circleRadius === g.leftHit.y,
    "circle top aligns with main diagonal left intercept",
  );
  assert(panelBottom === g.branchEnd.y, "panel bottom must align with branch endpoint");
  assert(bounds.maxY === g.branchEnd.y, "branch endpoint must be the visual bottom");

  assert(bounds.maxX <= toPx(width * 0.42), "active cluster must stay in left ~42% of reference");
}

function getViewport(svg: SVGSVGElement): Size {
  const root = document.documentElement;

  return {
    width: Math.max(1, Math.round(root.clientWidth || svg.clientWidth || globalThis.innerWidth)),
    height: Math.max(1, Math.round(root.clientHeight || globalThis.innerHeight)),
  };
}

// svg helpers

function createSvgElement<T extends keyof SVGElementTagNameMap>(
  tag: T,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[T] {
  const node = document.createElementNS(svgNs, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    node.setAttribute(key, String(value));
  });
  return node;
}

function headerKeyToPage(key: HeaderBoxKey): PageKey {
  if (key === "name") {
    return "home";
  }

  return key;
}

function appendText(
  parent: SVGElement,
  x: number,
  y: number,
  text: string,
  style: TextStyle,
): SVGTextElement {
  const node = createSvgElement("text", {
    x,
    y,
    fill: style.fill,
    "font-family": style.fontFamily,
    "font-size": style.fontSize,
    "font-weight": style.fontWeight,
    "dominant-baseline": style.dominantBaseline ?? "hanging",
    "text-anchor": style.textAnchor ?? "start",
    "font-style": style.fontStyle ?? "normal",
    stroke: "none",
  });

  if (style.letterSpacing !== undefined) {
    node.setAttribute("letter-spacing", String(style.letterSpacing));
  }

  if (style.opacity !== undefined) {
    node.setAttribute("opacity", String(style.opacity));
  }

  node.textContent = text;
  parent.append(node);
  return node;
}

function appendTextLines(
  parent: SVGElement,
  x: number,
  startY: number,
  lines: readonly string[],
  style: TextStyle,
  lineHeight: number,
): number {
  let cursorY = startY;

  lines.forEach((line) => {
    if (line.length === 0) {
      cursorY += lineHeight;
      return;
    }

    appendText(parent, x, cursorY, line, style);
    cursorY += lineHeight;
  });

  return cursorY;
}

// icons

function renderEmailIcon(parent: SVGElement, color: string): void {
  const strokeAttrs = {
    fill: "none",
    stroke: color,
    "stroke-width": 1.7,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  };

  parent.append(
    createSvgElement("rect", {
      x: 2.75,
      y: 5.75,
      width: 18.5,
      height: 12.5,
      rx: 2.1,
      ...strokeAttrs,
    }),
    createSvgElement("path", {
      d: "M3.4 8.4L12 14.1L20.6 8.4",
      ...strokeAttrs,
    }),
  );
}

function renderXIcon(parent: SVGElement, color: string): void {
  parent.append(
    createSvgElement("path", {
      d: "M6 5L18 19",
      fill: "none",
      stroke: color,
      "stroke-width": 2.2,
      "stroke-linecap": "round",
    }),
    createSvgElement("path", {
      d: "M18 5L6 19",
      fill: "none",
      stroke: color,
      "stroke-width": 2.2,
      "stroke-linecap": "round",
    }),
  );
}

function renderLinkedInIcon(parent: SVGElement, color: string): void {
  const strokeAttrs = {
    fill: "none",
    stroke: color,
    "stroke-width": 1.8,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  };

  parent.append(
    createSvgElement("rect", {
      x: 2.5,
      y: 2.5,
      width: 18,
      height: 18,
      rx: 3.2,
      ...strokeAttrs,
    }),
  );

  const text = createSvgElement("text", {
    x: 11.4,
    y: 14.2,
    fill: color,
    "font-family": SANS_FONT,
    "font-size": 10.8,
    "font-weight": 700,
    "text-anchor": "middle",
    "dominant-baseline": "middle",
    "letter-spacing": -0.6,
    stroke: "none",
  });
  text.textContent = "in";
  parent.append(text);
}

function renderGitHubIcon(parent: SVGElement, color: string): void {
  parent.append(
    createSvgElement("path", {
      d: "M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10Z",
      fill: color,
      stroke: "none",
    }),
  );
}

// contact links (email, x, linkedin, github)

function appendContactLinks(
  parent: SVGElement,
  x: number,
  y: number,
  width: number,
  spec: CompositionSpec,
  feedback: ContactFeedback,
  onEmailCopy: () => void,
): number {
  const iconColor = mixColor(spec.colors.line, spec.colors.title, 0.76);
  const iconSize = clamp(width * 0.052, 18, 20);
  const gap = clamp(iconSize * 0.92, 14, 18);
  const hitInset = clamp(iconSize * 0.42, 6, 8);
  const baseOpacity = 0.78;
  let bottom = y + iconSize;
  const contacts: Array<
    | {
        kind: "button";
        label: string;
        title: string;
        onPress: () => void;
        renderIcon: (iconParent: SVGElement, color: string) => void;
      }
    | {
        kind: "link";
        href: string;
        label: string;
        title: string;
        external: boolean;
        renderIcon: (iconParent: SVGElement, color: string) => void;
      }
  > = [
    {
      kind: "button",
      label: "Copy Ethan's email address",
      title: "Copy eyanghq@gmail.com",
      onPress: onEmailCopy,
      renderIcon: renderEmailIcon,
    },
    {
      kind: "link",
      href: "https://x.com/ecommerce_y",
      label: "Open Ethan's X profile",
      title: "x.com/ecommerce_y",
      external: true,
      renderIcon: renderXIcon,
    },
    {
      kind: "link",
      href: "https://www.linkedin.com/in/eycyang/",
      label: "Open Ethan's LinkedIn profile",
      title: "linkedin.com/in/eycyang",
      external: true,
      renderIcon: renderLinkedInIcon,
    },
    {
      kind: "link",
      href: "https://github.com/ecommerce-y/",
      label: "Open Ethan's GitHub profile",
      title: "github.com/ecommerce-y",
      external: true,
      renderIcon: renderGitHubIcon,
    },
  ];

  contacts.forEach((contact, index) => {
    const title = createSvgElement("title", {});
    title.textContent = contact.title;

    const wrapper = createSvgElement("g", {
      transform: `translate(${x + index * (iconSize + gap)} ${y})`,
      opacity: index === 0 && feedback?.tone === "success" ? "1" : String(baseOpacity),
    });

    const hit = createSvgElement("rect", {
      x: -hitInset,
      y: -hitInset,
      width: iconSize + hitInset * 2,
      height: iconSize + hitInset * 2,
      rx: hitInset * 0.9,
      fill: spec.colors.background,
      "fill-opacity": 0,
      "pointer-events": "all",
    });

    const icon = createSvgElement("g", {
      transform: `scale(${(iconSize / 24).toFixed(4)})`,
    });
    contact.renderIcon(icon, iconColor);

    const setActive = (active: boolean): void => {
      if (index === 0 && feedback?.tone === "success" && !active) {
        wrapper.setAttribute("opacity", "1");
        return;
      }

      wrapper.setAttribute("opacity", active ? "1" : String(baseOpacity));
    };

    const attachSharedInteractionHandlers = (node: SVGElement): void => {
      node.addEventListener("pointerenter", () => {
        setActive(true);
      });
      node.addEventListener("pointerleave", () => {
        setActive(false);
      });
      node.addEventListener("focus", () => {
        setActive(true);
      });
      node.addEventListener("blur", () => {
        setActive(false);
      });
    };

    wrapper.append(hit, icon);

    if (contact.kind === "button") {
      const button = createSvgElement("g", {
        role: "button",
        tabindex: 0,
        focusable: "true",
        "aria-label": contact.label,
      });
      button.style.cursor = "pointer";

      const handleActivate = (): void => {
        contact.onPress();
      };
      const handleKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        handleActivate();
      };

      attachSharedInteractionHandlers(button);
      button.addEventListener("click", handleActivate);
      button.addEventListener("keydown", handleKeyDown);
      button.append(title, wrapper);
      parent.append(button);
      return;
    }

    const link = createSvgElement("a", {
      href: contact.href,
      "aria-label": contact.label,
      tabindex: 0,
      focusable: "true",
    });

    if (contact.external) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noreferrer noopener");
    }

    link.style.cursor = "pointer";
    attachSharedInteractionHandlers(link);
    link.append(title, wrapper);
    parent.append(link);
  });

  if (feedback !== null) {
    const statusY = y + iconSize + clamp(iconSize * 0.72, 10, 13);
    const statusLineWidth = clamp(iconSize * 0.72, 11, 14);
    const statusGap = clamp(iconSize * 0.34, 5, 7);
    const statusFontSize = clamp(width * 0.022, 10.5, 11.5);
    const statusColor =
      feedback.tone === "success"
        ? mixColor(spec.colors.line, spec.colors.title, 0.82)
        : mixColor(spec.colors.diamond, spec.colors.title, 0.42);

    parent.append(
      createSvgElement("line", {
        x1: x,
        y1: statusY + 6,
        x2: x + statusLineWidth,
        y2: statusY + 6,
        stroke: statusColor,
        "stroke-width": 1,
        opacity: 0.9,
        "vector-effect": "non-scaling-stroke",
      }),
    );

    appendText(
      parent,
      x + statusLineWidth + statusGap,
      statusY,
      feedback.tone === "success" ? "COPIED" : "COPY FAILED",
      {
        fill: statusColor,
        fontFamily: SANS_FONT,
        fontSize: statusFontSize,
        fontWeight: 600,
        letterSpacing: 1.4,
        opacity: 0.9,
      },
    );

    bottom = Math.max(bottom, statusY + statusFontSize);
  }

  return bottom;
}

// typography resolution

function resolveTypeRole(role: TypeRole, width: number): ResolvedType {
  return {
    size: clamp(width * role.ratio, role.min, role.max),
    weight: role.weight,
    lineHeight: role.lineHeight,
  };
}

function resolveSpacing(token: SpacingToken, baseSize: number): number {
  return clamp(baseSize * token.ratio, token.min, token.max);
}

function deriveContentTypography(
  width: number,
  spec: CompositionSpec,
): ContentTypography {
  const hero = resolveTypeRole(spec.typography.hero, width);
  const pageHeading = resolveTypeRole(spec.typography.pageHeading, width);
  const itemTitle = resolveTypeRole(spec.typography.itemTitle, width);
  const body = resolveTypeRole(spec.typography.body, width);
  const detail = resolveTypeRole(spec.typography.detail, width);

  return {
    hero,
    pageHeading,
    itemTitle,
    body,
    detail,
    colors: {
      body: spec.colors.title,
      detail: mixColor(spec.colors.background, spec.colors.title, 0.55),
      divider: mixColor(spec.colors.background, spec.colors.title, 0.18),
    },
    gap: {
      afterHero: spec.spacing.afterHero,
      afterPageHeading: resolveSpacing(spec.spacing.afterPageHeading, body.size),
      titleToDetail: resolveSpacing(spec.spacing.titleToDetail, detail.size),
      sectionGap: resolveSpacing(spec.spacing.sectionGap, detail.size),
      afterBodyToLinks: resolveSpacing(spec.spacing.afterBodyToLinks, body.size),
    },
    dividerWidth: width * spec.spacing.dividerWidthRatio,
  };
}

function deriveInfoLayout(
  frame: LayoutFrame,
  bounds: Bounds,
  geometry: DerivedGeometry,
  headerHeight: number,
  spec: CompositionSpec,
  page: PageKey,
): InfoLayout {
  const edgePad = clamp(frame.viewport.width * 0.045, 24, 72);
  const gap = clamp(frame.viewport.width * 0.046, 52, 76);
  const preferredWidth = clamp(frame.viewport.width * 0.29, 360, 420);
  const diamondRight = (geometry.diamondCenter.x + geometry.diamondHalfDiag) * frame.scale;
  const sideX = diamondRight + gap;
  const sideWidth = frame.viewport.width - sideX - edgePad;
  const headerOverlaps = headerHeight > 0 && (geometry.header.width * frame.scale) > (frame.viewport.width - (geometry.header.width * frame.scale));
  const sideFits = sideWidth >= 330 && !headerOverlaps;

  if (sideFits) {
    const w = Math.min(sideWidth, preferredWidth);
    const typo = deriveContentTypography(w, spec);
    const diamondCenterPx = geometry.diamondCenter.y * frame.scale;
    const ph = typo.pageHeading.size * typo.pageHeading.lineHeight;
    const it = typo.itemTitle.size * typo.itemTitle.lineHeight;
    const dl = typo.detail.size * typo.detail.lineHeight;
    const apH = typo.gap.afterPageHeading;
    const ttd = typo.gap.titleToDetail;
    const sg = typo.gap.sectionGap;
    let anchorOffset: number;

    if (page === "home") {
      anchorOffset =
        typo.hero.size * typo.hero.lineHeight +
        typo.gap.afterHero +
        typo.body.size * typo.body.lineHeight;
    } else if (page === "work") {
      anchorOffset = ph + apH + it + ttd + dl + sg;
    } else {
      anchorOffset = ph + apH + (it + ttd + dl) + sg;
    }

    const idealY = diamondCenterPx - anchorOffset;

    const minY = headerHeight + clamp(frame.viewport.height * 0.04, 32, 48);

    return {
      x: sideX,
      y: Math.max(minY, idealY),
      width: w,
      availableWidth: sideWidth,
      diamondCenterY: diamondCenterPx,
      mobile: false,
    };
  }

  const mobileWidth = clamp(frame.viewport.width * 0.7, 280, 420);
  const mobileX = (frame.viewport.width - mobileWidth) / 2;
  const mobileY = headerHeight + clamp(frame.viewport.height * 0.06, 32, 60);

  return {
    x: mobileX,
    y: mobileY,
    width: mobileWidth,
    availableWidth: mobileWidth,
    diamondCenterY: geometry.diamondCenter.y * frame.scale,
    mobile: true,
  };
}

// page content (home, work, more)

function renderManifestoPreview(
  parent: SVGElement,
  layout: InfoLayout,
  state: AppState,
  spec: CompositionSpec,
  onEmailCopy: () => void,
  onWorkSectionToggle: () => void,
): number {
  const t = deriveContentTypography(layout.width, spec);
  const x = layout.x;
  let cursorY = layout.y;

  if (state.page === "home") {
    cursorY = appendTextLines(
      parent,
      x,
      cursorY,
      ["Hello. I'm Ethan."],
      {
        fill: t.colors.body,
        fontFamily: SANS_FONT,
        fontSize: t.hero.size,
        fontWeight: t.hero.weight,
      },
      t.hero.size * t.hero.lineHeight,
    );
    cursorY += t.gap.afterHero;
    cursorY = appendTextLines(
      parent,
      x,
      cursorY,
      [
        "I build and write at Cornell.",
        "Interviewed at YC, published in The Concord Review.",
      ],
      {
        fill: t.colors.body,
        fontFamily: SANS_FONT,
        fontSize: t.body.size,
        fontWeight: t.body.weight,
      },
      t.body.size * t.body.lineHeight,
    );
    cursorY += t.gap.afterBodyToLinks;
    return appendContactLinks(parent, x, cursorY, layout.width, spec, state.emailFeedback, onEmailCopy);
  }

  if (state.page === "work") {
    const projects: Array<{
      nameLines: string[];
      detail: string[];
      link?: string;
    }> = [
      {
        nameLines: ["HSPorter"],
        detail: ["AI for trade compliance.", "Interviewed at YC."],
        link: "https://www.youtube.com/watch?v=cyPW32r1W-E",
      },
      {
        nameLines: ["Ideas of NYC"],
        detail: ["Visualizing $65M in participatory budgeting.", "Deploying with NYC gov."],
        link: "https://ionyc.netlify.app/",
      },
      ...(layout.mobile
        ? [
            {
              nameLines: ["Armada"],
              detail: ["armada.build"],
              link: "https://armada.build/",
            },
            {
              nameLines: ["Cornell Claude", "Club"],
              detail: ["cornellclaude.club"],
              link: "https://cornellclaude.club/",
            },
          ]
        : []),
    ];

    const publications: Array<{
      nameLines: string[];
      detail: string[];
      link?: string;
    }> = [
      {
        nameLines: ["Lessons from Watergate"],
        detail: ["On the incentives of institutions.", "The Concord Review, Spring '24."],
        link: "./lessons-from-watergate.pdf",
      },
      {
        nameLines: ["Canada's Road to Serfdom"],
        detail: ["On regulation of markets and society.", "Canadian Student Review, Fall '23."],
        link: "./canadas-road-to-serfdom.pdf",
      },
    ];

    const isBuilt = state.workSection === "built";
    const items = isBuilt ? projects : publications;
    const heading = isBuilt ? "Things I've built." : "Things I've published.";
    const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    const headingGroup = createSvgElement("g", { opacity: reducedMotion ? 1 : 0 });
    cursorY = appendTextLines(
      headingGroup,
      x,
      cursorY,
      [heading],
      {
        fill: t.colors.body,
        fontFamily: SANS_FONT,
        fontSize: t.pageHeading.size,
        fontWeight: t.pageHeading.weight,
      },
      t.pageHeading.size * t.pageHeading.lineHeight,
    );
    cursorY += t.gap.afterPageHeading;
    parent.append(headingGroup);

    if (!reducedMotion) {
      animate({
        duration: 180,
        from: 0,
        to: 1,
        easing: easeOutCubic,
        onUpdate: (value) => {
          headingGroup.setAttribute("opacity", value.toFixed(3));
          headingGroup.setAttribute("transform", `translate(0 ${((1 - value) * 10).toFixed(2)})`);
        },
        onComplete: () => {
          headingGroup.removeAttribute("transform");
        },
      });
    }

    items.forEach((item, index) => {
      const itemGroup = createSvgElement("g", { opacity: reducedMotion ? 1 : 0 });

      if (item.link) {
        const link = createSvgElement("a", {
          href: item.link,
          target: "_blank",
          rel: "noreferrer noopener",
        });
        link.style.cursor = "pointer";
        const linkGroup = createSvgElement("g", {});
        cursorY = appendTextLines(
          linkGroup,
          x,
          cursorY,
          item.nameLines,
          {
            fill: t.colors.body,
            fontFamily: SANS_FONT,
            fontSize: t.itemTitle.size,
            fontWeight: t.itemTitle.weight,
          },
          t.itemTitle.size * t.itemTitle.lineHeight,
        );
        link.append(linkGroup);
        itemGroup.append(link);
      } else {
        cursorY = appendTextLines(
          itemGroup,
          x,
          cursorY,
          item.nameLines,
          {
            fill: t.colors.body,
            fontFamily: SANS_FONT,
            fontSize: t.itemTitle.size,
            fontWeight: t.itemTitle.weight,
          },
          t.itemTitle.size * t.itemTitle.lineHeight,
        );
      }

      cursorY += t.gap.titleToDetail;
      appendTextLines(
        itemGroup,
        x,
        cursorY,
        item.detail,
        {
          fill: t.colors.body,
          fontFamily: SANS_FONT,
          fontSize: t.detail.size,
          fontWeight: t.detail.weight,
        },
        t.detail.size * t.detail.lineHeight,
      );
      cursorY += t.detail.size * t.detail.lineHeight * item.detail.length;

      if (index < items.length - 1) {
        cursorY += t.gap.sectionGap;
        itemGroup.append(
          createSvgElement("line", {
            x1: x,
            y1: cursorY,
            x2: x + t.dividerWidth,
            y2: cursorY,
            stroke: t.colors.divider,
            "stroke-width": 1,
          }),
        );
        cursorY += t.gap.sectionGap;
      }

      parent.append(itemGroup);

      if (!reducedMotion) {
        const delay = 40 + index * 40;
        globalThis.setTimeout(() => {
          animate({
            duration: 200,
            from: 0,
            to: 1,
            easing: easeOutCubic,
            onUpdate: (value) => {
              itemGroup.setAttribute("opacity", value.toFixed(3));
              itemGroup.setAttribute("transform", `translate(0 ${((1 - value) * 12).toFixed(2)})`);
            },
            onComplete: () => {
              itemGroup.removeAttribute("transform");
            },
          });
        }, delay);
      }
    });

    cursorY += t.gap.sectionGap * 1.5;
    const chevronSize = clamp(t.detail.size * 0.6, 8, 12);
    const chevronY = cursorY;
    const chevronColor = mixColor(spec.colors.line, spec.colors.title, 0.4);
    const dotRadius = clamp(t.detail.size * 0.14, 2.5, 3.5);
    const dotGap = dotRadius * 3;
    const dotY = chevronY + chevronSize / 2;

    [0, 1].forEach((i) => {
      const isActive = (i === 0 && isBuilt) || (i === 1 && !isBuilt);
      parent.append(
        createSvgElement("circle", {
          cx: x + i * dotGap,
          cy: dotY,
          r: dotRadius,
          fill: isActive ? chevronColor : "none",
          stroke: chevronColor,
          "stroke-width": 1,
        }),
      );
    });

    const chevronX = x + dotGap + dotGap * 1.5;
    const chevronGroup = createSvgElement("g", {});
    chevronGroup.append(
      createSvgElement("line", {
        x1: chevronX,
        y1: chevronY,
        x2: chevronX + chevronSize * 0.6,
        y2: chevronY + chevronSize / 2,
        stroke: chevronColor,
        "stroke-width": 1.5,
        "stroke-linecap": "round",
      }),
      createSvgElement("line", {
        x1: chevronX + chevronSize * 0.6,
        y1: chevronY + chevronSize / 2,
        x2: chevronX,
        y2: chevronY + chevronSize,
        stroke: chevronColor,
        "stroke-width": 1.5,
        "stroke-linecap": "round",
      }),
    );
    parent.append(chevronGroup);

    let transitioning = false;
    const chevronButton = createSvgElement("g", {
      role: "button",
      "aria-label": isBuilt ? "View publications" : "View projects",
    });
    chevronButton.style.cursor = "pointer";
    chevronButton.style.outline = "none";

    const hitPad = 12;
    const hit = createSvgElement("rect", {
      x: x - hitPad,
      y: chevronY - hitPad,
      width: chevronX + chevronSize * 0.6 + hitPad - x + hitPad,
      height: chevronSize + hitPad * 2,
      fill: "transparent",
      "pointer-events": "all",
    });

    const triggerToggle = (): void => {
      if (transitioning) return;
      transitioning = true;
      if (!reducedMotion) {
        animate({
          duration: 120,
          from: 0,
          to: 1,
          easing: easeOutCubic,
          onUpdate: (_value: number, raw: number) => {
            const bounce = Math.sin(raw * Math.PI * 1.5) * (1 - raw);
            chevronGroup.setAttribute("transform", `translate(${(bounce * 4).toFixed(2)} 0)`);
          },
          onComplete: () => {
            onWorkSectionToggle();
          },
        });
      } else {
        onWorkSectionToggle();
      }
    };

    hit.addEventListener("click", triggerToggle);
    hit.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        triggerToggle();
      }
    });

    chevronButton.append(hit);
    parent.append(chevronButton);
    return chevronY + chevronSize + hitPad;
  }

  cursorY = appendTextLines(
    parent,
    x,
    cursorY,
    ["A few things I like."],
    {
      fill: t.colors.body,
      fontFamily: SANS_FONT,
      fontSize: t.pageHeading.size,
      fontWeight: t.pageHeading.weight,
    },
    t.pageHeading.size * t.pageHeading.lineHeight,
  );
  cursorY += t.gap.afterPageHeading;

  const sections: Array<{
    label: string;
    items: Array<{ title: string; detail?: string; image?: string; link?: string }>;
  }> = [
    {
      label: "Favorite artist",
      items: [{ title: "Theo van Doesburg", image: "composition.webp", link: "https://www.moma.org/artists/6076-theo-van-doesburg" }],
    },
    {
      label: "Favorite music",
      items: [
        { title: "Homage", detail: "Mild High Club", link: "https://open.spotify.com/track/7DcJ6fEBb7BaKuYKTwiDxK" },
        { title: "Juna", detail: "Clairo", link: "https://open.spotify.com/track/2mWfVxEo4xZYDaz0v7hYrN" },
        { title: "Ballade No. 1 in G Minor", detail: "Chopin", link: "https://open.spotify.com/track/5Ks5ENUFNQDfaqxjZnCkVJ" },
      ],
    },
    {
      label: "Favorite books",
      items: [
        { title: "The Road to Serfdom", detail: "Hayek" },
        { title: "On Liberty", detail: "Mill" },
        { title: "Team of Rivals", detail: "Goodwin" },
      ],
    },
  ];

  let firstSectionTitleY = 0;
  const pendingImages: Array<{ src: string; hitY: number; hitTitle: string; link?: string }> = [];
  let maxBottom = cursorY;

  sections.forEach(({ label, items }, index) => {
    if (index === 0) firstSectionTitleY = cursorY;
    cursorY = appendTextLines(
      parent,
      x,
      cursorY,
      [label],
      {
        fill: t.colors.body,
        fontFamily: SANS_FONT,
        fontSize: t.itemTitle.size,
        fontWeight: t.itemTitle.weight,
      },
      t.itemTitle.size * t.itemTitle.lineHeight,
    );
    cursorY += t.gap.titleToDetail;

    const lineH = t.detail.size * t.detail.lineHeight;
    const sectionTopY = cursorY;
    const sectionHeight = items.length * lineH;
    const embedHeight = 80;
    const embedAnchorY = sectionTopY + (sectionHeight - embedHeight) / 2;

    let activeOverlay: HTMLDivElement | null = null;
    let activeTitle: SVGTextElement | null = null;
    let activeDetail: SVGTextElement | null = null;
    let outsideListener: ((e: MouseEvent) => void) | null = null;

    const dismissEmbed = (): void => {
      if (activeOverlay) {
        activeOverlay.remove();
        activeOverlay = null;
      }
      if (activeTitle) {
        activeTitle.setAttribute("visibility", "visible");
        activeTitle = null;
      }
      if (activeDetail) {
        activeDetail.setAttribute("visibility", "visible");
        activeDetail = null;
      }
      if (outsideListener) {
        document.removeEventListener("pointerdown", outsideListener, true);
        outsideListener = null;
      }
    };

    items.forEach((item) => {
      let titleNode: SVGTextElement;
      let detailNode: SVGTextElement | null = null;

      if (item.detail) {
        const combined = createSvgElement("text", {
          x,
          y: cursorY,
          fill: t.colors.body,
          "font-family": SANS_FONT,
          "font-size": t.detail.size,
          "font-weight": t.detail.weight,
          "dominant-baseline": "hanging",
        });

        const titleSpan = document.createElementNS(svgNs, "tspan");
        titleSpan.textContent = `${item.title}, `;
        combined.append(titleSpan);

        const detailSpan = document.createElementNS(svgNs, "tspan");
        detailSpan.textContent = item.detail;
        detailSpan.setAttribute("fill", t.colors.body);
        detailSpan.setAttribute("font-style", "italic");
        combined.append(detailSpan);

        parent.append(combined);
        titleNode = combined;
        detailNode = combined;
      } else {
        titleNode = appendText(parent, x, cursorY, item.title, {
          fill: t.colors.body,
          fontFamily: SANS_FONT,
          fontSize: t.detail.size,
          fontWeight: t.detail.weight,
        });
      }

      if (item.link) {
        const trackId = item.link.split("/track/")[1]?.split("?")[0];
        if (trackId) {
          const hitPad = 4;

          const hit = createSvgElement("rect", {
            x: x - hitPad,
            y: cursorY - hitPad,
            width: layout.width + hitPad * 2,
            height: lineH + hitPad * 2,
            fill: "transparent",
            "pointer-events": "all",
          });
          hit.style.cursor = "pointer";
          parent.append(hit);

          hit.addEventListener("click", (e) => {
            e.stopPropagation();
            const svg = parent.closest("svg") as SVGSVGElement | null;
            if (!svg) return;

            const wasActive = activeOverlay !== null && activeTitle === titleNode;
            dismissEmbed();
            if (wasActive) return;

            titleNode.setAttribute("visibility", "hidden");
            if (detailNode) detailNode.setAttribute("visibility", "hidden");
            activeTitle = titleNode;
            activeDetail = detailNode;

            const svgRect = svg.getBoundingClientRect();
            const vb = svg.viewBox.baseVal;
            const scaleX = svgRect.width / vb.width;
            const scaleY = svgRect.height / vb.height;

            const overlay = document.createElement("div");
            overlay.setAttribute("data-spotify-overlay", "");
            overlay.style.cssText = `
              position: fixed;
              left: ${svgRect.left + x * scaleX}px;
              top: ${svgRect.top + embedAnchorY * scaleY - 2}px;
              width: ${layout.width * scaleX}px;
              height: ${embedHeight}px;
              z-index: 10;
              pointer-events: auto;
            `;

            const iframe = document.createElement("iframe");
            iframe.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;
            iframe.allow = "autoplay; clipboard-write; encrypted-media";
            iframe.style.cssText = `
              border: none;
              width: 100%;
              height: 100%;
              border-radius: 8px;
            `;

            overlay.append(iframe);
            document.body.append(overlay);
            activeOverlay = overlay;

            outsideListener = (ev: MouseEvent) => {
              if (overlay.contains(ev.target as Node)) return;
              dismissEmbed();
            };
            requestAnimationFrame(() => {
              document.addEventListener("pointerdown", outsideListener!, true);
            });
          });
        }
      }

      if (item.image) {
        pendingImages.push({ src: item.image, hitY: cursorY, hitTitle: item.title, link: item.link });
      }

      cursorY += t.detail.size * t.detail.lineHeight;
    });

    if (index < sections.length - 1) {
      cursorY += t.gap.sectionGap;
      const lineY = cursorY;
      parent.append(
        createSvgElement("line", {
          x1: x,
          y1: lineY,
          x2: x + t.dividerWidth,
          y2: lineY,
          stroke: t.colors.divider,
          "stroke-width": 1,
        }),
      );
      cursorY += t.gap.sectionGap;
    }
  });

  pendingImages.forEach((img) => {
    const imgTopY = firstSectionTitleY;
    const imgBottomY = cursorY;
    let imgSize: number;
    let imgX: number;
    let imgY: number;

    if (layout.mobile) {
      imgSize = layout.width * 0.7;
      imgX = x + (layout.width - imgSize) / 2;
      imgY = imgBottomY + t.gap.afterPageHeading;
    } else {
      imgSize = imgBottomY - imgTopY;
      const imgGap = clamp(layout.width * 0.12, 36, 60);
      imgX = x + layout.width + imgGap;
      imgY = imgTopY;
    }

    const preview = createSvgElement("image", {
      href: img.src,
      x: imgX,
      y: imgY,
      width: imgSize,
      height: imgSize,
      opacity: 0,
      preserveAspectRatio: "xMidYMid slice",
    });
    preview.style.transition = "opacity 0.25s ease";
    preview.style.pointerEvents = "none";
    parent.append(preview);

    const hitPad = 4;
    const hit = createSvgElement("rect", {
      x: x - hitPad,
      y: img.hitY - hitPad,
      width: estimateTextWidth(img.hitTitle, t.detail.size) + hitPad * 2,
      height: t.detail.size * t.detail.lineHeight + hitPad * 2,
      fill: "transparent",
      "pointer-events": "all",
    });
    hit.style.cursor = "pointer";
    let tapped = false;
    hit.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "touch") {
        preview.setAttribute("opacity", "1");
      }
    });
    hit.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "touch") {
        preview.setAttribute("opacity", "0");
      }
    });
    hit.addEventListener("click", () => {
      if (img.link) {
        window.open(img.link, "_blank", "noopener");
      } else {
        tapped = !tapped;
        preview.setAttribute("opacity", tapped ? "1" : "0");
      }
    });
    parent.append(hit);
    maxBottom = Math.max(maxBottom, imgY + imgSize);
  });

  return Math.max(maxBottom, cursorY);
}

// main render, builds full svg each frame

function render(
  spec: CompositionSpec,
  svg: SVGSVGElement,
  state: AppState,
  onEmailCopy: () => void,
  onWorkSectionToggle: () => void,
): InteractionRefs {
  const geometry = deriveGeometry(spec);
  const bounds = deriveContentBounds(geometry);
  validateConstraints(spec, geometry, bounds);

  const frame = deriveLayoutFrame(spec, getViewport(svg), bounds, geometry);
  const strokeWidth = clamp(frame.scale * 1.2, 1, 1.6);
  const headerHeightEarly = geometry.header.height * frame.scale;
  const infoLayout = deriveInfoLayout(frame, bounds, geometry, headerHeightEarly, spec, state.page);
  svg.replaceChildren();
  document.querySelectorAll("[data-spotify-overlay]").forEach((el) => el.remove());

  const defs = createSvgElement("defs", {});
  const thinkingBlur = createSvgElement("filter", {
    id: "thinking-soften",
    x: "-20%",
    y: "-20%",
    width: "140%",
    height: "140%",
  });
  thinkingBlur.append(
    createSvgElement("feGaussianBlur", {
      stdDeviation: 0.8,
    }),
  );
  defs.append(thinkingBlur);

  const isMobile = infoLayout.mobile;
  const headerHeight = geometry.header.height * frame.scale;
  const desktopHeaderWidth = geometry.header.width * frame.scale;
  const headerWidth = isMobile ? frame.viewport.width * 0.5 : desktopHeaderWidth;
  const headerSectionWidth = isMobile ? frame.viewport.width * 0.25 : headerWidth / 2;
  const headerLabelPadXRatio = geometry.titlePos.x / geometry.header.width;
  const headerLabelXOffset = headerSectionWidth * headerLabelPadXRatio;
  const headerLabelY = headerHeight / 2 + spec.text.headerTextOffsetY * frame.scale;
  const headerLabelSize = isMobile
    ? clamp(frame.viewport.width * 0.06, 24, 44)
    : spec.text.titleSize * frame.scale;
  const headerFill = spec.colors.title;
  const nameIdleFill = mixColor(spec.colors.headerLabel, spec.colors.title, 0.25);
  const activeNameFill = spec.colors.title;
  const boxIdleFill = mixColor(spec.colors.headerLabel, spec.colors.title, 0.1);
  const activeBoxFill = mixColor(spec.colors.headerLabel, spec.colors.title, 0.62);

  const headerBoxRefs: HeaderBoxRefs[] = [];
  const headerBoxes = createSvgElement("g", {});

  const headerSpecs: Array<{
    key: HeaderBoxKey;
    label: string;
    box: Rect;
    labelX: number;
    labelY: number;
    baseFill: string;
  }> = [
    {
      key: "name",
      label: spec.text.title,
      box: { x: 0, y: 0, width: headerWidth, height: headerHeight },
      labelX: geometry.titlePos.x * frame.scale,
      labelY: headerLabelY,
      baseFill: state.page === "home" ? activeNameFill : nameIdleFill,
    },
    {
      key: "work",
      label: spec.text.work,
      box: {
        x: frame.viewport.width - headerSectionWidth * 2,
        y: 0,
        width: headerSectionWidth,
        height: headerHeight,
      },
      labelX: frame.viewport.width - headerSectionWidth * 2 + headerLabelXOffset,
      labelY: headerLabelY,
      baseFill: state.page === "work" ? activeBoxFill : boxIdleFill,
    },
    {
      key: "talk",
      label: spec.text.talk,
      box: {
        x: frame.viewport.width - headerSectionWidth,
        y: 0,
        width: headerSectionWidth,
        height: headerHeight,
      },
      labelX: frame.viewport.width - headerSectionWidth + headerLabelXOffset,
      labelY: headerLabelY,
      baseFill: state.page === "talk" ? activeBoxFill : boxIdleFill,
    },
  ];

  headerSpecs.forEach(({ key, label, box, labelX, labelY, baseFill }) => {
    const clipId = `header-box-${key}-clip`;
    const clipRect = createSvgElement("rect", {
      x: box.x,
      y: box.y,
      width: 0,
      height: box.height,
    });
    const clipPath = createSvgElement("clipPath", {
      id: clipId,
    });
    clipPath.append(clipRect);
    defs.append(clipPath);

    const boxGroup = createSvgElement("g", {});
    const fill = createSvgElement("rect", {
      x: box.x,
      y: box.y,
      width: 0,
      height: box.height,
      fill: headerFill,
      opacity: 0,
    });

    const baseText = createSvgElement("text", {
      x: labelX,
      y: labelY,
      fill: baseFill,
      "font-family": "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
      "font-size": headerLabelSize,
      "font-weight": 700,
      "dominant-baseline": "middle",
      stroke: "none",
    });
    baseText.textContent = label;

    const revealText = createSvgElement("text", {
      x: labelX,
      y: labelY,
      fill: spec.colors.background,
      "font-family": "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
      "font-size": headerLabelSize,
      "font-weight": 700,
      "dominant-baseline": "middle",
      stroke: "none",
      "clip-path": `url(#${clipId})`,
    });
    revealText.textContent = label;

    const border = createSvgElement("rect", {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      fill: "none",
      stroke: mixColor(spec.colors.line, spec.colors.title, 0.72),
      "stroke-width": strokeWidth,
      opacity: 0,
      "vector-effect": "non-scaling-stroke",
    });

    const hit = createSvgElement("rect", {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      fill: spec.colors.background,
      "fill-opacity": 0,
      "pointer-events": "all",
    });
    hit.style.cursor = "pointer";

    boxGroup.append(fill, baseText, revealText, border, hit);
    headerBoxes.append(boxGroup);
    headerBoxRefs.push({
      key,
      box,
      fill,
      clipRect,
      border,
      hit,
    });
  });

  const headerOutline = createSvgElement("g", {
    stroke: spec.colors.line,
    "stroke-width": strokeWidth,
    fill: "none",
  });

  const headerLines: Array<[Point, Point]> = [
    [{ x: 0, y: headerHeight }, { x: frame.viewport.width, y: headerHeight }],
    [{ x: headerWidth, y: 0 }, { x: headerWidth, y: headerHeight }],
    [
      { x: frame.viewport.width - headerSectionWidth * 2, y: 0 },
      { x: frame.viewport.width - headerSectionWidth * 2, y: headerHeight },
    ],
    [
      { x: frame.viewport.width - headerSectionWidth, y: 0 },
      { x: frame.viewport.width - headerSectionWidth, y: headerHeight },
    ],
  ];

  headerLines.forEach(([start, end]) => {
    headerOutline.append(
      createSvgElement("line", {
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        "vector-effect": "non-scaling-stroke",
      }),
    );
  });

  const contentGroup = createSvgElement("g", {
    transform: `scale(${frame.scale})`,
  });
  const infoGroup = createSvgElement("g", {});

  const structureGroup = createSvgElement("g", {
    stroke: spec.colors.line,
    "stroke-width": strokeWidth,
    fill: "none",
  });

  const structuralLines: Array<[Point, Point]> = [[geometry.junction, geometry.leftHit]];

  structuralLines.forEach(([start, end]) => {
    structureGroup.append(
      createSvgElement("line", {
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        "vector-effect": "non-scaling-stroke",
      }),
    );
  });

  const boatGroup = createSvgElement("g", {});
  const boatLine = createSvgElement("line", {
    x1: geometry.branchStart.x,
    y1: geometry.branchStart.y,
    x2: geometry.branchEnd.x,
    y2: geometry.branchEnd.y,
    stroke: spec.colors.line,
    "stroke-width": strokeWidth,
    "vector-effect": "non-scaling-stroke",
  });
  const boatHit = createSvgElement("line", {
    x1: geometry.branchStart.x,
    y1: geometry.branchStart.y,
    x2: geometry.branchEnd.x,
    y2: geometry.branchEnd.y,
    stroke: spec.colors.background,
    "stroke-opacity": 0,
    "stroke-width": 28,
    "stroke-linecap": "round",
    "pointer-events": "stroke",
    "vector-effect": "non-scaling-stroke",
  });
  boatGroup.append(boatLine, boatHit);

  const diamondPoints = [
    `${geometry.diamondCenter.x},${geometry.diamondCenter.y - geometry.diamondHalfDiag}`,
    `${geometry.diamondCenter.x + geometry.diamondHalfDiag},${geometry.diamondCenter.y}`,
    `${geometry.diamondCenter.x},${geometry.diamondCenter.y + geometry.diamondHalfDiag}`,
    `${geometry.diamondCenter.x - geometry.diamondHalfDiag},${geometry.diamondCenter.y}`,
  ].join(" ");

  const diamondLink = createSvgElement("a", {
    href: "https://armada.build/",
    target: "_blank",
    rel: "noreferrer noopener",
  });
  const diamondGroup = createSvgElement("g", {});
  const diamond = createSvgElement("polygon", {
    points: diamondPoints,
    fill: spec.colors.diamond,
  });

  const diamondHit = createSvgElement("rect", {
    x: geometry.diamondCenter.x - geometry.diamondHalfDiag - 10,
    y: geometry.diamondCenter.y - geometry.diamondHalfDiag - 10,
    width: geometry.diamondHalfDiag * 2 + 20,
    height: geometry.diamondHalfDiag * 2 + 20,
    fill: spec.colors.background,
    "fill-opacity": 0,
    "pointer-events": "all",
  });
  diamondHit.style.cursor = "pointer";

  diamondGroup.append(diamond, diamondHit);
  diamondLink.append(diamondGroup);

  const signalLink = createSvgElement("a", {
    href: "https://cornellclaude.club/",
    target: "_blank",
    rel: "noreferrer noopener",
  });
  const signalGroup = createSvgElement("g", {});
  const thinkingWidth = estimateTextWidth(spec.text.thinking, spec.text.thinkingSize);
  const signalBounds: Rect = {
    x: Math.min(
      geometry.circleCenter.x - geometry.circleRadius * 1.7,
      geometry.thinkingPos.x - spec.text.thinkingSize * 0.2,
    ),
    y: geometry.circleCenter.y - geometry.circleRadius * 1.7,
    width:
      geometry.thinkingPos.x +
      thinkingWidth -
      Math.min(
        geometry.circleCenter.x - geometry.circleRadius * 1.7,
        geometry.thinkingPos.x - spec.text.thinkingSize * 0.2,
      ),
    height:
      geometry.thinkingPos.y +
      spec.text.thinkingSize * 0.7 -
      (geometry.circleCenter.y - geometry.circleRadius * 1.7),
  };

  const halo = createSvgElement("circle", {
    cx: geometry.circleCenter.x,
    cy: geometry.circleCenter.y,
    r: geometry.circleRadius * 1.08,
    fill: "none",
    stroke: spec.colors.circle,
    "stroke-width": 2,
    opacity: 0,
    "vector-effect": "non-scaling-stroke",
  });

  const circle = createSvgElement("circle", {
    cx: geometry.circleCenter.x,
    cy: geometry.circleCenter.y,
    r: geometry.circleRadius,
    fill: spec.colors.circle,
  });

  const thinkingSoft = createSvgElement("text", {
    x: geometry.thinkingPos.x,
    y: geometry.thinkingPos.y,
    fill: spec.colors.thinking,
    opacity: 0.78,
    filter: "url(#thinking-soften)",
    "font-family": "'Cormorant Garamond', Georgia, serif",
    "font-size": spec.text.thinkingSize,
    "font-weight": 500,
    "letter-spacing": 1,
  });
  thinkingSoft.textContent = spec.text.thinking;

  const thinkingCrisp = createSvgElement("text", {
    x: geometry.thinkingPos.x,
    y: geometry.thinkingPos.y,
    fill: mixColor(spec.colors.thinking, spec.colors.title, 0.12),
    opacity: 0.18,
    "font-family": "'Cormorant Garamond', Georgia, serif",
    "font-size": spec.text.thinkingSize,
    "font-weight": 500,
    "letter-spacing": 0.35,
  });
  thinkingCrisp.textContent = spec.text.thinking;

  const signalHit = createSvgElement("rect", {
    x: signalBounds.x,
    y: signalBounds.y,
    width: signalBounds.width,
    height: signalBounds.height,
    fill: spec.colors.background,
    "fill-opacity": 0,
    "pointer-events": "all",
  });

  signalHit.style.cursor = "pointer";
  signalGroup.append(halo, circle, thinkingSoft, thinkingCrisp, signalHit);
  signalLink.append(signalGroup);

  const terminalGroup = createSvgElement("g", {});
  const panel = createSvgElement("rect", {
    x: geometry.panel.x,
    y: geometry.panel.y,
    width: geometry.panel.width,
    height: geometry.panel.height,
    fill: spec.colors.panel,
    "shape-rendering": "crispEdges",
  });

  const cursor = createSvgElement("text", {
    x: geometry.cursorPos.x,
    y: geometry.cursorPos.y,
    fill: spec.colors.cursor,
    "font-family": "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
    "font-size": spec.text.cursorSize,
    "font-weight": 400,
    "dominant-baseline": "hanging",
  });
  cursor.textContent = spec.text.cursor;

  const terminalHit = createSvgElement("rect", {
    x: geometry.panel.x,
    y: geometry.panel.y,
    width: geometry.panel.width,
    height: geometry.panel.height,
    fill: spec.colors.background,
    "fill-opacity": 0,
    "pointer-events": "all",
  });

  terminalGroup.append(panel, cursor, terminalHit);

  contentGroup.append(structureGroup, boatGroup, diamondLink, signalLink, terminalGroup);

  if (infoLayout.mobile) {
    contentGroup.setAttribute("opacity", "0.2");
    contentGroup.style.pointerEvents = "none";
  }

  const infoBottom = renderManifestoPreview(
    infoGroup,
    infoLayout,
    state,
    spec,
    onEmailCopy,
    onWorkSectionToggle,
  );
  const bottomPad = clamp(frame.viewport.height * 0.08, 28, 56);
  const surfaceHeight = infoLayout.mobile
    ? Math.max(frame.viewport.height, Math.ceil(infoBottom + bottomPad))
    : frame.viewport.height;
  const shouldScroll = surfaceHeight > frame.viewport.height;

  svg.setAttribute("viewBox", `0 0 ${frame.viewport.width} ${surfaceHeight}`);
  svg.setAttribute("preserveAspectRatio", "none");

  if (shouldScroll) {
    svg.style.height = `${surfaceHeight}px`;
  } else {
    svg.style.removeProperty("height");
  }

  document.documentElement.style.overflowY = shouldScroll ? "auto" : "hidden";
  document.body.style.overflowY = shouldScroll ? "auto" : "hidden";

  if (!shouldScroll && globalThis.scrollY > 0) {
    globalThis.scrollTo(0, 0);
  }

  const background = createSvgElement("rect", {
    x: 0,
    y: 0,
    width: frame.viewport.width,
    height: surfaceHeight,
    fill: spec.colors.background,
  });

  svg.append(defs, background, headerBoxes, headerOutline, contentGroup, infoGroup);

  return {
    headerBoxes: headerBoxRefs,
    boat: {
      line: boatLine,
      hit: boatHit,
      start: geometry.branchStart,
      end: geometry.branchEnd,
      center: {
        x: (geometry.branchStart.x + geometry.branchEnd.x) / 2,
        y: (geometry.branchStart.y + geometry.branchEnd.y) / 2,
      },
    },
    diamond: {
      group: diamondGroup,
      hit: diamondHit,
    },
    signal: {
      hit: signalHit,
      halo,
      thinkingSoft,
      thinkingCrisp,
      baseRadius: geometry.circleRadius,
    },
    terminal: {
      hit: terminalHit,
      panel,
      cursor,
    },
  };
}

// hover and click interactions

function setupHeaderBoxInteraction(
  refs: HeaderBoxRefs,
  reducedMotion: boolean,
  onActivate: () => void,
): () => void {
  let progress = 0;
  let moveCancel: (() => void) | null = null;
  let pulseCancel: (() => void) | null = null;

  const apply = (): void => {
    const width = refs.box.width * progress;
    refs.fill.setAttribute("width", width.toFixed(2));
    refs.fill.setAttribute("opacity", progress > 0 ? "1" : "0");
    refs.clipRect.setAttribute("width", width.toFixed(2));
  };

  const animateTo = (target: number): void => {
    moveCancel?.();

    if (reducedMotion) {
      progress = target;
      apply();
      return;
    }

    const from = progress;
    moveCancel = animate({
      duration: target > from ? 360 : 180,
      from,
      to: target,
      easing: target > from ? easeOutCubic : easeInOutCubic,
      onUpdate: (value: number) => {
        progress = value;
        apply();
      },
      onComplete: () => {
        moveCancel = null;
      },
    });
  };

  const pulseBorder = (): void => {
    pulseCancel?.();

    if (reducedMotion) {
      refs.border.setAttribute("opacity", progress > 0 ? "0.28" : "0");
      return;
    }

    pulseCancel = animate({
      duration: 320,
      from: 0,
      to: 1,
      easing: easeOutCubic,
      onUpdate: (_value: number, raw: number) => {
        const intensity = Math.sin(raw * Math.PI);
        refs.border.setAttribute("opacity", (0.56 * intensity).toFixed(3));
      },
      onComplete: () => {
        refs.border.setAttribute("opacity", "0");
        pulseCancel = null;
      },
    });
  };

  const handleEnter = (): void => {
    animateTo(1);
    pulseBorder();
  };

  const handleLeave = (): void => {
    animateTo(0);
    pulseCancel?.();
    pulseCancel = null;
    refs.border.setAttribute("opacity", "0");
  };

  const handleClick = (): void => {
    onActivate();
  };

  refs.hit.addEventListener("pointerenter", handleEnter);
  refs.hit.addEventListener("pointerleave", handleLeave);
  refs.hit.addEventListener("click", handleClick);
  apply();

  return () => {
    moveCancel?.();
    pulseCancel?.();
    refs.hit.removeEventListener("pointerenter", handleEnter);
    refs.hit.removeEventListener("pointerleave", handleLeave);
    refs.hit.removeEventListener("click", handleClick);
  };
}

function setupDiamondInteraction(refs: DiamondRefs, reducedMotion: boolean): () => void {
  let idleOffset = 0;
  let returnCancel: (() => void) | null = null;
  let loopFrame: number | null = null;
  let hoverStart = 0;

  const apply = (offsetY: number): void => {
    idleOffset = offsetY;

    if (Math.abs(offsetY) < 0.01) {
      refs.group.removeAttribute("transform");
      return;
    }

    refs.group.setAttribute("transform", `translate(0 ${offsetY.toFixed(2)})`);
  };

  const stopLoop = (): void => {
    if (loopFrame !== null) {
      globalThis.cancelAnimationFrame(loopFrame);
      loopFrame = null;
    }
  };

  const startLoop = (): void => {
    stopLoop();

    if (reducedMotion) {
      apply(0);
      return;
    }

    hoverStart = globalThis.performance.now();
    const amplitude = 4;
    const period = 1350;

    const tick = (now: number): void => {
      const elapsed = now - hoverStart;
      const phase = (elapsed / period) * Math.PI * 2;
      const offset = Math.sin(phase) * amplitude;
      apply(offset);
      loopFrame = globalThis.requestAnimationFrame(tick);
    };

    loopFrame = globalThis.requestAnimationFrame(tick);
  };

  const settle = (): void => {
    stopLoop();
    returnCancel?.();

    if (reducedMotion) {
      apply(0);
      return;
    }

    const from = idleOffset;
    returnCancel = animate({
      duration: 180,
      from,
      to: 0,
      easing: easeInOutCubic,
      onUpdate: (value: number) => {
        apply(value);
      },
      onComplete: () => {
        apply(0);
        returnCancel = null;
      },
    });
  };

  const handleEnter = (): void => {
    returnCancel?.();
    returnCancel = null;
    startLoop();
  };

  const handleLeave = (): void => {
    settle();
  };

  refs.hit.addEventListener("pointerenter", handleEnter);
  refs.hit.addEventListener("pointerleave", handleLeave);
  apply(0);

  return () => {
    stopLoop();
    returnCancel?.();
    refs.hit.removeEventListener("pointerenter", handleEnter);
    refs.hit.removeEventListener("pointerleave", handleLeave);
    apply(0);
  };
}

function setupBoatInteraction(refs: BoatRefs, reducedMotion: boolean): () => void {
  let bobCancel: (() => void) | null = null;

  const apply = (heave: number, roll: number): void => {
    const start = rotatePoint(refs.start, refs.center, roll);
    const end = rotatePoint(refs.end, refs.center, roll);

    refs.line.setAttribute("x1", start.x.toFixed(2));
    refs.line.setAttribute("y1", (start.y - heave).toFixed(2));
    refs.line.setAttribute("x2", end.x.toFixed(2));
    refs.line.setAttribute("y2", (end.y - heave).toFixed(2));
    refs.hit.setAttribute("x1", start.x.toFixed(2));
    refs.hit.setAttribute("y1", (start.y - heave).toFixed(2));
    refs.hit.setAttribute("x2", end.x.toFixed(2));
    refs.hit.setAttribute("y2", (end.y - heave).toFixed(2));
  };

  const reset = (): void => {
    apply(0, 0);
  };

  const triggerBob = (): void => {
    bobCancel?.();

    if (reducedMotion) {
      reset();
      return;
    }

    bobCancel = animate({
      duration: 720,
      from: 0,
      to: 1,
      easing: easeOutCubic,
      onUpdate: (_value: number, raw: number) => {
        const damping = (1 - raw) ** 1.35;
        const wave = Math.sin(raw * Math.PI * 2.8);
        const heave = wave * damping * 5.5;
        const roll = wave * damping * 0.9;
        apply(heave, roll);
      },
      onComplete: () => {
        reset();
        bobCancel = null;
      },
    });
  };

  const handleEnter = (): void => {
    triggerBob();
  };

  const handleLeave = (): void => {
    bobCancel?.();
    bobCancel = null;
    reset();
  };

  refs.hit.addEventListener("pointerenter", handleEnter);
  refs.hit.addEventListener("pointerleave", handleLeave);
  reset();

  return () => {
    bobCancel?.();
    refs.hit.removeEventListener("pointerenter", handleEnter);
    refs.hit.removeEventListener("pointerleave", handleLeave);
    reset();
  };
}

function setupSignalInteraction(
  refs: SignalRefs,
  spec: CompositionSpec,
  reducedMotion: boolean,
): () => void {
  let crisp = 0;
  let crispCancel: (() => void) | null = null;
  let pulseCancel: (() => void) | null = null;
  const crispFill = mixColor(spec.colors.thinking, spec.colors.title, 0.24);

  const apply = (): void => {
    refs.thinkingSoft.setAttribute("opacity", (0.78 - crisp * 0.58).toFixed(3));
    refs.thinkingSoft.setAttribute("letter-spacing", (1 - crisp * 0.85).toFixed(2));
    refs.thinkingCrisp.setAttribute("opacity", (0.18 + crisp * 0.82).toFixed(3));
    refs.thinkingCrisp.setAttribute("letter-spacing", (0.35 * (1 - crisp)).toFixed(2));
    refs.thinkingCrisp.setAttribute("fill", interpolateColor(spec.colors.thinking, crispFill, crisp));
  };

  const animateTo = (target: number): void => {
    crispCancel?.();

    if (reducedMotion) {
      crisp = target;
      apply();
      return;
    }

    const from = crisp;
    crispCancel = animate({
      duration: target > from ? 260 : 180,
      from,
      to: target,
      easing: easeInOutCubic,
      onUpdate: (value: number) => {
        crisp = value;
        apply();
      },
      onComplete: () => {
        crispCancel = null;
      },
    });
  };

  const triggerPulse = (): void => {
    pulseCancel?.();

    if (reducedMotion) {
      refs.halo.setAttribute("opacity", "0.16");
      return;
    }

    pulseCancel = animate({
      duration: 420,
      from: 0,
      to: 1,
      easing: easeOutCubic,
      onUpdate: (_value: number, raw: number) => {
        refs.halo.setAttribute("r", (refs.baseRadius * (1.08 + raw * 0.82)).toFixed(2));
        refs.halo.setAttribute("opacity", (0.3 * (1 - raw)).toFixed(3));
        refs.halo.setAttribute("stroke-width", (1.8 + raw * 1.4).toFixed(2));
      },
      onComplete: () => {
        refs.halo.setAttribute("r", (refs.baseRadius * 1.08).toFixed(2));
        refs.halo.setAttribute("opacity", "0");
        refs.halo.setAttribute("stroke-width", "2");
        pulseCancel = null;
      },
    });
  };

  const handleEnter = (): void => {
    animateTo(1);
    triggerPulse();
  };

  const handleLeave = (): void => {
    animateTo(0);
    pulseCancel?.();
    pulseCancel = null;
    refs.halo.setAttribute("opacity", "0");
    refs.halo.setAttribute("r", (refs.baseRadius * 1.08).toFixed(2));
    refs.halo.setAttribute("stroke-width", "2");
  };

  refs.hit.addEventListener("pointerenter", handleEnter);
  refs.hit.addEventListener("pointerleave", handleLeave);
  apply();

  return () => {
    crispCancel?.();
    pulseCancel?.();
    refs.hit.removeEventListener("pointerenter", handleEnter);
    refs.hit.removeEventListener("pointerleave", handleLeave);
    refs.halo.setAttribute("opacity", "0");
  };
}

function randomGhostCharacter(): string {
  const glyphs = ["/", "_", ":", "~", "="];
  return glyphs[Math.floor(Math.random() * glyphs.length)];
}

// clipboard

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const selection = globalThis.getSelection?.() ?? null;
  const previousRanges =
    selection === null
      ? []
      : Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index));
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  const copied = document.execCommand("copy");
  textarea.remove();

  if (selection !== null) {
    selection.removeAllRanges();
    previousRanges.forEach((range) => {
      selection.addRange(range);
    });
  }

  activeElement?.focus();

  if (!copied) {
    throw new Error("Clipboard copy failed");
  }
}

function ensureAnnouncer(id: string): HTMLElement {
  const existing = document.getElementById(id);
  if (existing !== null) {
    return existing;
  }

  const node = document.createElement("p");
  node.id = id;
  node.setAttribute("aria-live", "polite");
  node.setAttribute("aria-atomic", "true");
  node.style.position = "fixed";
  node.style.width = "1px";
  node.style.height = "1px";
  node.style.margin = "-1px";
  node.style.padding = "0";
  node.style.overflow = "hidden";
  node.style.clip = "rect(0 0 0 0)";
  node.style.clipPath = "inset(50%)";
  node.style.whiteSpace = "nowrap";
  node.style.border = "0";
  document.body.append(node);
  return node;
}

function setupTerminalInteraction(
  refs: TerminalRefs,
  spec: CompositionSpec,
  reducedMotion: boolean,
): () => void {
  let active = 0;
  let stateCancel: (() => void) | null = null;
  let typingCancel: (() => void) | null = null;
  const activeFill = mixColor(spec.colors.panel, spec.colors.title, 0.18);
  const activeCursor = mixColor(spec.colors.cursor, spec.colors.background, 0.88);

  const apply = (): void => {
    refs.panel.setAttribute("fill", interpolateColor(spec.colors.panel, activeFill, active));
    refs.cursor.setAttribute("fill", interpolateColor(spec.colors.cursor, activeCursor, active));
  };

  const animateTo = (target: number): void => {
    stateCancel?.();

    if (reducedMotion) {
      active = target;
      apply();
      return;
    }

    const from = active;
    stateCancel = animate({
      duration: target > from ? 240 : 180,
      from,
      to: target,
      easing: easeInOutCubic,
      onUpdate: (value: number) => {
        active = value;
        apply();
      },
      onComplete: () => {
        stateCancel = null;
      },
    });
  };

  const triggerTyping = (): void => {
    typingCancel?.();

    if (reducedMotion) {
      refs.cursor.textContent = spec.text.cursor;
      return;
    }

    const firstGhost = randomGhostCharacter();
    const secondGhost = randomGhostCharacter();
    const frames = [
      spec.text.cursor,
      `..${firstGhost}|`,
      `.${firstGhost}${secondGhost}|`,
      spec.text.cursor,
    ] as const;

    typingCancel = runStepSequence(
      frames,
      88,
      (frame) => {
        refs.cursor.textContent = frame;
      },
      () => {
        refs.cursor.textContent = spec.text.cursor;
        typingCancel = null;
      },
    );
  };

  const handleEnter = (): void => {
    animateTo(1);
    triggerTyping();
  };

  const handleLeave = (): void => {
    animateTo(0);
    typingCancel?.();
    typingCancel = null;
    refs.cursor.textContent = spec.text.cursor;
  };

  refs.hit.addEventListener("pointerenter", handleEnter);
  refs.hit.addEventListener("pointerleave", handleLeave);
  apply();

  return () => {
    stateCancel?.();
    typingCancel?.();
    refs.hit.removeEventListener("pointerenter", handleEnter);
    refs.hit.removeEventListener("pointerleave", handleLeave);
    refs.cursor.textContent = spec.text.cursor;
  };
}

function setupInteractions(
  refs: InteractionRefs,
  spec: CompositionSpec,
  reducedMotion: boolean,
  setState: (patch: Partial<AppState>) => void,
): () => void {
  const cleanups = [
    ...refs.headerBoxes.map((box) =>
      setupHeaderBoxInteraction(box, reducedMotion, () => {
        setState({ page: headerKeyToPage(box.key) });
      }),
    ),
    setupDiamondInteraction(refs.diamond, reducedMotion),
    setupSignalInteraction(refs.signal, spec, reducedMotion),
    setupTerminalInteraction(refs.terminal, spec, reducedMotion),
  ];

  return () => {
    cleanups.forEach((cleanup) => {
      cleanup();
    });
  };
}

// app entry, state management, resize handling

function mount(spec: CompositionSpec): void {
  const svg = document.getElementById("composition") as SVGSVGElement | null;
  if (!svg) {
    throw new Error("Missing #composition svg root");
  }

  const host = globalThis;
  const announcer = ensureAnnouncer("contact-status-announcer");
  const reducedMotionQuery = host.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
  const emailAddress = "eyanghq@gmail.com";
  let frameId: number | null = null;
  let announceTimeoutId: number | null = null;
  let cleanupInteractions: (() => void) | null = null;
  let feedbackTimeoutId: number | null = null;
  let state: AppState = { ...INITIAL_STATE };

  const setState = (patch: Partial<AppState>): void => {
    const nextState = { ...state, ...patch };
    const changed =
      nextState.page !== state.page || nextState.emailFeedback !== state.emailFeedback || nextState.workSection !== state.workSection;

    if (!changed) {
      return;
    }

    state = nextState;
    scheduleRender();
  };

  const announce = (message: string): void => {
    if (announceTimeoutId !== null) {
      host.clearTimeout(announceTimeoutId);
    }

    announcer.textContent = "";
    announceTimeoutId = host.setTimeout(() => {
      announcer.textContent = message;
      announceTimeoutId = null;
    }, 24);
  };

  const showEmailFeedback = (feedback: NonNullable<ContactFeedback>): void => {
    if (feedbackTimeoutId !== null) {
      host.clearTimeout(feedbackTimeoutId);
    }

    setState({ emailFeedback: feedback });
    announce(feedback.message);
    feedbackTimeoutId = host.setTimeout(() => {
      feedbackTimeoutId = null;
      setState({ emailFeedback: null });
    }, 1400);
  };

  const handleEmailCopy = (): void => {
    void copyTextToClipboard(emailAddress)
      .then(() => {
        showEmailFeedback({
          tone: "success",
          message: "Copied email",
        });
      })
      .catch(() => {
        showEmailFeedback({
          tone: "error",
          message: "Copy failed",
        });
      });
  };

  const commitRender = (): void => {
    cleanupInteractions?.();
    cleanupInteractions = setupInteractions(
      render(spec, svg, state, handleEmailCopy, () => {
        setState({ workSection: state.workSection === "built" ? "published" : "built" });
      }),
      spec,
      Boolean(reducedMotionQuery?.matches),
      setState,
    );
  };

  const scheduleRender = (): void => {
    if (frameId !== null) {
      return;
    }

    frameId = host.requestAnimationFrame(() => {
      frameId = null;
      commitRender();
    });
  };

  scheduleRender();
  host.addEventListener("resize", scheduleRender);

  const observer = new ResizeObserver(() => {
    scheduleRender();
  });
  observer.observe(svg);
  reducedMotionQuery?.addEventListener("change", scheduleRender);
}

mount(SPEC);
