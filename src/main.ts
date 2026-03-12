type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

type CompositionSpec = {
  model: { width: number; height: number };
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
    thinking: string;
    cursor: string;
    titleSize: number;
    thinkingSize: number;
    cursorSize: number;
    thinkingOffsetXFromCircleCenter: number;
    thinkingOffsetYFromCircleCenter: number;
    cursorOffsetXFromPanelLeft: number;
    cursorOffsetYFromPanelTop: number;
  };
  colors: {
    background: string;
    line: string;
    title: string;
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

const SPEC: CompositionSpec = {
  model: {
    width: 1600,
    height: 1000,
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
    panelOffsetYFromCircleBottom: 0.088,
    panelWidth: 0.15625,
    panelHeight: 0.17,
    titleX: 0.040625,
    titleY: 0.043,
  },
  text: {
    title: "ETHAN YANG",
    thinking: "thinking?",
    cursor: "...|",
    titleSize: 70,
    thinkingSize: 39,
    cursorSize: 35,
    thinkingOffsetXFromCircleCenter: -20,
    thinkingOffsetYFromCircleCenter: 50,
    cursorOffsetXFromPanelLeft: 15,
    cursorOffsetYFromPanelTop: 18,
  },
  colors: {
    background: "#FAF7F3",
    line: "#C6C3BE",
    title: "#3A3530",
    diamond: "#843B39",
    circle: "#51638A",
    thinking: "#B8B8B8",
    panel: "#D9D9D9",
  },
};

const svgNs = "http://www.w3.org/2000/svg";

function toPx(value: number): number {
  return Math.round(value);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Composition constraint failed: ${message}`);
  }
}

function deriveGeometry(spec: CompositionSpec): DerivedGeometry {
  const { width, height } = spec.model;

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

function validateConstraints(spec: CompositionSpec, g: DerivedGeometry): void {
  const { width } = spec.model;

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

  assert(g.branchEnd.y === spec.model.height, "branch must end on bottom edge");
  assert(
    g.branchEnd.y - g.branchStart.y === g.branchEnd.x - g.branchStart.x,
    "branch diagonal must be 45 degrees down-right",
  );

  assert(g.circleCenter.x === g.branchStart.x, "circle center x aligns with branch start x");
  assert(
    g.circleCenter.y - g.circleRadius === g.leftHit.y,
    "circle top aligns with main diagonal left intercept",
  );

  const diamondRight = g.diamondCenter.x + g.diamondHalfDiag;
  const circleRight = g.circleCenter.x + g.circleRadius;
  const panelRight = g.panel.x + g.panel.width;
  const activeMaxX = Math.max(g.branchEnd.x, diamondRight, circleRight, panelRight, g.header.width);

  assert(activeMaxX <= toPx(width * 0.42), "active cluster must stay in left ~42% of canvas");
}

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

function render(spec: CompositionSpec): void {
  const svg = document.getElementById("composition") as SVGSVGElement | null;
  if (!svg) {
    throw new Error("Missing #composition svg root");
  }

  const g = deriveGeometry(spec);
  validateConstraints(spec, g);

  const { width, height } = spec.model;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");

  svg.replaceChildren();

  const background = createSvgElement("rect", {
    x: 0,
    y: 0,
    width,
    height,
    fill: spec.colors.background,
  });

  const structureGroup = createSvgElement("g", {
    stroke: spec.colors.line,
    "stroke-width": 1,
    fill: "none",
  });

  const structuralLines: Array<[Point, Point]> = [
    [{ x: g.junction.x, y: 0 }, { x: g.junction.x, y: g.junction.y }],
    [{ x: 0, y: g.junction.y }, { x: width, y: g.junction.y }],
    [g.junction, g.leftHit],
    [g.branchStart, g.branchEnd],
  ];

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

  const title = createSvgElement("text", {
    x: g.titlePos.x,
    y: g.titlePos.y,
    fill: spec.colors.title,
    "font-family": "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
    "font-size": spec.text.titleSize,
    "font-weight": 700,
    "dominant-baseline": "hanging",
  });
  title.textContent = spec.text.title;

  const diamondPoints = [
    `${g.diamondCenter.x},${g.diamondCenter.y - g.diamondHalfDiag}`,
    `${g.diamondCenter.x + g.diamondHalfDiag},${g.diamondCenter.y}`,
    `${g.diamondCenter.x},${g.diamondCenter.y + g.diamondHalfDiag}`,
    `${g.diamondCenter.x - g.diamondHalfDiag},${g.diamondCenter.y}`,
  ].join(" ");

  const diamond = createSvgElement("polygon", {
    points: diamondPoints,
    fill: spec.colors.diamond,
  });

  const circle = createSvgElement("circle", {
    cx: g.circleCenter.x,
    cy: g.circleCenter.y,
    r: g.circleRadius,
    fill: spec.colors.circle,
  });

  const thinking = createSvgElement("text", {
    x: g.thinkingPos.x,
    y: g.thinkingPos.y,
    fill: spec.colors.thinking,
    "font-family": "'Cormorant Garamond', Georgia, serif",
    "font-size": spec.text.thinkingSize,
    "font-weight": 500,
  });
  thinking.textContent = spec.text.thinking;

  const panel = createSvgElement("rect", {
    x: g.panel.x,
    y: g.panel.y,
    width: g.panel.width,
    height: g.panel.height,
    fill: spec.colors.panel,
  });

  const cursor = createSvgElement("text", {
    x: g.cursorPos.x,
    y: g.cursorPos.y,
    fill: "#000000",
    "font-family": "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
    "font-size": spec.text.cursorSize,
    "font-weight": 400,
    "dominant-baseline": "hanging",
  });
  cursor.textContent = spec.text.cursor;

  svg.append(background, structureGroup, title, diamond, circle, thinking, panel, cursor);
}

render(SPEC);
