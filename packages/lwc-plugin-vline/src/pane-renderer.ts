import { CanvasRenderingTarget2D } from 'fancy-canvas';
import { IPrimitivePaneRenderer, Coordinate, LineStyle } from 'lightweight-charts';
import { positionsLine } from './helpers/dimensions/positions';
import { VLineOptions } from './options';

export class VLinePaneRenderer implements IPrimitivePaneRenderer {
  _x: Coordinate | null = null;
  _options: VLineOptions;

  constructor(x: Coordinate | null, options: VLineOptions) {
    this._x = x;
    this._options = options;
  }

  draw(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace(scope => {
      if (this._x === null) return;
      const ctx = scope.context;
      const position = positionsLine(
        this._x,
        scope.horizontalPixelRatio,
        this._options.lineWidth,
      );
      
      // Save the current context state
      ctx.save();
      
      // Set line style
      ctx.strokeStyle = this._options.color;
      ctx.lineWidth = this._options.lineWidth;
      
      // Apply line style (Solid, Dotted, Dashed)
      switch (this._options.lineStyle) {
        case LineStyle.Solid:
          ctx.setLineDash([]);
          break;
        case LineStyle.Dotted:
          const dotSize = this._options.lineWidth * 2;
          ctx.setLineDash([dotSize, dotSize]);
          break;
        case LineStyle.Dashed:
          const dashSize = this._options.lineWidth * 4;
          ctx.setLineDash([dashSize, dashSize]);
          break;
      }
      
      // Draw the line
      ctx.beginPath();
      const x = position.position + (position.length / 2);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, scope.bitmapSize.height);
      ctx.stroke();
      
      // Restore the context state
      ctx.restore();
    });
  }
}
