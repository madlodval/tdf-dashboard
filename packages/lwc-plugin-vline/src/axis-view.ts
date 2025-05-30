import { Coordinate, ISeriesPrimitiveAxisView } from 'lightweight-charts';
import { VLineDataSource } from './data-source';
import { VLineOptions } from './options';

abstract class VLineAxisView implements ISeriesPrimitiveAxisView {
  _source: VLineDataSource;
  _x: Coordinate | null = null;
  _options: VLineOptions;
  constructor(source: VLineDataSource, options: VLineOptions) {
    this._source = source;
    this._options = options;
  }
  abstract update(): void;
  abstract text(): string;

  visible(): boolean {
    return this._options.axisLabelVisible;
  }

  coordinate() {
    return this._x ?? 0;
  }

  tickVisible(): boolean {
    return this._options.axisLabelVisible;
  }

  textColor() {
    return this._options.axisLabelTextColor;
  }
  backColor() {
    return this._options.axisLabelColor;
  }
}

export class VLineTimeAxisView extends VLineAxisView {
  update() {
    const timeScale = this._source.chart.timeScale();
    this._x = timeScale.timeToCoordinate(this._source.time);
  }
  text() {
    return this._options.timeLabelFormatter(this._source.time, this._options.locale);
  }
}
