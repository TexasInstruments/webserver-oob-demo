import { Prop } from '@stencil/core';
import { WidgetBaseProps } from './gc-widget-base-props';

export class WidgetBaseGaugeProps extends WidgetBaseProps {
    /**
     * The display value.
     * @order 2
     */
    @Prop() value: number = 0;

    /**
     * The minimum value to display.
     * @order 3
     */
    @Prop() minValue: number = 0;

    /**
     * The maximum value to display.
     * @order 4
     */
    @Prop() maxValue: number = 100;

    /**
     * The decimal precision to display for the tick labels.
     * @order 11
     */
    @Prop() precision: number = 0;

    /**
     * The main title text displayed on the gauge.
     * @order 12
     */
    @Prop() mainTitle: string;

    /**
     * The sub title text displayed on the gauge.
     * @order 13
     */
    @Prop() subTitle: string;
}