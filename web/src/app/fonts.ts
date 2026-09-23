import { Big_Shoulders_Stencil, Figtree, Modak } from "next/font/google";

/** Display voice: chunky, rounded, cozy. Ek Type's Modak. */
export const modak = Modak({
  weight: "400",
  subsets: ["latin"],
  variable: "--f-modak",
  display: "swap",
});

/** Body + UI. */
export const figtree = Figtree({
  subsets: ["latin"],
  variable: "--f-figtree",
  display: "swap",
});

/** Factory addresses, batch numbers, stamps. */
export const stencil = Big_Shoulders_Stencil({
  subsets: ["latin"],
  weight: ["600", "800"],
  variable: "--f-stencil",
  display: "swap",
});
