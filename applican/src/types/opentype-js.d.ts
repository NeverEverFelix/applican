declare module "opentype.js" {
  export type Font = {
    getPath: (
      text: string,
      x: number,
      y: number,
      fontSize: number,
      options?: { kerning?: boolean },
    ) => {
      commands: Array<{
        x?: number;
        x1?: number;
        x2?: number;
      }>;
      getBoundingBox: () => { x1: number; x2: number };
      toPathData: (decimalPlaces?: number) => string;
    };
  };

  export function load(path: string): Promise<Font>;
}
