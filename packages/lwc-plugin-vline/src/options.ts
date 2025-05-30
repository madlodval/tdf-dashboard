import { Time, isBusinessDay, LineStyle, LineWidth } from 'lightweight-charts';

export interface VLineOptions {

  /**
   * Line color.
   *
   * @defaultValue `'#000000'`
   */
  color: string;
  /**
   * Line width.
   *
   * @defaultValue `1`
   */
  lineWidth: LineWidth;
  /**
   * Line style.
   *
   * @defaultValue `LineStyle.Solid`
   */
  lineStyle: LineStyle;
  /**
     * Display line.
     *
     * @defaultValue `true`
     */
  lineVisible: boolean;
  /**
   * Display the current price value in on the price scale.
   *
   * @defaultValue `true`
   */
  axisLabelVisible: boolean;
  /**
   * Background color for the axis label.
   * Will default to the price line color if unspecified.
   *
   * @defaultValue `''`
   */
  axisLabelColor: string;
  /**
   * Text color for the axis label.
   *
   * @defaultValue `''`
   */
  axisLabelTextColor: string;

  /**
   * Locale to use for formatting the time label.
   *
   * @defaultValue `navigator.languages?.[0] || navigator.language || 'en-US'`
   */
  locale: string;

  /**
   * Function to format the time label.
   *
   * @defaultValue `defaultTimeLabelFormatter`
   */
  timeLabelFormatter: (time: Time, locale: string) => string;
}

export const defaultOptions: VLineOptions = {
  color: '#000000',
  lineWidth: 1,
  lineStyle: LineStyle.Solid,
  lineVisible: true,
  axisLabelVisible: true,
  axisLabelColor: '#000000',
  axisLabelTextColor: '#ffffff',
  locale: navigator.languages?.[0] || navigator.language || 'en-US',
  timeLabelFormatter: (time: Time, locale: string) => {
    if (typeof time == 'string') return time;
    const date = isBusinessDay(time)
      ? new Date(time.year, time.month, time.day)
      : new Date(time * 1000);
    const weekday = capitalize(date.toLocaleDateString(locale, { weekday: 'short' }));
    const month = capitalize(
      date.toLocaleDateString(locale, { month: 'short' })
    .replace(/\./g, '')
    );
    const day = date.getDate();
    const year = date.getFullYear().toString().slice(-2);
    
    return `${weekday} ${day} ${month} '${year}`;
  }
} as const;


function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}