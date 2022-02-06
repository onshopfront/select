import React from "react";
import {
    DefaultValueType,
    OptionType,
    SelectChangeType,
    SelectCreatableType,
    SelectGroupType,
    SelectOptionType,
    SelectValueType
} from "./Select";
import { IconOption } from "./SelectIcon";

interface Props<TValue> {
    option: OptionType<TValue>;
    address: Array<number>;
    layer: number;
    onChange: SelectChangeType<TValue>;
    highlighted: boolean;
    onHighlight: (index: Array<number>) => void;
    selected: SelectValueType<TValue>;
    isMulti: boolean;
    renderLabel?: (option: OptionType<TValue>, selected: boolean, group: boolean) => React.ReactNode;
    createOptionMessage: () => React.ReactNode;
    lastSelected: boolean;
    iconRenderer: React.ComponentType<{ icon: IconOption }>;
    style: React.CSSProperties;
    forwardedRef?: React.ForwardedRef<Element>;
}

interface State {
    isSelected: boolean;
}

export function isGroupValue<TValue>(value: OptionType<TValue>): value is SelectGroupType<TValue> {
    if ("options" in value) {
        return Array.isArray(value.options);
    }

    return false;
}

export function isCreatableValue<TValue = DefaultValueType>(value: OptionType<TValue>): value is SelectCreatableType {
    return "creatable" in value;
}

export function isSelectValue<TValue = DefaultValueType>(value: OptionType<TValue>): value is SelectOptionType<TValue> {
    return !isGroupValue(value) && !isCreatableValue(value);
}

export class SelectOption<TValue = DefaultValueType> extends React.Component<Props<TValue>, State> {
    public itemRef: React.RefObject<HTMLDivElement> = React.createRef();

    public state = {
        isSelected: false,
    };

    public componentDidMount(): void {
        this.checkSelected();
    }

    public componentDidUpdate(prevProps: Readonly<Props<TValue>>): void {
        if (this.props.selected !== prevProps.selected || this.props.option !== prevProps.option) {
            this.checkSelected();
        }
    }

    protected registerRef = (ref: Element | null): void => {
        (this.itemRef as any).current = ref;

        if(typeof this.props.forwardedRef !== "undefined" && this.props.forwardedRef !== null) {
            if(typeof this.props.forwardedRef === "function") {
                this.props.forwardedRef(ref);
            } else {
                this.props.forwardedRef.current = ref;
            }
        }
    }

    public renderGroup = (): React.ReactNode => {
        if (!isGroupValue(this.props.option)) {
            return null;
        }

        let { label } = this.props.option;
        if (typeof this.props.renderLabel === "function") {
            label = this.props.renderLabel(this.props.option, false, true);
        }

        return (
            <div
                ref={this.registerRef}
                className="select-group"
                style={this.props.style}
            >
                <div
                    className="select-group-label"
                    style={{
                        paddingLeft: `${0.5 * this.props.layer}rem`,
                    }}
                >
                    {label}
                </div>
            </div>
        );
    };

    public checkSelected = (): void => {
        let isSelected = false;

        if (this.props.option) {
            if (!Array.isArray((this.props.option as SelectGroupType<TValue>).options)) {
                if (this.props.selected) {
                    const { value } = this.props.option as SelectOptionType<TValue>;

                    if (Array.isArray(this.props.selected)) {
                        isSelected = !!this.props.selected.find(
                            option => (option as SelectOptionType<TValue>).value === value
                        );
                    } else {
                        isSelected = (this.props.selected as SelectOptionType<TValue>).value === value;
                    }
                }
            }
        }

        this.setState({
            isSelected,
        });
    };

    public onClick = (): void => {
        if (isGroupValue(this.props.option)) {
            return;
        }

        this.props.onChange(this.props.option);
    };

    public onHover = (): void => {
        this.props.onHighlight(this.props.address);
    };

    public renderOption = (): React.ReactNode => {
        if (!isSelectValue(this.props.option)) {
            return null;
        }

        const classes = ["select-option"];

        if (this.props.highlighted) {
            classes.push("highlighted");
        }

        if (this.state.isSelected) {
            classes.push("selected");
        }

        if (this.props.lastSelected) {
            classes.push("last-selected");
        }

        let multi = null;
        if (this.props.isMulti) {
            classes.push("multi-option");
            const IconElement = this.props.iconRenderer;

            multi = (
                <span className="select-multi-indicator">
                    <IconElement
                        icon={(this.state.isSelected ? "checkbox-checked" : "checkbox")}
                    />
                </span>
            );
        }

        let { label } = this.props.option;
        if (typeof this.props.renderLabel === "function") {
            label = this.props.renderLabel(this.props.option, this.state.isSelected, false);
        } else {
            label = <React.Fragment>{multi} {label}</React.Fragment>;
        }

        return (
            <div
                ref={this.registerRef}
                className={classes.join(" ")}
                style={{
                    ...this.props.style,
                    paddingLeft: `${0.5 * this.props.layer}rem`,
                }}
                onClick={this.onClick}
                onMouseEnter={this.onHover}
            >
                {label}
            </div>
        );
    };

    public renderCreatable = (): React.ReactNode => {
        const classes = ["select-option", "select-creatable"];

        if (this.props.highlighted) {
            classes.push("highlighted");
        }

        return (
            <div
                ref={this.registerRef}
                className={classes.join(" ")}
                style={{
                    ...this.props.style,
                    paddingLeft: `${0.5 * this.props.layer}rem`,
                }}
                onClick={this.onClick}
                onMouseEnter={this.onHover}
            >
                {this.props.createOptionMessage()}
            </div>
        );
    };

    public render(): React.ReactNode {
        if (!this.props.option) {
            return (
                <div
                    className="select-option-empty"
                    style={this.props.style}
                    ref={this.registerRef}
                />
            );
        }

        if (isCreatableValue(this.props.option)) {
            return this.renderCreatable();
        }

        if (isGroupValue(this.props.option)) {
            return this.renderGroup();
        }

        return this.renderOption();
    }
}

export default React.forwardRef<Element, Props<any>>((props, ref) => (
    <SelectOption
        {...props}
        forwardedRef={ref}
    />
));
