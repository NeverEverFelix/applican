import gsap from "gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import opentype from "opentype.js";

gsap.registerPlugin(MorphSVGPlugin);

const shapeHundreds = document.querySelector("#shape-hundreds") as SVGPathElement;
const shapeTens = document.querySelector("#shape-tens") as SVGPathElement;
const shapeOnes = document.querySelector("#shape-ones") as SVGPathElement;

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const size = 220;
const viewBox = { x: 0, y: 0, width: 220, height: 320 };
const sizeRatio = size / viewBox.width;

const gradient = ctx.createLinearGradient(0, 0, viewBox.width, viewBox.height);
gradient.addColorStop(0.2, "#0068F4");
gradient.addColorStop(0.7, "#DCD9FB");

gsap.defaults({ ease: "power2.inOut" });
gsap.set(".container", { autoAlpha: 1 });

setDisplay();

let tl: gsap.core.Timeline | null = null;

type SlotKey = "hundreds" | "tens" | "ones";
type SlotState = Record<SlotKey, string>;

init();

async function init() {
  const font = await opentype.load("/fonts/Inter-ExtraBold.ttf");

  // Precompute single-character shapes for each slot position
  const slotPaths = {
    hundreds: buildDigitSet(font, 28),
    tens: buildDigitSet(font, 88),
    ones: buildDigitSet(font, 148),
  };

  const initial = getSlotState(1);

  shapeHundreds.setAttribute("d", slotPaths.hundreds[initial.hundreds]);
  shapeTens.setAttribute("d", slotPaths.tens[initial.tens]);
  shapeOnes.setAttribute("d", slotPaths.ones[initial.ones]);

  // Force initial render
  drawCombined();

  tl = gsap.timeline({
    repeat: -1,
    paused: false,
    defaults: {
      duration: 0.09,
      ease: "none",
    },
  });

  let previous = initial;

  for (let n = 2; n <= 100; n++) {
    const current = getSlotState(n);

    const step = gsap.timeline();

    if (previous.hundreds !== current.hundreds) {
      step.to(
        shapeHundreds,
        {
          morphSVG: {
            shape: slotPaths.hundreds[current.hundreds],
            render: drawCombined,
          },
        },
        0
      );
    }

    if (previous.tens !== current.tens) {
      step.to(
        shapeTens,
        {
          morphSVG: {
            shape: slotPaths.tens[current.tens],
            render: drawCombined,
          },
        },
        0
      );
    }

    if (previous.ones !== current.ones) {
      step.to(
        shapeOnes,
        {
          morphSVG: {
            shape: slotPaths.ones[current.ones],
            render: drawCombined,
          },
        },
        0
      );
    }

    tl.add(step);
    previous = current;
  }

  // loop back 100 -> 1
  const resetState = getSlotState(1);
  const reset = gsap.timeline({
    defaults: {
      duration: 0.22,
      ease: "expo.inOut",
    },
  });

  if (previous.hundreds !== resetState.hundreds) {
    reset.to(
      shapeHundreds,
      {
        morphSVG: {
          shape: slotPaths.hundreds[resetState.hundreds],
          render: drawCombined,
        },
      },
      0
    );
  }

  if (previous.tens !== resetState.tens) {
    reset.to(
      shapeTens,
      {
        morphSVG: {
          shape: slotPaths.tens[resetState.tens],
          render: drawCombined,
        },
      },
      0
    );
  }

  if (previous.ones !== resetState.ones) {
    reset.to(
      shapeOnes,
      {
        morphSVG: {
          shape: slotPaths.ones[resetState.ones],
          render: drawCombined,
        },
      },
      0
    );
  }

  tl.add(reset);
  tl.progress(0.0001);
}

function buildDigitSet(font: opentype.Font, centerX: number) {
  const map: Record<string, string> = {};
  const chars = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "blank"];

  for (const ch of chars) {
    map[ch] =
      ch === "blank"
        ? makeBlankPath(centerX)
        : makeDigitPath(font, ch, centerX);
  }

  return map;
}

function getSlotState(n: number): SlotState {
  if (n < 10) {
    return {
      hundreds: "blank",
      tens: "blank",
      ones: String(n),
    };
  }

  if (n < 100) {
    return {
      hundreds: "blank",
      tens: String(Math.floor(n / 10)),
      ones: String(n % 10),
    };
  }

  return {
    hundreds: "1",
    tens: "0",
    ones: "0",
  };
}

function makeDigitPath(font: opentype.Font, digit: string, centerX: number) {
  const fontSize = 280;
  const baselineY = 250;

  const path = font.getPath(digit, 0, baselineY, fontSize, {
    kerning: true,
  });

  const bbox = path.getBoundingBox();
  const textWidth = bbox.x2 - bbox.x1;
  const dx = centerX - textWidth / 2 - bbox.x1;

  path.commands.forEach((cmd: any) => {
    if (cmd.x !== undefined) cmd.x += dx;
    if (cmd.x1 !== undefined) cmd.x1 += dx;
    if (cmd.x2 !== undefined) cmd.x2 += dx;
  });

  return path.toPathData(3);
}

// Tiny closed shape so MorphSVG always has something valid to work with
function makeBlankPath(centerX: number) {
  const y = 160;
  const r = 0.1;
  return `M ${centerX - r} ${y} 
          C ${centerX - r} ${y - r}, ${centerX + r} ${y - r}, ${centerX + r} ${y}
          C ${centerX + r} ${y + r}, ${centerX - r} ${y + r}, ${centerX - r} ${y} Z`;
}

function drawCombined() {
  const rawHundreds = MorphSVGPlugin.pathDataToRawBezier(
    shapeHundreds.getAttribute("d") || ""
  );
  const rawTens = MorphSVGPlugin.pathDataToRawBezier(
    shapeTens.getAttribute("d") || ""
  );
  const rawOnes = MorphSVGPlugin.pathDataToRawBezier(
    shapeOnes.getAttribute("d") || ""
  );

  ctx.clearRect(0, 0, size, size * (viewBox.height / viewBox.width));
  ctx.beginPath();

  drawRawPath(rawHundreds);
  drawRawPath(rawTens);
  drawRawPath(rawOnes);

  ctx.fillStyle = gradient;
  ctx.fill("evenodd");
}

function drawRawPath(rawPath: any) {
  for (let j = 0; j < rawPath.length; j++) {
    const segment = rawPath[j];
    const l = segment.length;

    ctx.moveTo(segment[0], segment[1]);

    for (let i = 2; i < l; i += 6) {
      ctx.bezierCurveTo(
        segment[i],
        segment[i + 1],
        segment[i + 2],
        segment[i + 3],
        segment[i + 4],
        segment[i + 5]
      );
    }

    if (segment.closed) {
      ctx.closePath();
    }
  }
}

function setDisplay() {
  const ratio = window.devicePixelRatio || 1;
  const displayHeight = size * (viewBox.height / viewBox.width);

  canvas.width = size * ratio;
  canvas.height = displayHeight * ratio;

  gsap.set(canvas, {
    width: size,
    height: displayHeight,
  });

  const scaledRatio = ratio * sizeRatio;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(-viewBox.x * scaledRatio, -viewBox.y * scaledRatio);
  ctx.scale(scaledRatio, scaledRatio);
}

document.body.addEventListener("click", () => {
  if (!tl) return;
  tl.paused(!tl.paused());
});