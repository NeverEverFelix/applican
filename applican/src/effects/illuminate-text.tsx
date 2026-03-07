import { useLayoutEffect, useRef, type ComponentPropsWithoutRef, type ElementType } from "react";
import gsap from "gsap";

type IlluminateTextProps<T extends ElementType = "span"> =
  Omit<ComponentPropsWithoutRef<T>, "children" | "as"> & {
    text: string;
    as?: T;
    dimColor?: string;
    glowColor?: string;
    coreColor?: string;
    duration?: number;
  };

export default function IlluminateText<T extends ElementType = "span">({
  text,
  as,
  className,
  dimColor = "#5f3b8f",
  glowColor = "#be9dff",
  coreColor = "#f4ecff",
  duration = 1.2,
  ...props
}: IlluminateTextProps<T>) {
  const { style, ...restProps } = props;
  const softBandRef = useRef<HTMLSpanElement | null>(null);
  const hotCoreRef = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    if (!softBandRef.current || !hotCoreRef.current) {
      return;
    }

    const targets = [softBandRef.current, hotCoreRef.current];

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        {
          WebkitMaskPosition: "150% 0%",
          maskPosition: "150% 0%",
        },
        {
          WebkitMaskPosition: "-50% 0%",
          maskPosition: "-50% 0%",
          duration,
          ease: "none",
          repeat: -1,
          repeatDelay: 0.35,
        },
      );
    });

    return () => {
      ctx.revert();
    };
  }, [text, duration]);

  const Component = (as ?? "span") as ElementType;
  return (
    <Component
      className={className}
      style={{
        position: "relative",
        display: "inline-block",
        whiteSpace: "pre",
        ...(style as Record<string, unknown>),
      }}
      {...restProps}
    >
      <span
        style={{
          position: "relative",
          zIndex: 1,
          color: dimColor,
          display: "inline-block",
          whiteSpace: "pre",
        }}
      >
        {text}
      </span>
      <span
        ref={softBandRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          color: glowColor,
          opacity: 0.6,
          display: "inline-block",
          whiteSpace: "pre",
          pointerEvents: "none",
          filter: "brightness(1.06) contrast(1.04)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent 0%, transparent 22%, rgba(0,0,0,0.18) 36%, rgba(0,0,0,0.58) 50%, rgba(0,0,0,0.18) 64%, transparent 78%, transparent 100%)",
          maskImage:
            "linear-gradient(90deg, transparent 0%, transparent 22%, rgba(0,0,0,0.18) 36%, rgba(0,0,0,0.58) 50%, rgba(0,0,0,0.18) 64%, transparent 78%, transparent 100%)",
          WebkitMaskSize: "250% 100%",
          maskSize: "250% 100%",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "150% 0%",
          maskPosition: "150% 0%",
          willChange: "mask-position, -webkit-mask-position",
        }}
      >
        {text}
      </span>
      <span
        ref={hotCoreRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          color: coreColor,
          opacity: 0.95,
          display: "inline-block",
          whiteSpace: "pre",
          pointerEvents: "none",
          textShadow: "0 0 1px rgba(244,236,255,0.22)",
          filter: "brightness(1.16) contrast(1.08)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent 0%, transparent 44%, rgba(0,0,0,0.95) 50%, transparent 56%, transparent 100%)",
          maskImage:
            "linear-gradient(90deg, transparent 0%, transparent 44%, rgba(0,0,0,0.95) 50%, transparent 56%, transparent 100%)",
          WebkitMaskSize: "250% 100%",
          maskSize: "250% 100%",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "150% 0%",
          maskPosition: "150% 0%",
          willChange: "mask-position, -webkit-mask-position",
        }}
      >
        {text}
      </span>
    </Component>
  );
}
