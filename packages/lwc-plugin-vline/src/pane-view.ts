import { Coordinate, IPrimitivePaneView } from 'lightweight-charts';
import { VLinePaneRenderer } from './pane-renderer';
import { VLineDataSource } from './data-source';
import { VLineOptions } from './options';

export class VLinePaneView implements IPrimitivePaneView {
  _source: VLineDataSource;
  _x: Coordinate | null = null;
  _options: VLineOptions;

  constructor(source: VLineDataSource, options: VLineOptions) {
    this._source = source;
    this._options = options;
  }

  update() {
    const timeScale = this._source.chart.timeScale();
    this._x = timeScale.timeToCoordinate(this._source.time);
  }

  renderer() {
    return new VLinePaneRenderer(
      this._x,
      this._options
    );
  }
}
