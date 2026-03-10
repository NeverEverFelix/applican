import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import gsap from "gsap";
import styles from "./MorphTransition.module.css";

export type LoginScreenTransitionHandle = {
  run: (callbacks?: { onCovered?: () => void; onComplete?: () => void }) => void;
};

type Props = {
  zIndex?: number;
};

function buildPath(y: number, curve: number) {
  return `M 0 100 V ${y} Q 50 ${Math.max(0, y - curve)} 100 ${y} V 100 Z`;
}

const LoginScreenTransition = forwardRef<LoginScreenTransitionHandle, Props>(
  ({ zIndex = 9999 }, ref) => {
    const pathRef = useRef<SVGPathElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const isRunningRef = useRef(false);

    const state = useMemo(() => ({ y: 100, curve: 0 }), []);

    useImperativeHandle(ref, () => ({
      run(callbacks) {
        if (!pathRef.current || !svgRef.current || isRunningRef.current) return;

        isRunningRef.current = true;

        const updatePath = () => {
          if (!pathRef.current) return;
          pathRef.current.setAttribute("d", buildPath(state.y, state.curve));
        };

        gsap.killTweensOf(state);

        const tl = gsap.timeline({
          onComplete: () => {
            isRunningRef.current = false;
            callbacks?.onComplete?.();
          },
        });

        tl.set(svgRef.current, { autoAlpha: 1 });

        tl.to(state, {
          y: 50,
          curve: 38,
          duration: 0.45,
          ease: "power2.in",
          onUpdate: updatePath,
        });

        tl.to(state, {
          y: 0,
          curve: 0,
          duration: 0.4,
          ease: "power2.out",
          onUpdate: updatePath,
          onComplete: () => {
            callbacks?.onCovered?.();
          },
        });

        tl.to({}, { duration: 0.08 });

        tl.to(state, {
          y: 50,
          curve: 38,
          duration: 0.38,
          ease: "power2.in",
          onUpdate: updatePath,
        });

        tl.to(state, {
          y: 100,
          curve: 0,
          duration: 0.45,
          ease: "power2.out",
          onUpdate: updatePath,
        });

        tl.set(svgRef.current, { autoAlpha: 0 });
      },
    }));

    return (
      <svg
        ref={svgRef}
        className={styles.overlay}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ zIndex }}
      >
        <defs>
          <linearGradient
            id="login-transition-grad"
            x1="0"
            y1="0"
            x2="100"
            y2="100"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#0068F4" />
            <stop offset="100%" stopColor="#DCD9FB" />
          </linearGradient>
        </defs>

        <path ref={pathRef} fill="url(#login-transition-grad)" d={buildPath(100, 0)} />
      </svg>
    );
  }
);

LoginScreenTransition.displayName = "LoginScreenTransition";

export default LoginScreenTransition;
