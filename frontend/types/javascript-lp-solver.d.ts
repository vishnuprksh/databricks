declare module "javascript-lp-solver" {
  interface LpModel {
    optimize: string;
    opType: "max" | "min";
    constraints: Record<string, Record<string, number>>;
    variables: Record<string, Record<string, number>>;
    ints?: Record<string, number>;
  }
  export function Solve(model: LpModel): Record<string, number | string>;
}
